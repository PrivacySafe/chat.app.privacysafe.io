import get from 'lodash/get';
import type { ChatsGetters } from './types';
import { getChatName } from '@main/helpers/chat-ui.helper';

export const getters: ChatsGetters = {
  currentChat: function(this, state) {
    return () => {
      if (state.currentChatId) {
        return get(state, ['chatList', state.currentChatId], null);
      }
      return null;
    };
  },

  namedChatList: function(this, state) {
    return () => {
      return Object.values(state.chatList)
        .map(c => ({
          ...c,
          displayName: getChatName(c),
        }))
        .sort((a, b) => {
          const tA = a.timestamp || a.createdAt;
          const tB = b.timestamp || b.createdAt;
          return tB - tA;
        });
    };
  },
};
