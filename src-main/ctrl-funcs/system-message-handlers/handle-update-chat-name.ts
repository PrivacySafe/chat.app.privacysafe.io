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
import type { ChatMessageView, SystemMessageHandlerParams } from '~/index';

export async function handleUpdateChatName(
  chatsStore: ChatsStore,
  {
    chatId,
    chatMessageId,
    value,
    msgId,
    sender = '',
  }: SystemMessageHandlerParams
): Promise<void> {
  if (!chatId || !msgId || !chatMessageId) {
    return;
  }

  const chat = await appChatsSrvProxy.getChat(chatId);
  if (chat) {
    const { name } = value as { name: string };
    chat.name = name;
    await appChatsSrvProxy.updateChat(chat);
    await chatsStore.fetchChatList();

    const msgView: ChatMessageView<'incoming'> = {
      msgId,
      attachments: [],
      messageType: 'incoming',
      sender,
      body: 'rename.chat.system.message',
      chatId,
      chatMessageType: 'system',
      chatMessageId,
      initialMessageId: null,
      timestamp: Date.now(),
      status: 'received',
    };

    await appChatsSrvProxy.upsertMessage(msgView);
    if (chatId === chatsStore.currentChatId) {
      chatsStore.currentChatMessages.push(msgView);
    }
  }
};
