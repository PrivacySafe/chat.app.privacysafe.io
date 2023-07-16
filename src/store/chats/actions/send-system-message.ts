import { ChatsActions } from './types'
import { appChatsSrvProxy, appDeliverySrvProxy } from '@/services/services-provider'
import { msgIdLength } from '@/constants'
import { getRandomId } from '@/helpers/common.helper'

export const sendSystemMessage: ChatsActions['sendSystemMessage'] = async function (this, { chatId, chatMessageId, recipients, event, value, displayable = false }) {
  const chat = await appChatsSrvProxy.getChat(chatId)
  const { members = [], admins = [], name } = chat || {}

  const msgId = getRandomId(msgIdLength)
  const msgData: ChatOutgoingMessage = {
    msgId,
    msgType: 'chat',
    recipients,
    jsonBody: {
      chatId,
      chatMessageType: 'system',
      ...(chat && name && { chatName: name }),
      members,
      admins,
      chatMessageId,
      chatSystemData: { event, value, displayable },
    },
  }
  appDeliverySrvProxy.addMessageToDeliveryList(msgData, `chat:${chatId}:${msgId}:system`)
  return msgId
}
