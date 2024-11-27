import without from 'lodash/without';
import type { ChatsActions } from './types';
import { appChatsSrvProxy } from '@main/services/services-provider';
import type { ChatMessageView } from '~/index';

export const handlerDeleteChatMembers: ChatsActions['handlerDeleteChatMembers'] = async function(this, {
  msgId,
  chatId,
  chatMessageId,
  value,
  displayable,
  sender = '',
}) {
  if (!chatId || (chatId && !value)) {
    return;
  }

  const chat = await appChatsSrvProxy.getChat(chatId);
  if (chat) {
    const { members } = chat;
    const { users, isRemoved } = value as { users: string[], isRemoved: boolean };

    chat.members = without(members, ...users);

    await appChatsSrvProxy.updateChat(chat);
    await this.getChatList();

    if (displayable) {
      let messageText = `[${users.join(',')}]`;
      if (!isRemoved) {
        messageText += 'leave.chat.system.message';
      } else {
        messageText = users.length > 1
          ? messageText + 'delete.members.system.message'
          : messageText + 'delete.member.system.message';
      }

      const msgView: ChatMessageView<'incoming'> = {
        msgId: msgId!,
        attachments: [],
        messageType: 'incoming',
        sender,
        body: messageText,
        chatId,
        chatMessageType: 'system',
        chatMessageId: chatMessageId!,
        initialMessageId: null,
        timestamp: Date.now(),
        status: 'received',
      };

      await appChatsSrvProxy.upsertMessage(msgView);
      if (chatId === this.currentChatId) {
        this.currentChatMessages.push(msgView);
      }
    }
  }
};
