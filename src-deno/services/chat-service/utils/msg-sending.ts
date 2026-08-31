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
// @ts-ignore
import { excerpt } from 'jsr:@dbushell/hyperless';
import type {
  ChatIdObj,
  ChatIncomingMessage,
  ChatRegularMsgV1,
  RelatedMessage,
} from '../../../../types/asmail-msgs.types.ts';
import type { ChatMessageAttachmentsInfo } from '../../../../types/chat.types.ts';
import type { OpenChatCmdArg } from '../../../../types/chat-commands.types.ts';
import type { AttachmentsContainer, FileWithId, ReadonlyFsWithId } from '../../../../types/app.types.ts';
import type { ChatDbEntry, ChatSrvEmit, DB, FileStoreService, MsgDbEntry } from '../../../types/index.ts';
import { LOGO_ICON_AS_ARRAY } from '../../../../src-main/common/constants/files.ts';
import { AUTO_DELETE_MESSAGES_BY_ID, AUTODELETE_OFF } from '../../../../shared-libs/constants/chat-settings.ts';
import { addFolderTo, addFileTo } from '../../../../shared-libs/attachments-container.ts';
import { generateChatMessageId } from '../../../../shared-libs/chat-ids.ts';
import { getFileStat, getEntityStat } from '../../../../shared-libs/get-stats-safely.ts';
import { AppSettings } from '../../../utils/app-settings.ts';
import { makeDbRecordException } from '../../../utils/exceptions.ts';
import {
  makeMsgRecordPhantom,
  queueSyncPhantom,
  sendRegularMessage as _sendRegularMessage,
  sendSystemMessage,
} from '../../mail-sending-service/index.ts';
import { chatIdOfChat, recipientsInChat } from './_chats-related-methods.ts';
import { createSyncMsgBasedOnRegularMsg, makeMsgDbEntry } from './_msgs-related-methods.ts';
import { msgEntityId } from './sync-versions.ts';

export async function msgSending({
  data,
  emit,
  filesStore,
  appSettings,
  ownAddr,
  getAppDeviceId,
  nextSyncStamp,
}: {
  data: DB;
  emit: ChatSrvEmit;
  filesStore: FileStoreService;
  appSettings: AppSettings;
  ownAddr: string;
  getAppDeviceId: () => string;
  nextSyncStamp: () => Promise<number>;
}) {
  async function prepOutgoingAttachments(
    entities: (web3n.files.ReadonlyFile | web3n.files.ReadonlyFS)[] | undefined,
  ): Promise<{
    attachments: ChatMessageAttachmentsInfo[] | null;
    attachmentContainer?: AttachmentsContainer;
  }> {
    if (!entities || entities.length === 0) {
      return { attachments: null };
    }

    const attachments: ChatMessageAttachmentsInfo[] = [];
    const attachmentContainer = {} as AttachmentsContainer;
    for (const entity of entities) {
      const isFolder = !!(entity as ReadonlyFsWithId).listFolder;
      const entityStat = isFolder
        ? {
            name: entity.name,
            size: 0,
            isFolder: true,
            ...((entity as ReadonlyFsWithId).id && { id: (entity as ReadonlyFsWithId).id }),
          }
        : {
            name: entity.name,
            size: (await getFileStat(entity as FileWithId)).size!,
            isFolder: false,
            ...((entity as FileWithId).fileId && { id: (entity as FileWithId).fileId }),
          };

      const entityId = await filesStore.saveLink(entity);
      attachments.push({
        ...entityStat,
        id: entityId,
      });

      if (isFolder) {
        addFolderTo(attachmentContainer, entity as web3n.files.ReadonlyFS);
      } else {
        addFileTo(attachmentContainer, entity as web3n.files.ReadonlyFile);
      }
    }
    return { attachments, attachmentContainer };
  }

  async function infoOfIncomingAttachments(
    attachmentsFS: web3n.files.ReadonlyFS | undefined,
  ): Promise<ChatMessageAttachmentsInfo[] | null> {
    if (!attachmentsFS) {
      return null;
    }

    const info: ChatMessageAttachmentsInfo[] = [];
    for (const entry of await attachmentsFS.listFolder('')) {
      if (entry.isFile) {
        const stats = await getEntityStat(attachmentsFS, entry.name, true);
        info.push({
          name: entry.name,
          size: stats.size!,
          isFolder: false,
        });
      } else {
        info.push({
          name: entry.name,
          size: 0,
          isFolder: true,
        });
      }
    }
    return info;
  }

  async function sendRegularMessage({
    chatId,
    chatMessageId,
    text,
    files,
    relatedMessage,
  }: {
    chatId: ChatIdObj;
    chatMessageId?: string;
    text: string;
    files: (web3n.files.ReadonlyFile | web3n.files.ReadonlyFS)[] | undefined;
    relatedMessage: RelatedMessage | undefined;
  }): Promise<void> {
    const chat = data.findChat(chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    const { timestamp, chatMessageId: newChatMessageId } = generateChatMessageId();
    const msgId = chatMessageId || newChatMessageId;

    const existingMsg = await data.getMessage({ chatId, chatMessageId: msgId });

    if (existingMsg) {
      const updatedMsg = await data.updateMessageRecord({ chatId, chatMessageId: msgId }, { status: 'sending' });

      // Record of the message already exists on other devices, only its status
      // needs to get back to a non-terminal one there.
      if (updatedMsg) {
        await sendStatusSyncMsg(chatId, updatedMsg);
      }

      const { attachmentContainer } = await prepOutgoingAttachments(files);
      const recipients = recipientsInChat(chat, ownAddr);
      await _sendRegularMessage(chatId, msgId, recipients, text, attachmentContainer, relatedMessage);
      return;
    }

    const { settings } = chat;
    const autoDeleteMessagesId = settings?.autoDeleteMessages as '0' | '1' | '2' | '3' | '4' | '5';
    const autoDeleteTSValue = AUTO_DELETE_MESSAGES_BY_ID[autoDeleteMessagesId].value || AUTODELETE_OFF;

    const { attachments, attachmentContainer } = await prepOutgoingAttachments(files);

    const msg = makeMsgDbEntry('regular', msgId, {
      groupChatId: chat.isGroupChat ? chat.chatId : null,
      otoPeerCAddr: chat.isGroupChat ? null : chat.peerCAddr,
      timestamp,
      removeAfter: autoDeleteMessagesId === '0' ? 0 : timestamp + autoDeleteTSValue,
      body: text,
      attachments,
      relatedMessage: relatedMessage ?? null,
      settings: {},
    });

    await data.addMessage(msg);

    // Phantom (sync) message goes out optimistically, right after the record is
    // placed into a database, and not on a delivery to peers being done. Own
    // devices should learn about the message even if peers are unreachable, and
    // phantoms of subsequent changes (reactions, edits, status) reference it.
    // Terminal status is synchronized later, with 'update:msg-record' phantom.
    await sendSyncMsgOfRegularMsg(chatId, msg);

    const recipients = recipientsInChat(chat, ownAddr);
    await _sendRegularMessage(chatId, msgId, recipients, text, attachmentContainer, relatedMessage);
    emit.message.added(msg);
  }

  /**
   * A phantom of the message record itself: it carries the entity rather than
   * a change of one of its aspects, so there is no version to stamp - a
   * record's creation is guarded by tombstones instead.
   */
  async function sendSyncMsgOfRegularMsg(chatId: ChatIdObj, msg: MsgDbEntry): Promise<void> {
    await queueSyncPhantom({
      db: data,
      ownAddr,
      phantom: createSyncMsgBasedOnRegularMsg({
        msg,
        sourceDeviceId: getAppDeviceId(),
        timestamp: await nextSyncStamp(),
      }),
      entity: {
        entityType: 'msg',
        entityId: msgEntityId(chatId, msg.chatMessageId),
        aspect: 'record',
      },
    });
  }

  /**
   * Status of a (re)sending that just started. Not stamped as the 'status'
   * aspect: the authoritative terminal status comes from the delivery-progress
   * hook, which does stamp it (handle-regular-sending-progress.ts).
   */
  async function sendStatusSyncMsg(chatId: ChatIdObj, msg: MsgDbEntry): Promise<void> {
    await queueSyncPhantom({
      db: data,
      ownAddr,
      phantom: makeMsgRecordPhantom({
        chatId,
        sourceDeviceId: getAppDeviceId(),
        timestamp: await nextSyncStamp(),
        msg,
      }),
      entity: {
        entityType: 'msg',
        entityId: msgEntityId(chatId, msg.chatMessageId),
        aspect: 'record',
      },
    });
  }

  async function cancelSendingMessage(deliveryId: string): Promise<void> {
    await w3n.mail?.delivery.rmMsg(deliveryId, true);
  }

  async function handleRegularMsg(
    incomingMsg: ChatIncomingMessage,
    chat: ChatDbEntry,
    chatMsgBody: ChatRegularMsgV1,
  ): Promise<void> {
    const { msgId, sender, plainTxtBody, attachments: attachmentsFS, deliveryTS } = incomingMsg;
    const { chatMessageId, relatedMessage } = chatMsgBody;
    const removeFromInbox = !incomingMsg.attachments;

    const chatId = chatIdOfChat(chat);
    const existingMsg = await data.getMessage({ chatId, chatMessageId });
    if (existingMsg) {
      // Already processed - this is a redelivery within the deferred inbox
      // removal window (P1); re-applying would violate the messages table PK
      // and would re-send the 'sent' status notification pointlessly.
      if (removeFromInbox) {
        await data.scheduleInboxMsgRemoval(msgId);
      }
      return;
    }

    const attachments = await infoOfIncomingAttachments(attachmentsFS);

    const { settings } = chat;
    const autoDeleteMessagesId = settings?.autoDeleteMessages as '0' | '1' | '2' | '3' | '4' | '5';
    const autoDeleteTSValue = AUTO_DELETE_MESSAGES_BY_ID[autoDeleteMessagesId].value || AUTODELETE_OFF;

    const msg = makeMsgDbEntry('regular', chatMessageId, {
      isIncomingMsg: true,
      incomingMsgId: removeFromInbox ? null : msgId,
      groupChatId: chat.isGroupChat ? chat.chatId : null,
      otoPeerCAddr: chat.isGroupChat ? null : chat.peerCAddr,
      groupSender: chat.isGroupChat ? sender : null,
      body: plainTxtBody ?? null,
      attachments,
      relatedMessage: relatedMessage ?? null,
      timestamp: deliveryTS,
      removeAfter: autoDeleteMessagesId === '0' ? 0 : deliveryTS + autoDeleteTSValue,
    });

    await data.addMessage(msg);

    emit.message.added(msg);

    if (removeFromInbox) {
      await data.scheduleInboxMsgRemoval(msgId);
    }

    const icon = Uint8Array.from(LOGO_ICON_AS_ARRAY);
    const notificationTitle = await appSettings.t('app.notification.new_message', { sender });

    await w3n.shell?.userNotifications?.addNotification({
      icon,
      title: notificationTitle,
      body: plainTxtBody ? excerpt(`<div>${plainTxtBody}</div>`, 50) : '',
      cmd: {
        cmd: 'open-chat-with',
        params: [
          {
            chatId: {
              isGroupChat: chat.isGroupChat,
              chatId: chat.isGroupChat ? chat.chatId : chat.peerCAddr,
            },
            peerAddress: sender,
          } as OpenChatCmdArg,
        ],
      },
    });

    await sendSystemMessage({
      chatId: chatIdOfChat(chat),
      recipients: [incomingMsg.sender],
      chatSystemData: {
        event: 'update:status',
        value: {
          chatMessageId,
          status: 'sent',
        },
      },
    });
  }

  return {
    sendRegularMessage,
    cancelSendingMessage,
    handleRegularMsg,
  };
}
