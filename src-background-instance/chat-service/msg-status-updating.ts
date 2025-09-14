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
import { ChatMessageId } from '../../types/asmail-msgs.types.ts';
import type { ChatService } from './index.ts';
import { chatIdOfChat, recipientsInChat } from './common-transforms.ts';
import { ChatDbEntry } from '../dataset/versions/v2/chats-db.ts';
import { UpdatedMsgStatusSysMsgData } from '../../types/asmail-msgs.types.ts';
import { MsgDbEntry } from '../dataset/versions/v2/msgs-db.ts';
import { sendSystemMessage } from '../utils/send-chat-msg.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';

export class MsgStatusUpdating {

  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly ownAddr: string,
  ) {
  }

  async markMessageAsReadNotifyingSender(
    { chatId, chatMessageId }: ChatMessageId): Promise<void> {
    const chat = this.data.findChat(chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    // update local data
    const updatedMsg = await this.data.updateMessageRecord(
      { chatId, chatMessageId },
      { status: 'read' },
    );
    if (!updatedMsg) {
      throw makeDbRecordException({ messageNotFound: true });
    }
    this.emit.message.updated(updatedMsg);

    // notify peers
    const recipients = recipientsInChat(chat, this.ownAddr);
    await sendSystemMessage({
      chatId, recipients, chatSystemData: {
        event: 'update:status',
        value: { chatMessageId, status: 'read' },
      },
    });
  }

  async handleUpdateMessageStatus(
    sender: string,
    chat: ChatDbEntry,
    { chatMessageId, status }: UpdatedMsgStatusSysMsgData['value'],
    timestamp: number,
  ): Promise<void> {
    // check request
    if ((status !== 'sent') && (status !== 'read')) {
      return;
    }
    const chatId = chatIdOfChat(chat);
    const id = { chatId, chatMessageId };
    const msg = await this.data.getMessage(id);
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

      updatedMsg = await this.data.updateMessageRecord(id, {
        status,
      });

    } else {
      // XXX may want to update history

      if (msg.status === 'read') {
        // XXX this should still add to history, without changing status
        return;
      }

      updatedMsg = await this.data.updateMessageRecord(id, {
        status,
      });
    }
    this.emit.message.updated(updatedMsg);
  }

}
