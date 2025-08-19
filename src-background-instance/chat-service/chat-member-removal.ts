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

/* eslint-disable @typescript-eslint/no-unused-vars */

import { ChatsData } from '../dataset/index.ts';
import type { ChatService } from './index.ts';
import type { ChatDbEntry, GroupChatDbEntry } from '../dataset/versions/v2/chats-db.ts';
import { MsgDbEntry } from '@bg/dataset/versions/v2/msgs-db.ts';
import { generateChatMessageId } from '../../shared-libs/chat-ids.ts';

export class ChatMemberRemoval {

  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly filesStore: ChatService['filesStore'],
    private readonly ownAddr: string,
    private readonly removeMessageFromInbox:
    ChatService['removeMessageFromInbox'],
  ) {
  }

  async handleMemberRemovedChat(
    sender: string,
    chat: ChatDbEntry,
    chatDeleted: boolean | undefined,
  ): Promise<void> {
    if (chat.isGroupChat) {
      const user = await w3n.mail?.getUserId();
      const updatedMembers = { ...(chat as GroupChatDbEntry).members };
      !!updatedMembers[sender] && delete updatedMembers[sender];
      const isUserOnlyMember = Object.keys(updatedMembers).length === 1
        && Object.keys(updatedMembers)[0] === user!;

      const updatedChat = await this.data.updateGroupChatRecord(chat.chatId, {
        members: updatedMembers,
        ...(isUserOnlyMember && { status: 'no-members' }),
      });

      updatedChat && this.emit.chat.updated(updatedChat);
    } else {
      const updatedChat = await this.data.updateOTOChatRecord(chat.peerCAddr, {
        status: 'no-members',
      });

      updatedChat && this.emit.chat.updated(updatedChat);
    }

    const { chatMessageId, timestamp } = generateChatMessageId();
    const msg: MsgDbEntry = {
      groupChatId: chat.isGroupChat ? chat.chatId : null,
      otoPeerCAddr: chat.isGroupChat ? null : chat.peerCAddr,
      chatMessageId,
      isIncomingMsg: false,
      incomingMsgId: null,
      groupSender: chat.isGroupChat ? sender : null,
      body: JSON.stringify({
        event: 'member-left',
        value: { sender },
      }),
      attachments: null,
      chatMessageType: 'system',
      relatedMessage: null,
      status: null,
      timestamp,
      history: null,
      reactions: null,
    };

    await this.data.addMessage(msg);
    this.emit.message.added(msg);
  }
}
