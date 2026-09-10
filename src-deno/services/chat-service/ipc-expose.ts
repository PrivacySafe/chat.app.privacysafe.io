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
import type { ChatSrv } from '../../types/chat-srv.types.ts';
import { MultiConnectionIPCWrap } from '../../../shared-libs/ipc/ipc-service.js';

const REQ_REPLY_METHODS: (keyof ChatSrv)[] = [
  'getAppDeviceId',
  'logFromGui',
  'createOneToOneChat',
  'createGroupChat',
  'acceptChatInvitation',
  'getChatList',
  'getChat',
  'findChatEntry',
  'renameChat',
  'chatSetUp',
  'deleteChat',
  'updateGroupMembers',
  'updateGroupAdmins',
  'deleteMessagesInChat',
  'deleteMessage',
  'deleteMessages',
  'deleteExpiredMessages',
  'collectGarbageInAuxiliaryDB',
  'removeExpiredInboxMessages',
  'resolveStuckSyncingSelfMessages',
  'collectGarbageInSyncVersions',
  'releasePendingSyncPhantoms',
  'countPendingSyncPhantoms',
  'countSyncPhantomsInDelivery',
  'getSyncActivityState',
  'getLatestIncomingMsgTimestamp',
  'getMessage',
  'getMessagesByChat',
  'getMessagesPageByChat',
  'getRecentReactions',
  'getThumbnails',
  'saveThumbnail',
  'sendRegularMessage',
  'markMessageAsReadNotifyingSender',
  'checkAddressExistenceForASMail',
  'cancelSendingMessage',
  'getIncomingMessage',
  'updateEarlySentMessage',
  'changeMessageReaction',
  'sendSystemDeletableMessage',
  'makeAndSaveMsgToDb',
  'saveAndSyncLocalSystemMsg',
  'createBackupPlan',
  'cancelBackupPlan',
  'previewRestore',
  'restoreBackupArchive',
  // Published so that specs can feed synthesized phantoms to the real
  // service: a device skips its own phantoms by sourceDeviceId, and the test
  // stand has no second device of the same user, so there is no other way to
  // exercise the receiving side of synchronization (P2-8).
  'handleIncomingMsg',
];

const OBSERVABLE_METHODS: (keyof ChatSrv)[] = ['watch'];

/**
 * Wraps a service that is still being built into an object the IPC wrap can
 * expose right away.
 *
 * The point is the platform's clock: a caller gets 10 seconds from asking for
 * a service to the component's exposeService() call, while building the real
 * service touches synced storage - on a freshly created user that alone can
 * overrun the limit, and the GUI's very first connection dies with "Timeout
 * in connecting to service". So exposure must not wait for construction:
 * these facades answer the handshake immediately, and every call simply
 * awaits the real thing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

function facadeOver<T>(
  srv: Promise<T>,
  reqReplyMethods: (keyof T)[],
  observableMethods: (keyof T)[],
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const facade = {} as any;
  for (const m of reqReplyMethods) {
    facade[m] = async (...args: unknown[]) => ((await srv)[m] as AnyFn)(...args);
  }
  for (const m of observableMethods) {
    // The wrap needs a detach function synchronously, while the real method
    // appears only when the service is ready: detach what was subscribed, or
    // remember not to subscribe at all.
    facade[m] = (...args: unknown[]) => {
      let detach: (() => void) | undefined = undefined;
      let cancelled = false;
      srv.then(s => {
        if (!cancelled) {
          detach = ((s[m] as AnyFn)(...args)) as () => void;
        }
      }, () => {
        // A failed start closes the whole component; there is nothing for an
        // already-subscribed observer to be told here.
      });
      return () => {
        cancelled = true;
        detach?.();
      };
    };
  }
  return facade as T;
}

/**
 * Exposes the chat service methods on the internal IPC channel named
 * 'AppChatsInternal'. Takes a promise so that exposure can happen at the very
 * start of the component, before the slow storage-touching initialization
 * (see facadeOver above). Returns a stop function to close the IPC.
 */
export function exposeChatServiceOnIPC(chats: Promise<ChatSrv>): () => void {
  const srvWrapInternal = new MultiConnectionIPCWrap('AppChatsInternal');
  const facade = facadeOver(chats, REQ_REPLY_METHODS, OBSERVABLE_METHODS);

  srvWrapInternal.exposeReqReplyMethods(facade, REQ_REPLY_METHODS);
  srvWrapInternal.exposeObservableMethods(facade, OBSERVABLE_METHODS);

  return srvWrapInternal.startIPC();
}

export { facadeOver };
