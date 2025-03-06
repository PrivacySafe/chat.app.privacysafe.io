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

import { appChatsSrvProxy, appDeliverySrvProxy } from '@main/services/services-provider';
import { chatMessagesByType } from '@main/helpers/chats.helper';
import { ChatsStore } from '@main/store/chats';

export async function clearChat(
  chatsStore: ChatsStore, chatId: string
): Promise<void> {
  if (!chatId) {
    return;
  }

  const messages = chatId === chatsStore.currentChatId
    ? chatsStore.currentChatMessages
    : await appChatsSrvProxy.getMessagesByChat(chatId);

  const { incomingMessages = [], outgoingMessages = [] } = chatMessagesByType(messages);
  await appChatsSrvProxy.clearChat(chatId);
  await appDeliverySrvProxy.removeMessageFromInbox(incomingMessages);
  await appDeliverySrvProxy.removeMessageFromDeliveryList(outgoingMessages);
  if (chatId === chatsStore.currentChatId) {
    await chatsStore.fetchChat(chatId);
  } else {
    await chatsStore.fetchChatList();
  }
}
