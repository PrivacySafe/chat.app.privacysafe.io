import { appChatsSrvProxy } from '@main/services/services-provider';
import type { ChatsActions } from './types';

export const getChatMessage: ChatsActions['getChatMessage'] = async function(this, { msgId, chatMessageId }) {
  if (chatMessageId) {
    return appChatsSrvProxy.getMessage({ chatMsgId: chatMessageId });
  }

  if (msgId) {
    return appChatsSrvProxy.getMessage({ msgId });
  }

  return null;
};
