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
  ChatMessageId,
  ChatRegularMsgV1,
  RelatedMessage,
} from '../../../../types/asmail-msgs.types.ts';
import type {
  ChatMessageAttachmentsInfo,
  ChatMessageHistory,
  ChatMessageHistoryErrors,
  LocalMetadataInDelivery,
} from '../../../../types/chat.types.ts';
import type { OpenChatCmdArg } from '../../../../types/chat-commands.types.ts';
import type { AttachmentsContainer, FileWithId, ReadonlyFsWithId } from '../../../../types/app.types.ts';
import type { ChatDbEntry, ChatSrvEmit, DB, FileStoreService, SendingProgressInfo } from '../../../types/index.ts';
import { LOGO_ICON_AS_ARRAY } from '../../../../src-main/common/constants/files.ts';
import { AUTO_DELETE_MESSAGES_BY_ID, AUTODELETE_OFF } from '../../../../shared-libs/constants.ts';
import { addFolderTo, addFileTo } from '../../../../shared-libs/attachments-container.ts';
import { generateChatMessageId } from '../../../../shared-libs/chat-ids.ts';
import { getFileStat, getEntityStat } from '../../../../shared-libs/get-stats-safely.ts';
import { AppSettings } from '../../../utils/app-settings.ts';
import { makeDbRecordException } from '../../../utils/exceptions.ts';
import { sendRegularMessage as _sendRegularMessage, sendSystemMessage } from '../../../utils/send-chat-msg.ts';
import { chatIdOfChat, recipientsInChat } from './_chats-related-methods.ts';
import { makeMsgDbEntry, removeMessageFromInbox } from './_msgs-related-methods.ts';

export async function msgSending({
  data,
  emit,
  filesStore,
  appSettings,
  ownAddr,
}: {
  data: DB;
  emit: ChatSrvEmit;
  filesStore: FileStoreService;
  appSettings: AppSettings;
  ownAddr: string;
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

    if (chatMessageId) {
      await data.updateMessageRecord({ chatId, chatMessageId }, { status: 'sending' });

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

    const recipients = recipientsInChat(chat, ownAddr);
    await _sendRegularMessage(chatId, msgId, recipients, text, attachmentContainer, relatedMessage);
    emit.message.added(msg);
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
    const attachments = await infoOfIncomingAttachments(attachmentsFS);
    const removeFromInbox = !incomingMsg.attachments;

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
      await removeMessageFromInbox(msgId);
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

  async function handleSendingProgress({ progress }: SendingProgressInfo): Promise<void> {
    const localMeta = progress.localMeta as LocalMetadataInDelivery;
    const chatMessageId: ChatMessageId = {
      chatId: localMeta.chatId,
      chatMessageId: localMeta.chatMessageId!,
    };

    const msg = await data.getMessage(chatMessageId);

    if (!msg) {
      return;
    }

    // eslint-disable-next-line no-useless-assignment
    let { status, history } = msg;
    if (progress.allDone) {
      status = progress.allDone === 'all-ok' ? 'sent' : 'error';

      if (progress.allDone === 'with-errors') {
        const errors = Object.keys(progress.recipients).reduce((res, address) => {
          const { err } = progress.recipients[address];
          if (err) {
            res![address] = err;
          }

          return res;
        }, {} as ChatMessageHistoryErrors);

        if (Object.keys(errors).length > 0) {
          if (!history) {
            history = {
              changes: [],
            } as ChatMessageHistory;
          }

          history.changes?.push({
            user: ownAddr,
            timestamp: Date.now(),
            type: 'error',
            value: errors,
          });
        }
      }
    } else {
      // TODO
      // XXX instead of return we can add more info depending on progress state,
      //     like different status, history entries
      return;
    }

    const updatedMsg = await data.updateMessageRecord(chatMessageId, { status, history });
    emit.message.updated(updatedMsg);
  }

  return {
    sendRegularMessage,
    cancelSendingMessage,
    handleRegularMsg,
    handleSendingProgress,
  };
}
