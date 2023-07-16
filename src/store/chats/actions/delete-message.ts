import { without } from 'lodash'
import { useAppStore } from '@/store'
import { ChatsActions } from './types'
import { createSnackbar } from '@/helpers/forUi'
import { deleteChatMessage } from '../../helpers/delete-chat-message.helper'

export const deleteMessage: ChatsActions['deleteMessage'] = async function (this, chatMsgId, deleteForEveryone) {
  if (!chatMsgId) {
    return
  }

  const message = this.currentChatMessages.find(m => m.chatMessageId === chatMsgId)
 
  if (!message) {
    createSnackbar({
      type: 'error',
      content: 'An error occured while deleting the selected message',
    })
    return
  }

  const { members = [], chatId } = this.currentChat()!
  await deleteChatMessage({ message, chatMsgId })
  await this.getChat(chatId)

  if (!deleteForEveryone) {
    return
  }

  const appStore = useAppStore()
  const recipients = without(members, appStore.user)
  this.sendSystemMessage({
    chatId,
    chatMessageId: chatMsgId,
    recipients,
    event: 'delete:message',
    value: { chatMessageId: chatMsgId },
  })
}
