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

import { getRandomId } from '@v1nt1248/3nclient-lib/utils';
import { useAppStore } from '@main/store/app';
import { msgIdLength } from '@main/constants';
import { appChatsSrvProxy } from '@main/services/services-provider';
import type { ChatView, ChatMessageView, MessageType } from '~/index';
import { sendSystemMessage } from '@main/ctrl-funcs';
import { ChatsStore } from '@main/store/chats';
import { includesAddress } from '@shared/address-utils';

export async function updateMembers(
  chatsStore: ChatsStore,
  chat: ChatView & { unread: number } & ChatMessageView<MessageType>,
  users: string[]
): Promise<void> {
  if (!chat || users.length === 0) {
    return;
  }

  const appStore = useAppStore();
  const me = appStore.user;
  const { members } = chat;

  // XXX fix these difference and without use string equal for addresses

  const membersToDelete = members.filter(addr => !includesAddress(users, addr));
  const membersUntouched = members.filter(addr => !membersToDelete.includes(addr));
  const membersToAdd = users.filter(addr => !includesAddress(members, addr));
  const updatedMembers = [...membersUntouched, ...membersToAdd];

  const updatedChat: ChatView = {
    chatId: chat.chatId,
    name: chat.name,
    members: updatedMembers,
    admins: chat.admins,
    createdAt: chat.createdAt,
  };

  await appChatsSrvProxy.updateChat(updatedChat);
  chatsStore.chatList[chat.chatId].members = updatedMembers;

  let msgViewOne: ChatMessageView<'outgoing'> | undefined;
  let msgViewTwo: ChatMessageView<'outgoing'> | undefined;
  const recipients = [...members, ...membersToAdd];

  if (membersToAdd.length > 0) {
    const chatMessageId = getRandomId(msgIdLength);
    const msgId = await sendSystemMessage({
      chatId: chat.chatId,
      chatMessageId,
      recipients,
      event: 'add:members',
      value: { membersToAdd, updatedMembers },
      displayable: true,
    });
    msgViewOne = {
      msgId,
      attachments: [],
      messageType: 'outgoing',
      sender: me,
      body: `[${membersToAdd.join(', ')}]add.members.system.message`,
      chatId: chat.chatId,
      chatMessageType: 'system',
      chatMessageId,
      initialMessageId: null,
      timestamp: Date.now(),
      status: 'received',
    };
  }

  if (membersToDelete.length > 0) {
    const chatMessageId = getRandomId(msgIdLength);
    const msgId = await sendSystemMessage({
      chatId: chat.chatId,
      chatMessageId,
      recipients,
      event: 'remove:members',
      value: { membersToDelete, updatedMembers },
      displayable: true,
    });
    msgViewTwo = {
      msgId,
      attachments: [],
      messageType: 'outgoing',
      sender: me,
      body: `[${membersToDelete.join(', ')}]remove.members.system.message`,
      chatId: chat.chatId,
      chatMessageType: 'system',
      chatMessageId,
      initialMessageId: null,
      timestamp: Date.now(),
      status: 'received',
    };
  }

  msgViewOne && await appChatsSrvProxy.upsertMessage(msgViewOne);
  msgViewTwo && await appChatsSrvProxy.upsertMessage(msgViewTwo);

  if (chat.chatId === chatsStore.currentChatId) {
    msgViewOne && chatsStore.currentChatMessages.push(msgViewOne);
    msgViewTwo && chatsStore.currentChatMessages.push(msgViewTwo);
  }
}
