/*
 Copyright (C) 2025 3NSoft Inc.

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
import { chatIdOfChat, excludeAddrFrom, makeMsgDbEntry, msgDbEntryForIncomingSysMsg } from './common-transforms.ts';
import type { ChatIdObj, UpdatedChatSettingsSysMsgData } from '../../types/asmail-msgs.types.ts';
import type { ChatService } from './index.ts';
import type { ChatDbEntry, ChatSettings } from '../dataset/versions/v2/chats-db.ts';
import { includesAddress } from '../../shared-libs/address-utils.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';
import { generateChatMessageId } from '../../shared-libs/chat-ids.ts';
import { sendSystemMessage } from '../utils/send-chat-msg.ts';

export default class ChatSettingUp {
  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly ownAddr: string,
  ) {
  }

  async setUp(chatId: ChatIdObj, data: Partial<ChatSettings>): Promise<void> {
    const chat = this.data.findChat(chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    if (chat.isGroupChat && !includesAddress(chat.admins, this.ownAddr)) {
      throw makeDbRecordException({ notAdmin: true });
    }

    const settings = {
      ...chat.settings,
      ...data,
    };
    const updatedChat = chat.isGroupChat
      ? await this.data.updateGroupChatRecord(chatId.chatId, { settings })
      : await this.data.updateOTOChatRecord(chatId.chatId, { settings });
    if (!updatedChat) {
      return;
    }
    this.emit.chat.updated(updatedChat);

    const { chatMessageId, timestamp } = generateChatMessageId();
    const chatSystemData: UpdatedChatSettingsSysMsgData = {
      event: 'update:settings',
      value: { settings },
    };
    const msg = makeMsgDbEntry('system', chatMessageId, {
      ...(chat.isGroupChat && { groupChatId: chat.chatId }),
      ...(!chat.isGroupChat && { otoPeerCAddr: chat.peerCAddr }),
      body: JSON.stringify(chatSystemData),
      timestamp,
    });
    await this.data.addMessage(msg);
    this.emit.message.added(msg);

    const recipients = chat.isGroupChat
      ? excludeAddrFrom(Object.keys(chat.members), this.ownAddr)
      : [chat.peerCAddr];
    await sendSystemMessage({
      chatId, chatMessageId, recipients, chatSystemData,
    });
  }

  async handleUpdateSettings(
    sender: string,
    chat: ChatDbEntry,
    chatMessageId: string,
    timestamp: number,
    chatSystemData: UpdatedChatSettingsSysMsgData,
  ): Promise<void> {
    if (chat.isGroupChat && !includesAddress(chat.admins, sender)) {
      return;
    }

    const { settings } = chatSystemData.value;
    const updatedChat = chat.isGroupChat
      ? await this.data.updateGroupChatRecord(chat.chatId, { settings })
      : await this.data.updateOTOChatRecord(chat.peerCAddr, { settings });
    if (!updatedChat) {
      return;
    }
    this.emit.chat.updated(updatedChat);

    const chatId = chatIdOfChat(chat);
    const sysMsg = msgDbEntryForIncomingSysMsg(sender, chatId, chatMessageId, timestamp, chatSystemData);
    await this.data.addMessage(sysMsg);
    this.emit.message.added(sysMsg);
  }
}
