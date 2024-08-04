import { appChatsSrvProxy } from '../../../services/services-provider'
import { deleteChatMessage } from '../../helpers/delete-chat-message.helper'
import { ChatsActions } from './types'

export const handlerDeleteChatMessage: ChatsActions['handlerDeleteChatMessage'] = async function (this, { chatId, value }) {
  if (!chatId || (chatId && !value)) {
    return
  }

  const { chatMessageId } = value
  const message = await appChatsSrvProxy.getMessage({ chatMsgId: chatMessageId })

  if (!message) {
    return
  }

  await deleteChatMessage({ message, chatMsgId: chatMessageId })
  if (chatId === this.currentChatId) {
    this.getChat(chatId)
  } else {
    this.getChatList()
  }
}