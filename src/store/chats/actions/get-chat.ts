import { ChatsActions } from './types'
import { appChatsSrvProxy } from '@/services/services-provider'

export const getChat: ChatsActions['getChat'] = async function (this, chatId) {
  await this.getChatList()
  if (!chatId) {
    this.currentChatId = null
    this.currentChatMessages = []
  } else {
    this.currentChatId = chatId
    this.currentChatMessages = this.currentChat()
      ? await appChatsSrvProxy.getMessagesByChat(chatId)
      : []
  }
}
