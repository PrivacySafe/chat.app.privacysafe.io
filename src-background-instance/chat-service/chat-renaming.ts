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
import { ChatIdObj } from "../../types/asmail-msgs.types.ts";
import type { ChatService } from './index.ts';
import { chatIdOfChat, excludeAddrFrom, makeMsgDbEntry, msgDbEntryForIncomingSysMsg } from './common-transforms.ts';
import { ChatDbEntry } from '../dataset/versions/v1/chats-db.ts';
import { includesAddress } from '../../shared-libs/address-utils.ts';
import { UpdatedChatNameSysMsgData } from '../../types/asmail-msgs.types.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';
import { generateChatMessageId } from '../../shared-libs/chat-ids.ts';
import { sendSystemMessage } from '../utils/send-chat-msg.ts';

export default class ChatRenaming {

  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly ownAddr: string
  ) {}

  async renameChat(chatId: ChatIdObj, name: string): Promise<void> {
    if (!chatId.isGroupChat) {
      throw new Error(`Only group chat can be renamed. One-to-one chat needs contact details update`);
    }
    const chat = this.data.findChat(chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    } else if (!chat.isGroupChat) {
      throw makeDbRecordException({ notGroupChat: true });
    } else if (!includesAddress(chat.admins, this.ownAddr)) {
      throw makeDbRecordException({ notAdmin: true });
    } else if (chat.name === name) {
      return;
    }

    // do local changes and notifications
    const updatedChat = await this.data.updateGroupChatRecord(
      chatId.chatId, { name }
    );
    if (!updatedChat) {
      return;
    }
    this.emit.chat.updated(updatedChat);

    // send request to other members, recording it locally, as well
    const { chatMessageId, timestamp } = generateChatMessageId();
    const chatSystemData: UpdatedChatNameSysMsgData = {
      event: 'update:chatName',
      value: { name }
    };
    const msg = makeMsgDbEntry('system', chatMessageId, {
      groupChatId: chat.chatId,
      body: JSON.stringify(chatSystemData),
      timestamp
    });
    await this.data.addMessage(msg);
    this.emit.message.added(msg);

    const recipients = excludeAddrFrom(chat.members, this.ownAddr);
    await sendSystemMessage({
      chatId, chatMessageId, recipients, chatSystemData
    });
  }

  async handleUpdateChatName(
    sender: string, chat: ChatDbEntry, chatMessageId: string, timestamp: number,
    chatSystemData: UpdatedChatNameSysMsgData
  ): Promise<void> {
    if (!chatMessageId || !chat.isGroupChat
    || !includesAddress(chat.admins, sender)) {
      return;
    }

    const { name } = chatSystemData.value;
    const updatedChat = await this.data.updateGroupChatRecord(
      chat.chatId,
      { name }
    );
    if (!updatedChat) {
      return;
    }
    this.emit.chat.updated(updatedChat);

    const chatId = chatIdOfChat(chat)
    await this.data.addMessage(msgDbEntryForIncomingSysMsg(
      sender, chatId, chatMessageId, timestamp, chatSystemData
    ));
    const sysMsg = await this.data.getMessage({
      chatId: chatId, chatMessageId
    });
    this.emit.message.added(sysMsg!);
  }

}