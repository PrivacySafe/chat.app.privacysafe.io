import type { ChatsActions } from './types';
import { appChatsSrvProxy, appDeliverySrvProxy } from '@main/services/services-provider';
import { chatMessagesByType } from '@main/helpers/chats.helper';

export const deleteChat: ChatsActions['deleteChat'] = async function(this, chatId) {
  if (!chatId) {
    return;
  }

  const messages = chatId === this.currentChatId
    ? this.currentChatMessages
    : await appChatsSrvProxy.getMessagesByChat(chatId);

  const { incomingMessages = [], outgoingMessages = [] } = chatMessagesByType(messages);
  await appChatsSrvProxy.deleteChat(chatId);
  await appDeliverySrvProxy.removeMessageFromInbox(incomingMessages);
  await appDeliverySrvProxy.removeMessageFromDeliveryList(outgoingMessages);
};
