import { without } from 'lodash'
import { ChatsActions } from './types'
import { appChatsSrvProxy, appDeliverySrvProxy } from '@/services/services-provider'
import { msgIdLength } from '@/constants'
import { getRandomId } from '@/helpers/common.helper'
import { chatMessagesByType } from '@/helpers/chats.helper'

export const leaveChat: ChatsActions['leaveChat'] = async function (this, chat, users, isRemoved = false) {
  if (!chat) {
    return
  }

  const messages = chat.chatId === this.currentChatId
    ? this.currentChatMessages
    : await appChatsSrvProxy.getMessagesByChat(chat.chatId)

  const { incomingMessages = [], outgoingMessages = [] } = chatMessagesByType(messages)
  const chatMembers = chat.members
  const recipients = without(chatMembers, ...users)

  await appChatsSrvProxy.deleteChat(chat.chatId)
  await appDeliverySrvProxy.removeMessageFromInbox(incomingMessages)
  await appDeliverySrvProxy.removeMessageFromDeliveryList(outgoingMessages)
  const chatMessageId = getRandomId(msgIdLength)

  this.sendSystemMessage({
    chatId: chat.chatId,
    chatMessageId,
    recipients,
    event: 'delete:members',
    value: { users, isRemoved },
    displayable: true,
  })
}
