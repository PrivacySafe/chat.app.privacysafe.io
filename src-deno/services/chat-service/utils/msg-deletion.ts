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
import type { ChatIdObj, ChatMessageId, DeleteMessageSysMsgData } from '../../../../types/asmail-msgs.types.ts';
import { ChatMessageAttachmentsInfo } from '../../../../types/chat.types.ts';
import type { ChatDbEntry, ChatSrvEmit, DB, FileStoreService } from '../../../types/index.ts';
import { makeDbRecordException } from '../../../utils/exceptions.ts';
import { includesAddress } from '../../../../shared-libs/address-utils.ts';
import {
  removeAttachmentsOfOutgoingMsg,
  removeMsgDataNotInDB,
  removeMessageFromInbox,
} from './_msgs-related-methods.ts';
import { chatIdOfChat, recipientsInChat } from './_chats-related-methods.ts';
import { sendSystemMessage } from '../../../utils/send-chat-msg.ts';

export async function msgDeletion({
  data,
  filesStore,
  emit,
  ownAddr,
}: {
  data: DB;
  emit: ChatSrvEmit;
  filesStore: FileStoreService;
  ownAddr: string;
}) {
  async function removeMsgBytes(
    id: ChatMessageId,
    isIncomingMsg: boolean,
    incomingMsgId: string | null,
    attachments: ChatMessageAttachmentsInfo[] | null,
  ): Promise<void> {
    await data.deleteMessage(id);
    if (isIncomingMsg && incomingMsgId) {
      await removeMessageFromInbox(incomingMsgId);
    } else if (!isIncomingMsg && attachments) {
      await removeAttachmentsOfOutgoingMsg(attachments, filesStore);
    }
  }

  async function deleteMessage(id: ChatMessageId, deleteForEveryone: boolean): Promise<void> {
    const chat = data.findChat(id.chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }
    const msg = await data.getMessage(id);
    if (!msg) {
      throw makeDbRecordException({ messageNotFound: true });
    }

    // change local data
    await removeMsgBytes(id, msg.isIncomingMsg, msg.incomingMsgId, msg.attachments);
    emit.message.removed(id);

    if (deleteForEveryone) {
      const { chatId } = id;
      const recipients = recipientsInChat(chat, ownAddr);
      await sendSystemMessage({
        chatId,
        recipients,
        chatSystemData: {
          event: 'delete:message',
          value: { oneMessage: id },
        },
      });
    }
  }

  async function deleteMessages(chatMsgIds: ChatMessageId[] = [], deleteForEveryone?: boolean): Promise<void> {
    const chatId = chatMsgIds.length > 0 ? chatMsgIds[0].chatId : null;
    if (!chatId) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    const chat = data.findChat(chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    const removeMsgsPr: Promise<void>[] = [];
    for (const chatMessageId of chatMsgIds) {
      const msg = await data.getMessage(chatMessageId);
      if (!msg) {
        throw makeDbRecordException({ messageNotFound: true });
      }

      removeMsgsPr.push(removeMsgBytes(chatMessageId, msg.isIncomingMsg, msg.incomingMsgId, msg.attachments));
    }
    await Promise.allSettled(removeMsgsPr);
    emit.message.removedMultiple(chatMsgIds);

    if (deleteForEveryone) {
      const recipients = recipientsInChat(chat, ownAddr);
      await sendSystemMessage({
        chatId,
        recipients,
        chatSystemData: {
          event: 'delete:message',
          value: {
            multipleMessages: {
              chatMsgIds,
            },
          },
        },
      });
    }
  }

  async function deleteExpiredMessages(now: number): Promise<void> {
    const expiredMessages = await data.getExpiredMessages(now);
    const messagesToDelete = expiredMessages.map(msg => {
      const { chatMessageId, groupChatId, otoPeerCAddr } = msg;
      const chatId = groupChatId
        ? { isGroupChat: true, chatId: groupChatId! }
        : { isGroupChat: false, chatId: otoPeerCAddr! };

      return {
        chatId,
        chatMessageId,
      };
    });

    messagesToDelete.length > 0 && (await deleteMessages(messagesToDelete));
  }

  async function deleteMessagesInChat(chatId: ChatIdObj, deleteForEveryone: boolean): Promise<void> {
    const chat = data.findChat(chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }
    if (chat.isGroupChat && deleteForEveryone && !includesAddress(chat.admins, ownAddr)) {
      throw new Error(`Non-admin member can't delete message for everyone`);
    }

    // do local changes
    const msgsDataToRm = await data.deleteMessagesInChat(chatId);
    if (msgsDataToRm) {
      await removeMsgDataNotInDB(msgsDataToRm, filesStore);
    }
    emit.chat.allMsgsRemoved(chatId);

    // send notifications, if we need
    if (deleteForEveryone) {
      const recipients = recipientsInChat(chat, ownAddr);
      await sendSystemMessage({
        chatId,
        recipients,
        chatSystemData: {
          event: 'delete:message',
          value: { allInChat: chatId },
        },
      });
    }
  }

  async function handleDeleteChatMessage(
    chat: ChatDbEntry,
    value: DeleteMessageSysMsgData['value'],
  ): Promise<void> {
    const { oneMessage, multipleMessages } = value;

    if (oneMessage) {
      const { chatMessageId } = oneMessage;
      const chatId = chatIdOfChat(chat);
      const id = { chatId, chatMessageId };
      const msg = await data.getMessage(id);

      if (!msg) {
        return;
      }

      await removeMsgBytes(id, msg.isIncomingMsg, msg.incomingMsgId, msg.attachments);
      emit.message.removed(id);
      return;
    }

    if (multipleMessages) {
      const { chatMsgIds } = multipleMessages;

      const chatId = chatIdOfChat(chat);
      const removeMsgsPr: Promise<void>[] = [];
      for (const id of chatMsgIds) {
        const { chatMessageId } = id;
        const msg = await data.getMessage({ chatId, chatMessageId });

        if (msg) {
          removeMsgsPr.push(
            removeMsgBytes({ chatId, chatMessageId }, msg.isIncomingMsg, msg.incomingMsgId, msg.attachments),
          );
        }
      }
      await Promise.allSettled(removeMsgsPr);
      const deletedMsgs = chatMsgIds.map(id => ({
        chatId,
        chatMessageId: id.chatMessageId,
      }));

      emit.message.removedMultiple(deletedMsgs);
      return;
    }
  }

  return {
    deleteMessage,
    deleteMessages,
    deleteExpiredMessages,
    deleteMessagesInChat,
    handleDeleteChatMessage,
  };
}
