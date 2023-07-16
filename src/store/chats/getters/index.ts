import { get } from 'lodash'
import { ChatsGetters } from './types'
import { getChatName } from '@/helpers/chat-ui.helper'

export const getters: ChatsGetters = {
  currentChat: function(this, state) {
    return () => {
      if (state.currentChatId) {
        return get(state, ['chatList', state.currentChatId], null)
      }
      return null
    }
  },

  namedChatList: function(this, state) {
    return () => {
      return Object.values(state.chatList).map(c => ({
        ...c,
        displayName: getChatName(c),
      }))
    }
  },
}
