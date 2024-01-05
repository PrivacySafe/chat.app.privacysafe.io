import { without } from 'lodash'
import { useAppStore } from '@/store'
import { ChatsActions } from './types'
import { deleteChatMessage } from '../../helpers/delete-chat-message.helper'

export const deleteMessage: ChatsActions['deleteMessage'] = async function (this, chatMsgId, deleteForEveryone) {
  if (!chatMsgId) {
    return
  }

  const appStore = useAppStore()
  const message = this.currentChatMessages.find(m => m.chatMessageId === chatMsgId)

  if (!message) {
    appStore.$createNotice({
      type: 'error',
      content: appStore.$i18n.tr('chat.message.delete.error.text'),
    })
    return
  }

  const { members = [], chatId } = this.currentChat()!
  await deleteChatMessage({ message, chatMsgId })
  await this.getChat(chatId)

  if (!deleteForEveryone) {
    return
  }

  const recipients = without(members, appStore.user)
  this.sendSystemMessage({
    chatId,
    chatMessageId: chatMsgId,
    recipients,
    event: 'delete:message',
    value: { chatMessageId: chatMsgId },
  })
}
