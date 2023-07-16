import { ChatsActions } from './types'
import { appChatsSrvProxy, appDeliverySrvProxy } from '@/services/services-provider'
import { chatMessagesByType } from '@/helpers/chats.helper'

export const clearChat: ChatsActions['clearChat'] = async function (this, chatId) {
  if (!chatId) {
    return
  }

  const messages = chatId === this.currentChatId
    ? this.currentChatMessages
    : await appChatsSrvProxy.getMessagesByChat(chatId)

  const { incomingMessages = [], outgoingMessages = [] } = chatMessagesByType(messages)
  await appChatsSrvProxy.clearChat(chatId)
  await appDeliverySrvProxy.removeMessageFromInbox(incomingMessages)
  await appDeliverySrvProxy.removeMessageFromDeliveryList(outgoingMessages)
  if (chatId === this.currentChatId) {
    await this.getChat(chatId)
  } else {
    await this.getChatList()
  }
}
