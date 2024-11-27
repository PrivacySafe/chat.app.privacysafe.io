import without from 'lodash/without';
import type { ChatsActions } from './types';
import { appChatsSrvProxy } from '@main/services/services-provider';
import { chatIdLength } from '@main/constants';
import { useAppStore } from '@main/store';
import { getRandomId } from '@v1nt1248/3nclient-lib/utils';
import type { ChatView, ChatMessageView } from '~/index';

export const renameChat: ChatsActions['renameChat'] = async function(this, chat, newChatName) {
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
  this.chatList[chat.chatId].name = newChatName;

  const chatMessageId = getRandomId(chatIdLength);
  const msgId = await this.sendSystemMessage({
    chatId: chat.chatId,
    chatMessageId,
    recipients: without(chat.members, me),
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
  if (chat.chatId === this.currentChatId) {
    this.currentChatMessages.push(msgView);
  }
};
