import { appChatsSrvProxy } from '@main/services/services-provider';
import { deleteChatMessage } from '@main/store/utils/delete-chat-message.helper';
import type { ChatsActions } from './types';

export const handlerDeleteChatMessage: ChatsActions['handlerDeleteChatMessage'] = async function(this, {
  chatId,
  value,
}) {
  if (!chatId || (chatId && !value)) {
    return;
  }

  const { chatMessageId } = value;
  const message = await appChatsSrvProxy.getMessage({ chatMsgId: chatMessageId });

  if (!message) {
    return;
  }

  await deleteChatMessage({ message, chatMsgId: chatMessageId });
  if (chatId === this.currentChatId) {
    await this.getChat(chatId);
  } else {
    await this.getChatList();
  }
};
