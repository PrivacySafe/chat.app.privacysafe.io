import type { ChatsActions } from './types';
import { appChatsSrvProxy } from '@main/services/services-provider';

export const createChat: ChatsActions['createChat'] = async function(this, { chatId, members, admins, name = '' }) {
  let newChatId = '';
  try {
    newChatId = await appChatsSrvProxy.createChat({ chatId, members, admins, name });
    await this.getChatList();
  } catch (e) {
    console.error('CREATE CHAT ERROR: ', e);
  }
  return newChatId;
};
