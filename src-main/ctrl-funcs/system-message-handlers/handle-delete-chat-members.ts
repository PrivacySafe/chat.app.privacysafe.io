/*
Copyright (C) 2024 - 2025 3NSoft Inc.

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

import { appChatsSrvProxy } from '@main/services/services-provider';
import { ChatsStore } from '@main/store/chats';
import { includesAddress } from '@shared/address-utils';
import type { ChatMessageView, SystemMessageHandlerParams } from '~/index';

export async function handleDeleteChatMembers(
  chatsStore: ChatsStore, {
    msgId,
    chatId,
    chatMessageId,
    value,
    displayable,
    sender = '',
  }: SystemMessageHandlerParams
): Promise<void> {
  if (!chatId || (chatId && !value)) {
    return;
  }

  const chat = await appChatsSrvProxy.getChat(chatId);
  if (chat) {
    const { members } = chat;
    const { users, isRemoved } = value as { users: string[], isRemoved: boolean };

    chat.members = members.filter(addr => !includesAddress(users, addr));

    await appChatsSrvProxy.updateChat(chat);
    await chatsStore.fetchChatList();

    if (displayable) {
      let messageText = `[${users.join(',')}]`;
      if (!isRemoved) {
        messageText += 'leave.chat.system.message';
      } else {
        messageText = users.length > 1
          ? messageText + 'delete.members.system.message'
          : messageText + 'delete.member.system.message';
      }

      const msgView: ChatMessageView<'incoming'> = {
        msgId: msgId!,
        attachments: [],
        messageType: 'incoming',
        sender,
        body: messageText,
        chatId,
        chatMessageType: 'system',
        chatMessageId: chatMessageId!,
        initialMessageId: null,
        timestamp: Date.now(),
        status: 'received',
      };

      await appChatsSrvProxy.upsertMessage(msgView);
      if (chatId === chatsStore.currentChatId) {
        chatsStore.currentChatMessages.push(msgView);
      }
    }
  }
};
