import type { PiniaGetterTree } from '@v1nt1248/3nclient-lib/plugins';
import type { ChatsStore } from '../types';
import type { ChatListItemView, ChatMessageView, ChatView, MessageType } from '~/index';

export type Getters = {
  currentChat(): ChatView & { unread: number } & ChatMessageView<MessageType> | null;
  namedChatList(): (ChatListItemView & { displayName: string })[];
}

export type ChatsGetters = PiniaGetterTree<Getters, ChatsStore<Getters>>;
