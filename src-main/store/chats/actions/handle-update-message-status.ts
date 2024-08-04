import { ChatsActions } from './types'
import { appChatsSrvProxy } from '../../../services/services-provider'

export const handleUpdateMessageStatus: ChatsActions['handleUpdateMessageStatus'] = async function (this, { msgId, chatMessageId, value }) {
  const message = await appChatsSrvProxy.getMessage({ chatMsgId: chatMessageId, msgId })
  if (message && message.status !== value) {
    message.status = value
    await appChatsSrvProxy.upsertMessage(message)
    if (message.chatId === this.currentChatId) {
      const updatedMessageIndex = this.currentChatMessages
        .findIndex(m => m.chatMessageId === chatMessageId || m.msgId === msgId)
      if (updatedMessageIndex > -1) {
        this.currentChatMessages[updatedMessageIndex].status = value
      }
    }
  }
}
