/*
 Copyright (C) 2020 - 2025 3NSoft Inc.

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

import { ChatsData } from '../dataset/index.ts';
import { ChatIdObj, ChatMessageId } from '../../types/asmail-msgs.types.ts';
import type { ChatService } from './index.ts';
import { chatIdOfChat, recipientsInChat } from './common-transforms.ts';
import { ChatDbEntry } from '../dataset/versions/v2/chats-db.ts';
import { includesAddress } from '../../shared-libs/address-utils.ts';
import { DeleteMessageSysMsgData } from '../../types/asmail-msgs.types.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';
import { sendSystemMessage } from '../utils/send-chat-msg.ts';
import { RefsToMsgsDataNoInDB } from '../dataset/versions/v2/msgs-db.ts';
import { ChatMessageAttachmentsInfo } from '../../types/chat.types.ts';

export class MsgDeletion {

  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly filesStore: ChatService['filesStore'],
    private readonly ownAddr: string,
    private readonly removeMessageFromInbox:
    ChatService['removeMessageFromInbox'],
  ) {
  }

  async deleteMessage(id: ChatMessageId, deleteForEveryone: boolean): Promise<void> {
    const chat = this.data.findChat(id.chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }
    const msg = await this.data.getMessage(id);
    if (!msg) {
      throw makeDbRecordException({ messageNotFound: true });
    }

    // change local data
    await this.removeMsgBytes(id, msg.isIncomingMsg, msg.incomingMsgId, msg.attachments);
    this.emit.message.removed(id);

    if (deleteForEveryone) {
      const { chatId } = id;
      const recipients = recipientsInChat(chat, this.ownAddr);
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

  async deleteMessages(chatMsgIds: ChatMessageId[] = [], deleteForEveryone: boolean): Promise<void> {
    const chatId = chatMsgIds.length > 0 ? chatMsgIds[0].chatId : null;
    if (!chatId) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    const chat = this.data.findChat(chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    const removeMsgsPr: Promise<void>[] = [];
    for (const chatMessageId of chatMsgIds) {
      const msg = await this.data.getMessage(chatMessageId);
      if (!msg) {
        throw makeDbRecordException({ messageNotFound: true });
      }

      removeMsgsPr.push(
        this.removeMsgBytes(chatMessageId, msg.isIncomingMsg, msg.incomingMsgId, msg.attachments),
      );
    }
    await Promise.all(removeMsgsPr);
    this.emit.message.removedMultiple(chatMsgIds);

    if (deleteForEveryone) {
      const recipients = recipientsInChat(chat, this.ownAddr);
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

  private async removeMsgBytes(
    id: ChatMessageId,
    isIncomingMsg: boolean,
    incomingMsgId: string | null,
    attachments: ChatMessageAttachmentsInfo[] | null,
  ): Promise<void> {
    await this.data.deleteMessage(id);
    if (isIncomingMsg && incomingMsgId) {
      await this.removeMessageFromInbox(incomingMsgId);
    } else if (!isIncomingMsg && attachments) {
      await removeAttachmentsOfOutgoingMsg(attachments, this.filesStore);
    }
  }

  async deleteMessagesInChat(chatId: ChatIdObj, deleteForEveryone: boolean): Promise<void> {
    const chat = this.data.findChat(chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }
    if (chat.isGroupChat && deleteForEveryone
      && !includesAddress(chat.admins, this.ownAddr)) {
      throw new Error(`Non-admin member can't delete message for everyone`);
    }

    // do local changes
    const msgsDataToRm = await this.data.deleteMessagesInChat(chatId);
    if (msgsDataToRm) {
      removeMsgDataNotInDB(
        msgsDataToRm, this.removeMessageFromInbox, this.filesStore,
      );
    }
    this.emit.chat.allMsgsRemoved(chatId);

    // send notifications, if we need
    if (deleteForEveryone) {
      const recipients = recipientsInChat(chat, this.ownAddr);
      await sendSystemMessage({
        chatId, recipients, chatSystemData: {
          event: 'delete:message',
          value: { allInChat: chatId },
        },
      });
    }
  }

  async handleDeleteChatMessage(
    chat: ChatDbEntry,
    value: DeleteMessageSysMsgData['value'],
  ): Promise<void> {
    const { oneMessage, multipleMessages } = value;

    if (oneMessage) {
      const { chatMessageId } = oneMessage;
      const chatId = chatIdOfChat(chat);
      const id = { chatId, chatMessageId };
      const msg = await this.data.getMessage(id);

      if (!msg) {
        return;
      }

      await this.removeMsgBytes(id, msg.isIncomingMsg, msg.incomingMsgId, msg.attachments);
      this.emit.message.removed(id);
      return;
    }

    if (multipleMessages) {
      const { chatMsgIds } = multipleMessages;

      const chatId = chatIdOfChat(chat);
      const removeMsgsPr: Promise<void>[] = [];
      for (const id of chatMsgIds) {
        const { chatMessageId } = id;
        const msg = await this.data.getMessage({ chatId, chatMessageId });

        if (msg) {
          removeMsgsPr.push(
            this.removeMsgBytes({ chatId, chatMessageId }, msg.isIncomingMsg, msg.incomingMsgId, msg.attachments),
          );
        }
      }
      await Promise.all(removeMsgsPr);
      const deletedMsgs = chatMsgIds.map(id => ({
        chatId,
        chatMessageId: id.chatMessageId,
      }))

      this.emit.message.removedMultiple(deletedMsgs);
      return;
    }
  }
}

export async function removeMsgDataNotInDB(
  refs: RefsToMsgsDataNoInDB,
  removeMessageFromInbox: ChatService['removeMessageFromInbox'],
  filesStore: ChatService['filesStore'],
): Promise<void> {
  for (const msgId of refs.inboxMsgs) {
    await removeMessageFromInbox(msgId);
  }
  for (const { attachments } of refs.outgoingMsgs) {
    await removeAttachmentsOfOutgoingMsg(attachments, filesStore);
  }
}

async function removeAttachmentsOfOutgoingMsg(
  attachments: ChatMessageAttachmentsInfo[],
  filesStore: ChatService['filesStore'],
): Promise<void> {

  for (const { id } of attachments) {
    if (id) {
      await filesStore.deleteLink(id);
    }
  }
}
