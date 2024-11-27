import type { State } from './types';

export const state: State = {
  chatList: {},
  currentChatId: null,
  currentChatMessages: [],
  newChatDialogFlag: false,
  incomingCalls: [],
};
