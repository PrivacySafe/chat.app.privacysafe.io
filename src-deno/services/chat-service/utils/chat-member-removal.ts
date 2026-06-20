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
import type { ChatDbEntry, ChatSrvEmit, DB, GroupChatDbEntry, MsgDbEntry } from '../../../types/index.ts';
import { generateChatMessageId } from '../../../../shared-libs/chat-ids.ts';

export async function chatMemberRemoval({
  data,
  emit,
  ownAddr,
}: {
  data: DB;
  emit: ChatSrvEmit;
  ownAddr: string;
}) {
  async function handleMemberRemovedChat(
    sender: string,
    chat: ChatDbEntry,
    chatDeleted: boolean | undefined,
  ): Promise<void> {
    if (chat.isGroupChat) {
      const updatedMembers = { ...(chat as GroupChatDbEntry).members };

      !!updatedMembers[sender] && delete updatedMembers[sender];
      const isUserOnlyMember =
        Object.keys(updatedMembers).length === 1 && Object.keys(updatedMembers)[0] === ownAddr;

      const updatedChat = await data.updateGroupChatRecord(chat.chatId, {
        members: updatedMembers,
        ...(isUserOnlyMember && { status: 'no-members' }),
      });

      updatedChat && emit.chat.updated(updatedChat);
    } else {
      const updatedChat = await data.updateOTOChatRecord(chat.peerCAddr, {
        status: 'no-members',
      });

      updatedChat && emit.chat.updated(updatedChat);
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
      removeAfter: 0,
      history: null,
      reactions: null,
      settings: null,
    };

    await data.addMessage(msg);
    emit.message.added(msg);
  }

  return {
    handleMemberRemovedChat,
  };
}
