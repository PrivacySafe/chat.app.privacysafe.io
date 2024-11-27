import type { ChatMessageView, ChatView, MessageType } from '~/index';

export interface ChatMessagesProps {
  chat: ChatView & { unread: number } & ChatMessageView<MessageType>;
  messages: ChatMessageView<MessageType>[];
}

export interface ChatMessagesEmits {
  (ev: 'reply', value: ChatMessageView<MessageType>): void;
}
