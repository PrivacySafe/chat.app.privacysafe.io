import { Store } from 'pinia';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import type { Actions } from './actions/types';
import type { ChatsGetters } from './getters/types';
import type { ChatListItemView, ChatMessageView, IncomingCallCmdArg, MessageType } from '~/index';

export interface State {
  chatList: Record<string, ChatListItemView>;
  currentChatId: Nullable<string>;
  currentChatMessages: ChatMessageView<MessageType>[];
  newChatDialogFlag: boolean;
  incomingCalls: IncomingCallCmdArg[];
}

export type ChatsStore<G = ChatsGetters> = Store<'chats', State, G, Actions>;
