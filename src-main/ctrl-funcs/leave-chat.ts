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
import { msgIdLength } from '@main/constants';
import { getRandomId } from '@v1nt1248/3nclient-lib/utils';
import { chatMessagesByType } from '@main/helpers/chats.helper';
import { ChatMessageView, ChatView, MessageType } from '~/index';
import { ChatsStore } from '@main/store/chats';
import { sendSystemMessage } from './send-system-message';
import { includesAddress } from '@shared/address-utils';

export async function leaveChat(
  chatsStore: ChatsStore,
  chat: ChatView & { unread: number } & ChatMessageView<MessageType>,
  users: string[],
  isRemoved = false
): Promise<void> {
  if (!chat) {
    return;
  }

  const messages = chat.chatId === chatsStore.currentChatId
    ? chatsStore.currentChatMessages
    : await appChatsSrvProxy.getMessagesByChat(chat.chatId);

  const { incomingMessages = [], outgoingMessages = [] } = chatMessagesByType(messages);
  const chatMembers = chat.members;
  const recipients = chatMembers.filter(addr => !includesAddress(users, addr));

  await appChatsSrvProxy.deleteChat(chat.chatId);
  await appDeliverySrvProxy.removeMessageFromInbox(incomingMessages);
  await appDeliverySrvProxy.removeMessageFromDeliveryList(outgoingMessages);
  const chatMessageId = getRandomId(msgIdLength);

  sendSystemMessage({
    chatId: chat.chatId,
    chatMessageId,
    recipients,
    event: 'delete:members',
    value: { users, isRemoved },
    displayable: true,
  });
}
