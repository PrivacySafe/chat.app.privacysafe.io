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
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { ChatMessageId, UpdatedMsgStatusSysMsgData } from '../../../../types/asmail-msgs.types.ts';
import type { MessageStatus } from '../../../../types/chat.types.ts';
import type { ChatDbEntry, ChatSrvEmit, DB, MsgDbEntry } from '../../../types/index.ts';
import { makeDbRecordException } from '../../../utils/exceptions.ts';
import { sendSystemMessage } from '../../../utils/send-chat-msg.ts';
import { chatIdOfChat, recipientsInChat } from './_chats-related-methods.ts';

export async function msgStatusUpdating({
  data,
  emit,
  ownAddr,
}: {
  data: DB;
  emit: ChatSrvEmit;
  ownAddr: string;
}) {
  async function updateMessageStatus(chatMsgId: ChatMessageId, msgStatus: MessageStatus): Promise<ChatDbEntry> {
    const chat = data.findChat(chatMsgId.chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    const updatedMsg = await data.updateMessageRecord(
      { chatId: chatMsgId.chatId, chatMessageId: chatMsgId.chatMessageId },
      { status: msgStatus },
    );
    if (!updatedMsg) {
      throw makeDbRecordException({ messageNotFound: true });
    }
    emit.message.updated(updatedMsg);

    return chat;
  }

  async function markMessageAsReadNotifyingSender({ chatId, chatMessageId }: ChatMessageId): Promise<void> {
    const chat = await updateMessageStatus({ chatId, chatMessageId }, 'read');

    // notify peers
    const recipients = recipientsInChat(chat, ownAddr);
    await sendSystemMessage({
      chatId,
      recipients,
      chatSystemData: {
        event: 'update:status',
        value: { chatMessageId, status: 'read' },
      },
    });
  }

  async function handleUpdateMessageStatus(
    sender: string,
    chat: ChatDbEntry,
    { chatMessageId, status }: UpdatedMsgStatusSysMsgData['value'],
    timestamp: number,
  ): Promise<void> {
    if (status !== 'sent' && status !== 'read') {
      return;
    }
    const chatId = chatIdOfChat(chat);
    const id = { chatId, chatMessageId };
    const msg = await data.getMessage(id);
    if (!msg || msg.isIncomingMsg) {
      return;
    }

    // update local data, if needed
    let updatedMsg: MsgDbEntry | undefined;
    if (chat.isGroupChat) {
      // XXX current code is simplistic.
      // XXX may want/need to update history

      if (msg.status === 'read') {
        // XXX this should still add to history, without changing status
        return;
      }

      updatedMsg = await data.updateMessageRecord(id, {
        status,
      });
    } else {
      // XXX may want to update history

      if (msg.status === 'read') {
        // XXX this should still add to history, without changing status
        return;
      }

      updatedMsg = await data.updateMessageRecord(id, {
        status,
      });
    }

    emit.message.updated(updatedMsg);
  }

  return {
    updateMessageStatus,
    markMessageAsReadNotifyingSender,
    handleUpdateMessageStatus,
  };
}
