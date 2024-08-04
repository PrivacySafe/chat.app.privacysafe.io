import { Store } from 'pinia'
import { Actions } from './actions/types'
import { ChatsGetters } from './getters/types'

export interface State {
  chatList: Record<string, ChatListItemView>;
  currentChatId: string|null;
  currentChatMessages: ChatMessageView<MessageType>[];
}

export type ChatsStore<G = ChatsGetters> = Store<'chats', State, G, Actions>
