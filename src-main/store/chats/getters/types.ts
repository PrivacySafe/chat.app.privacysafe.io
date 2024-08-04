import { PiniaGetterTree } from '../../types'
import { ChatsStore } from '../types'

export type Getters = {
  currentChat(): ChatView & { unread: number } & ChatMessageView<MessageType> | null;
  namedChatList(): (ChatListItemView & { displayName: string })[];
}

export type ChatsGetters = PiniaGetterTree<Getters, ChatsStore<Getters>>
