import type { ChatsActions } from './types';
import { appChatsSrvProxy } from '@main/services/services-provider';
import type { ChatMessageView } from '~/index';

export const handleUpdateChatName: ChatsActions['handleUpdateChatName'] = async function(this, {
  chatId,
  chatMessageId,
  value,
  msgId,
  sender = '',
}) {
  if (!chatId || !msgId || !chatMessageId) {
    return;
  }

  const chat = await appChatsSrvProxy.getChat(chatId);
  if (chat) {
    const { name } = value as { name: string };
    chat.name = name;
    await appChatsSrvProxy.updateChat(chat);
    await this.getChatList();

    const msgView: ChatMessageView<'incoming'> = {
      msgId,
      attachments: [],
      messageType: 'incoming',
      sender,
      body: 'rename.chat.system.message',
      chatId,
      chatMessageType: 'system',
      chatMessageId,
      initialMessageId: null,
      timestamp: Date.now(),
      status: 'received',
    };

    await appChatsSrvProxy.upsertMessage(msgView);
    if (chatId === this.currentChatId) {
      this.currentChatMessages.push(msgView);
    }
  }
};
