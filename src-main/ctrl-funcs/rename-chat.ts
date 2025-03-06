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
import { chatIdLength } from '@main/constants';
import { useAppStore } from '@main/store/app';
import { getRandomId } from '@v1nt1248/3nclient-lib/utils';
import type { ChatView, ChatMessageView, MessageType } from '~/index';
import { sendSystemMessage } from './send-system-message';
import { ChatsStore } from '@main/store/chats';
import { areAddressesEqual } from '@shared/address-utils';

export async function renameChat(
  chatsStore: ChatsStore,
  chat: ChatView & { unread: number } & ChatMessageView<MessageType>,
  newChatName: string
): Promise<void> {
  const appStore = useAppStore();
  const me = appStore.user;
  const updatedChat: ChatView = {
    chatId: chat.chatId,
    name: newChatName,
    members: chat.members,
    admins: chat.admins,
    createdAt: chat.createdAt,
  };
  await appChatsSrvProxy.updateChat(updatedChat);
  chatsStore.chatList[chat.chatId].name = newChatName;

  const chatMessageId = getRandomId(chatIdLength);
  const msgId = await sendSystemMessage({
    chatId: chat.chatId,
    chatMessageId,
    recipients: chat.members.filter(addr => !areAddressesEqual(addr, me)),
    event: 'update:chatName',
    value: { name: newChatName },
    displayable: true,
  });
  const msgView: ChatMessageView<'outgoing'> = {
    msgId,
    attachments: [],
    messageType: 'outgoing',
    sender: me,
    body: 'rename.chat.system.message',
    chatId: chat.chatId,
    chatMessageType: 'system',
    chatMessageId,
    initialMessageId: null,
    timestamp: Date.now(),
    status: 'received',
  };

  await appChatsSrvProxy.upsertMessage(msgView);
  if (chat.chatId === chatsStore.currentChatId) {
    chatsStore.currentChatMessages.push(msgView);
  }
}
