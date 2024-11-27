import without from 'lodash/without';
import type { ChatsActions } from './types';
import { appChatsSrvProxy, appDeliverySrvProxy } from '@main/services/services-provider';
import { msgIdLength } from '@main/constants';
import { getRandomId } from '@v1nt1248/3nclient-lib/utils';
import { chatMessagesByType } from '@main/helpers/chats.helper';

export const leaveChat: ChatsActions['leaveChat'] = async function(this, chat, users, isRemoved = false) {
  if (!chat) {
    return;
  }

  const messages = chat.chatId === this.currentChatId
    ? this.currentChatMessages
    : await appChatsSrvProxy.getMessagesByChat(chat.chatId);

  const { incomingMessages = [], outgoingMessages = [] } = chatMessagesByType(messages);
  const chatMembers = chat.members;
  const recipients = without(chatMembers, ...users);

  await appChatsSrvProxy.deleteChat(chat.chatId);
  await appDeliverySrvProxy.removeMessageFromInbox(incomingMessages);
  await appDeliverySrvProxy.removeMessageFromDeliveryList(outgoingMessages);
  const chatMessageId = getRandomId(msgIdLength);

  this.sendSystemMessage({
    chatId: chat.chatId,
    chatMessageId,
    recipients,
    event: 'delete:members',
    value: { users, isRemoved },
    displayable: true,
  });
};
