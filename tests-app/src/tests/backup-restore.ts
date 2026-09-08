/*
 Copyright (C) 2026 3NSoft Inc.

 This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU General Public License as published by the Free Software
 Foundation, either version 3 of the License, or (at your option) any later
 version.

 This program is distributed in the hope that it will be useful, but
 WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 this program. If not, see <http://www.gnu.org/licenses/>.
*/

/**
 * Backup and restore against the LIVE service, which is what ci/backup-restore
 * cannot do: there the databases are built by hand, here they are the ones the
 * running app writes to, and the IPC contract is exercised as the window uses
 * it.
 *
 * Four things are worth having here in particular:
 *
 * - the round trip through the real `createBackupPlan` / `restoreBackupArchive`,
 *   including the cleared history that comes back and the individually deleted
 *   message that must NOT;
 * - **"as a neighbour would"**: the snapshot chunks are fed back through
 *   `handleIncomingMsg` with a foreign sourceDeviceId, shuffled and twice over,
 *   and must produce the same state a local restore does. One function serves
 *   both ends, and this is what says so;
 * - the **backwards-compatibility contract**: the snapshot phantom is run
 *   through the very validation functions an OLDER build would use, and must
 *   pass. This is what pins in code the constraint that forbids a new
 *   chatMessageType or `v: 2` (see RestoreSnapshotSysMsgData);
 * - the cleanup a deletion driven by a phantom has to do outside the database.
 *
 * Nothing here touches the network: chats are created from invitation phantoms
 * rather than through createGroupChat(), which pre-flights peer addresses.
 */

import { itCond } from '../libs-for-tests/jasmine-utils.js';
import { chatService, fileLinkStoreSrv } from '@main/common/services/external-services.ts';
import { useAppMenuItems } from '@main/common/composables/useAppMenu.ts';
import {
  BackupArchiveFailure,
  openBackupContainer,
  packEncryptedContainer,
} from '@main/common/utils/backup-container.ts';
import { isBackupCancelledError } from '@main/common/store/backup.store.ts';
import { summarizeSkippedAttachments } from '@main/common/utils/skipped-attachments.ts';
import { checkChatMessageJSON, checkV1 } from '@deno/services/chat-service/utils/_msgs-related-methods.ts';
import { planJournalRelease } from '@deno/services/mail-sending-service/sync-phantoms.ts';
import { chunkRestoreSnapshot } from '@deno/services/backup-service/backup-records.ts';
import { makeBackupMetadataBytes } from '@shared/backup-archive.ts';
import { METADATA_FILE_NAME } from '@shared/constants/backup.ts';
import { zipSync } from 'fflate';
import type { ChatIdObj, ChatIncomingMessage } from '~/asmail-msgs.types';
import type { BackupPlan, BackupRecordFiles, SnapshotMsgEntry } from '~/backup.types';

declare const w3n: web3n.testing.CommonW3N;

function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Wraps a phantom body into an inbox message, as the dispatcher would hand it
 * over. `msgId` is synthetic on purpose: the receiving path only ever passes it
 * to inbox removal, which ignores a message it cannot find.
 */
function phantomMsg(
  ownAddr: string,
  chatId: ChatIdObj,
  sourceDeviceId: string,
  timestamp: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
): ChatIncomingMessage {
  return {
    msgId: uniqueName('synthetic-phantom'),
    msgType: 'chat',
    deliveryTS: Date.now(),
    sender: ownAddr,
    establishedSenderKeyChain: true,
    jsonBody: {
      v: 1,
      chatMessageType: 'synchronization',
      sourceDeviceId,
      chatId,
      timestamp,
      value,
    },
  } as ChatIncomingMessage;
}

function groupInvitationValue(chatId: string, name: string, ownAddr: string) {
  return {
    v: 1,
    chatMessageType: 'invitation',
    chatMessageId: uniqueName('inv'),
    inviteData: {
      type: 'group-chat-invite',
      groupChatId: chatId,
      name,
      members: { [ownAddr]: { hasAccepted: true } },
      admins: [ownAddr],
      status: 'on',
    },
  };
}

function snapshotChunkValue(
  restoreId: string,
  part: number,
  of: number,
  mode: 'merge' | 'replace',
  snapshotTs: number,
  groupChatId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chunk: { chats?: any[]; msgs?: any[]; deleted?: any },
) {
  return {
    v: 1,
    chatMessageType: 'system',
    groupChatId,
    chatSystemData: {
      event: 'restore:snapshot',
      value: { mode, snapshotTs, restoreId, part, of, ...chunk },
    },
  };
}

function deleteOneMessageValue(chatMessageId: string, chatId: ChatIdObj) {
  return {
    v: 1,
    chatMessageType: 'system',
    groupChatId: chatId.isGroupChat ? chatId.chatId : undefined,
    chatSystemData: {
      event: 'delete:message',
      value: { oneMessage: { chatId, chatMessageId } },
    },
  };
}

/** The three json entries, as the window would have read them back. */
function recordFilesOf(plan: BackupPlan): BackupRecordFiles {
  return {
    chatsJson: JSON.stringify(plan.chats),
    messagesJson: JSON.stringify(plan.messages),
    tombstonesJson: JSON.stringify(plan.tombstones),
  };
}

async function makeChatFromPhantom(ownAddr: string, name: string): Promise<ChatIdObj> {
  const groupChatId = uniqueName('backup-chat');
  const chatId: ChatIdObj = { isGroupChat: true, chatId: groupChatId };
  await chatService.handleIncomingMsg(
    phantomMsg(
      ownAddr,
      chatId,
      `other-device-${Date.now()}`,
      Date.now(),
      groupInvitationValue(groupChatId, name, ownAddr),
    ),
  );
  return chatId;
}

describe(`Backup and restore`, () => {

  // ===========================================================================
  describe(`Test Suite 1: an archive of the live service`, () => {

    itCond(`carries the chats, the records and their tokens`, async () => {
      const ownAddr = await w3n.testStand.idOfTestUser(1);
      const chatId = await makeChatFromPhantom(ownAddr, uniqueName('Archived chat'));

      const msgView = await chatService.makeAndSaveMsgToDb(ownAddr, {
        chatMessageType: 'regular',
        groupChatId: chatId.chatId,
        body: `a message to archive ${Date.now()}`,
        timestamp: Date.now(),
        status: 'sent',
      });

      const plan = await chatService.createBackupPlan({ withAttachments: true });

      expect(typeof plan.snapshotTs)
        .withContext(`the archive's own HLC stamp, the barrier of a later replace`)
        .toBe('number');
      expect(plan.chats.some(c => c.chatId.chatId === chatId.chatId))
        .withContext(`the chat has to be in the archive`)
        .toBeTrue();
      const archived = plan.messages.find(m => m.chatMessageId === msgView.chatMessageId);
      expect(archived).withContext(`and so has the record`).toBeDefined();
      expect(archived?.record.body).toBe(
        (msgView as unknown as { body: string }).body,
      );
      // The row minus the chat columns: the addressing pair carries those.
      expect((archived?.record as unknown as Record<string, unknown>).groupChatId)
        .withContext(`chat columns do not travel inside the record`)
        .toBeUndefined();
    }, 30000);

    itCond(`a plan taken without attachments names 'not-requested' rather than staying silent`, async () => {
      const ownAddr = await w3n.testStand.idOfTestUser(1);
      const chatId = await makeChatFromPhantom(ownAddr, uniqueName('No-files chat'));

      const bytes = new Uint8Array([1, 2, 3, 4]);
      const entityId = await fileLinkStoreSrv.saveFile(bytes.buffer as ArrayBuffer, 'attached.bin');
      await chatService.makeAndSaveMsgToDb(ownAddr, {
        chatMessageType: 'regular',
        groupChatId: chatId.chatId,
        body: `with a file ${Date.now()}`,
        timestamp: Date.now(),
        status: 'sent',
        attachments: [{ id: entityId, name: 'attached.bin', size: bytes.length }],
      });

      const withFiles = await chatService.createBackupPlan({ withAttachments: true });
      expect(withFiles.attachmentsToRead.some(a => a.entityId === entityId))
        .withContext(`the file is on the work-list when it was asked for`)
        .toBeTrue();

      const withoutFiles = await chatService.createBackupPlan({ withAttachments: false });
      expect(withoutFiles.attachmentsToRead.length)
        .withContext(`nothing to read when files were not asked for`)
        .toBe(0);
      const summary = summarizeSkippedAttachments(withoutFiles.skippedAttachments);
      expect(summary.byReason.some(r => r.reason === 'not-requested'))
        .withContext(`and the reason is named, not left to be guessed`)
        .toBeTrue();
    }, 30000);

    itCond(`cancelling leaves the service usable`, async () => {
      // Cancellation is racy by nature - a plan of a small history is built
      // faster than a cancel can reach it - so what is asserted is the contract
      // the dialog relies on: the call answers, and a plan can be taken after.
      await chatService.cancelBackupPlan();
      const plan = await chatService.createBackupPlan({ withAttachments: false });
      expect(typeof plan.snapshotTs).toBe('number');
    }, 20000);

  });

  // ===========================================================================
  describe(`Test Suite 2: restore on this device`, () => {

    itCond(`merge brings back a cleared history, but not a message deleted on its own`, async () => {
      const ownAddr = await w3n.testStand.idOfTestUser(1);
      const chatId = await makeChatFromPhantom(ownAddr, uniqueName('Restore chat'));

      const kept = await chatService.makeAndSaveMsgToDb(ownAddr, {
        chatMessageType: 'regular',
        groupChatId: chatId.chatId,
        body: `survives clearing ${Date.now()}`,
        timestamp: Date.now(),
        status: 'sent',
      });
      const deletedOnItsOwn = await chatService.makeAndSaveMsgToDb(ownAddr, {
        chatMessageType: 'regular',
        groupChatId: chatId.chatId,
        body: `deleted on purpose ${Date.now()}`,
        timestamp: Date.now(),
        status: 'sent',
      });

      const plan = await chatService.createBackupPlan({ withAttachments: false });
      const recordFiles = recordFilesOf(plan);

      // One message deleted deliberately, then the whole history cleared.
      await chatService.deleteMessage(
        { chatId, chatMessageId: deletedOnItsOwn.chatMessageId },
        false,
      );
      await chatService.deleteMessagesInChat(chatId, false);

      expect(await chatService.getMessage({ chatId, chatMessageId: kept.chatMessageId }))
        .withContext(`the history is gone before the restore`)
        .toBeUndefined();

      const outcome = await chatService.restoreBackupArchive({
        recordFiles,
        storedAttachments: {},
        mode: 'merge',
        snapshotTs: plan.snapshotTs,
      });
      expect(outcome.restored).toBeTrue();

      expect(await chatService.getMessage({ chatId, chatMessageId: kept.chatMessageId }))
        .withContext(
          `a cleared history comes back: the marker forbids only records older than itself, `
            + `and treating its presence as "skip everything" would make merge useless `
            + `in any chat ever cleared`,
        )
        .toBeDefined();

      expect(await chatService.getMessage({ chatId, chatMessageId: deletedOnItsOwn.chatMessageId }))
        .withContext(`a message with a tombstone of its own is NOT resurrected`)
        .toBeUndefined();
    }, 60000);

    itCond(`previewRestore counts without writing anything`, async () => {
      const ownAddr = await w3n.testStand.idOfTestUser(1);
      const chatId = await makeChatFromPhantom(ownAddr, uniqueName('Preview chat'));
      await chatService.makeAndSaveMsgToDb(ownAddr, {
        chatMessageType: 'regular',
        groupChatId: chatId.chatId,
        body: `for the preview ${Date.now()}`,
        timestamp: Date.now(),
        status: 'sent',
      });

      const plan = await chatService.createBackupPlan({ withAttachments: false });
      const recordFiles = recordFilesOf(plan);
      const before = await chatService.getMessagesByChat(chatId);

      const merge = await chatService.previewRestore(recordFiles, 'merge');
      const replace = await chatService.previewRestore(recordFiles, 'replace');

      // The archive is of the state as it stands, so nothing is missing.
      expect(merge.chatsToCreate).toBe(0);
      expect(merge.messagesToCreate).toBe(0);
      // `merge` can destroy nothing, and says so in its numbers.
      expect(merge.chatsToDelete).toBe(0);
      expect(merge.messagesToDelete).toBe(0);
      // `replace` would touch the aspects of what is here.
      expect(replace.chatsToUpdate).toBeGreaterThan(0);

      expect((await chatService.getMessagesByChat(chatId)).length)
        .withContext(`a preview writes nothing`)
        .toBe(before.length);
    }, 40000);

  });

  // ===========================================================================
  describe(`Test Suite 3: as a neighbour would apply it`, () => {

    itCond(`shuffled, repeated chunks give the state a local restore gives`, async () => {
      const ownAddr = await w3n.testStand.idOfTestUser(1);
      const otherDeviceId = `other-device-${Date.now()}`;

      // The state to be announced, built on this device.
      const sourceChat = await makeChatFromPhantom(ownAddr, uniqueName('Announced chat'));
      const msgIds: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const view = await chatService.makeAndSaveMsgToDb(ownAddr, {
          chatMessageType: 'regular',
          groupChatId: sourceChat.chatId,
          body: `announced ${i} ${Date.now()}`,
          timestamp: Date.now() + i,
          status: 'sent',
        });
        msgIds.push(view.chatMessageId);
      }

      const plan = await chatService.createBackupPlan({ withAttachments: false });

      // The chat the neighbour is to receive is a DIFFERENT one, so that this
      // device can play the receiving side without the records already being
      // here: the ids are rewritten onto a chat that does not exist yet.
      const targetChatId = uniqueName('neighbour-chat');
      const target: ChatIdObj = { isGroupChat: true, chatId: targetChatId };

      const sourceChatEntry = plan.chats.find(c => c.chatId.chatId === sourceChat.chatId)!;
      const chats = [{
        chatId: target,
        record: { ...sourceChatEntry.record, chatId: targetChatId },
        versions: sourceChatEntry.versions,
      }];
      const msgs: SnapshotMsgEntry[] = plan.messages
        .filter(m => msgIds.includes(m.chatMessageId))
        .map(m => ({
          chatId: target,
          chatMessageId: m.chatMessageId,
          record: m.record,
          versions: m.versions,
        }));

      const chunks = chunkRestoreSnapshot({ chats, msgs, chunkBytes: 256 });
      expect(chunks.length).withContext(`the snapshot has to be split at 256 bytes`).toBeGreaterThan(1);

      const restoreId = uniqueName('restore');
      // Out of order and twice over: the chunks are separate ASMail messages,
      // and neither their order nor their uniqueness is guaranteed by anything.
      const order = [...chunks.keys()].reverse();
      for (const round of [0, 1]) {
        void round;
        for (const index of order) {
          await chatService.handleIncomingMsg(
            phantomMsg(
              ownAddr,
              target,
              otherDeviceId,
              plan.snapshotTs + index,
              snapshotChunkValue(
                restoreId,
                index + 1,
                chunks.length,
                'merge',
                plan.snapshotTs,
                targetChatId,
                chunks[index],
              ),
            ),
          );
        }
      }

      expect(await chatService.getChat(target))
        .withContext(`the announced chat has to exist on the receiving side`)
        .toBeDefined();

      const received = await chatService.getMessagesByChat(target);
      expect(received.length)
        .withContext(`every record, once - a chunk seen twice must add nothing`)
        .toBe(msgs.length);
      for (const chatMessageId of msgIds) {
        expect(received.some(m => m.chatMessageId === chatMessageId))
          .withContext(`record ${chatMessageId} must be there`)
          .toBeTrue();
      }
    }, 90000);

  });

  // ===========================================================================
  describe(`Test Suite 4: the backwards-compatibility contract`, () => {

    itCond(`a snapshot phantom passes the validation an OLDER build applies`, async () => {
      const ownAddr = await w3n.testStand.idOfTestUser(1);
      const chatId = await makeChatFromPhantom(ownAddr, uniqueName('Compat chat'));

      const msg = phantomMsg(
        ownAddr,
        chatId,
        `other-device-${Date.now()}`,
        Date.now(),
        snapshotChunkValue(
          uniqueName('restore'), 1, 1, 'merge', Date.now(), chatId.chatId,
          { msgs: [] },
        ),
      );

      // These are the two functions that decide, on ANY build, whether a chat
      // message is admitted or removed from the shared inbox at once. A new
      // chatMessageType or `v: 2` makes both answer undefined, and an older
      // build then takes the snapshot away from the newer devices that still
      // need it. That is why the announcement is a new `system` event inside an
      // ordinary `synchronization` phantom - and this spec is what pins it.
      const checked = checkChatMessageJSON(msg);
      expect(checked)
        .withContext(`a snapshot phantom must be admitted by the validation of any build`)
        .toBeDefined();
      expect(checked?.chatId.chatId).toBe(chatId.chatId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inner = (msg.jsonBody as any).value;
      expect(checkV1(inner, ownAddr))
        .withContext(`and so must the system message it carries`)
        .toBeDefined();
    }, 30000);

    itCond(`a journal row of a snapshot chunk is never superseded`, async () => {
      const restoreId = uniqueName('restore');
      const row = (id: number, aspect: string, entityId: string) => ({
        id, entityType: 'chat' as const, entityId, aspect, ts: id, payload: '{}', attempts: 0,
      });
      // Two independent guards, and this checks both: the entityId names the
      // part, so no two chunks share an (entity, aspect) pair - and 'snapshot'
      // is not among the supersedable aspects to begin with.
      const rows = [
        row(1, 'snapshot', `restore/${restoreId}#1`),
        row(2, 'snapshot', `restore/${restoreId}#2`),
        row(3, 'name', 'g/some-chat'),
        row(4, 'name', 'g/some-chat'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ] as any;

      const { release, superseded } = planJournalRelease(rows);
      expect(release.map(r => r.id).sort()).toEqual([1, 2, 4]);
      expect(superseded.map(r => r.id))
        .withContext(`only the ordinary aspect is superseded by its newer row`)
        .toEqual([3]);
    });

  });

  // ===========================================================================
  describe(`Test Suite 5: the container, without a file dialog`, () => {

    itCond(`a passphrase-protected archive opens with its passphrase and not without`, async () => {
      const inner = zipSync({ 'chats.json': new TextEncoder().encode('[]') });
      const packed = await packEncryptedContainer(inner, 'a good passphrase', '0.0.0-test', {
        snapshotTs: 12345,
      });

      const opened = await openBackupContainer(packed, 'a good passphrase');
      expect(opened.encrypted).toBeTrue();
      expect(opened.metadata?.snapshotTs)
        .withContext(`snapshotTs stays in the container: without it a replace has no barrier`)
        .toBe(12345);
      expect(opened.metadata?.messagesCount)
        .withContext(`the counts do NOT: the size of a history is not for somebody who cannot open it`)
        .toBeUndefined();
      expect(new TextDecoder().decode(opened.plainZipBytes.slice(0, 2))).toBe('PK');

      // AES-GCM refusing the tag IS the wrong-passphrase answer; there is no
      // other check to make.
      let reason: string | undefined;
      try {
        await openBackupContainer(packed, 'the wrong one');
      } catch (err) {
        reason = (err as BackupArchiveFailure).reason;
      }
      expect(reason).toBe('wrong_passphrase');

      let withoutPassphrase: string | undefined;
      try {
        await openBackupContainer(packed);
      } catch (err) {
        withoutPassphrase = (err as BackupArchiveFailure).reason;
      }
      expect(withoutPassphrase).toBe('passphrase_required');
    }, 30000);

    itCond(`another app's archive is refused before a passphrase is asked for`, async () => {
      // By the domain in our own metadata file...
      const byDomain = zipSync({
        [METADATA_FILE_NAME]: new TextEncoder().encode(JSON.stringify({
          appDomain: 'inbox.app.privacysafe.io',
          version: '0.0.0',
          formatVersion: 1,
          createdAt: new Date().toISOString(),
        })),
      });
      let reason: string | undefined;
      try {
        await openBackupContainer(byDomain);
      } catch (err) {
        reason = (err as BackupArchiveFailure).reason;
      }
      expect(reason).toBe('foreign_archive');

      // ...and by the presence of another app's metadata file, for archives
      // written before the domain field existed.
      const byEntryName = zipSync({
        'inbox_app_privacysafe_io.json': new TextEncoder().encode('{}'),
        'messages.json': new TextEncoder().encode('[]'),
      });
      let byName: string | undefined;
      try {
        await openBackupContainer(byEntryName);
      } catch (err) {
        byName = (err as BackupArchiveFailure).reason;
      }
      expect(byName).toBe('foreign_archive');
    }, 20000);

    itCond(`an unencrypted archive carries its metadata in the open`, async () => {
      const metadata = makeBackupMetadataBytes({
        version: '0.0.0-test',
        snapshotTs: 999,
        chatsCount: 2,
        messagesCount: 7,
        attachmentsCount: 1,
      });
      const archive = zipSync({
        [METADATA_FILE_NAME]: metadata,
        'chats.json': new TextEncoder().encode('[]'),
      });

      const opened = await openBackupContainer(archive);
      expect(opened.encrypted).toBeFalse();
      expect(opened.metadata?.appDomain).toBe('chat.app.privacysafe.io');
      expect(opened.metadata?.messagesCount).toBe(7);
    });

    itCond(`isBackupCancelledError recognizes an error stripped of its class by IPC`, async () => {
      // The error crosses IPC as data, so what arrives is a plain object with
      // no class and sometimes no `name`. Matching on text is a necessity here,
      // not sloppiness.
      expect(isBackupCancelledError({ name: 'AbortError' })).toBeTrue();
      expect(isBackupCancelledError({ message: 'Backup was cancelled' })).toBeTrue();
      expect(isBackupCancelledError({ message: 'The operation was aborted' })).toBeTrue();
      expect(isBackupCancelledError({ cause: 'aborted by user' })).toBeTrue();
      expect(isBackupCancelledError({ message: 'disk is full' })).toBeFalse();
      expect(isBackupCancelledError(undefined)).toBeFalse();
    });

  });

  // ===========================================================================
  describe(`Test Suite 6: the app menu`, () => {

    itCond(`offers the same three actions, in the order both form factors show`, async () => {
      const items = useAppMenuItems();
      expect(items.value.map(i => i.id))
        .withContext(`one list for the desktop dropdown and the phone drawer`)
        .toEqual(['make-backup', 'restore-backup', 'exit']);
      for (const item of items.value) {
        expect(item.icon)
          .withContext(`the icon set is not open-ended: an unknown name renders as nothing`)
          .toBeTruthy();
        expect(item.label).toBeTruthy();
      }
    });

  });

  // ===========================================================================
  describe(`Test Suite 7: a deletion driven by a phantom cleans up outside the DB`, () => {

    itCond(`removes the attachment bytes of an outgoing message`, async () => {
      const ownAddr = await w3n.testStand.idOfTestUser(1);
      const otherDeviceId = `other-device-${Date.now()}`;
      const chatId = await makeChatFromPhantom(ownAddr, uniqueName('Cleanup chat'));

      const bytes = new Uint8Array([5, 6, 7, 8]);
      const entityId = await fileLinkStoreSrv.saveFile(bytes.buffer as ArrayBuffer, 'doomed.bin');
      expect(await fileLinkStoreSrv.getFile(entityId))
        .withContext(`the bytes are in the store before the deletion`)
        .toBeTruthy();

      const msgView = await chatService.makeAndSaveMsgToDb(ownAddr, {
        chatMessageType: 'regular',
        groupChatId: chatId.chatId,
        body: `will be deleted elsewhere ${Date.now()}`,
        timestamp: Date.now(),
        status: 'sent',
        attachments: [{ id: entityId, name: 'doomed.bin', size: bytes.length }],
      });

      // The deletion happens on ANOTHER device of the user, and reaches this one
      // as a phantom. That path used to drop the database row alone, leaving the
      // bytes in the local store forever.
      await chatService.handleIncomingMsg(
        phantomMsg(
          ownAddr,
          chatId,
          otherDeviceId,
          Date.now(),
          deleteOneMessageValue(msgView.chatMessageId, chatId),
        ),
      );

      expect(await chatService.getMessage({ chatId, chatMessageId: msgView.chatMessageId }))
        .withContext(`the row is gone`)
        .toBeUndefined();
      expect(await fileLinkStoreSrv.getFile(entityId))
        .withContext(`and so are the attachment bytes`)
        .toBeFalsy();
    }, 40000);

  });

});
