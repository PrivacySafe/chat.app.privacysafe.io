import { ChatsActions } from './types'
import { appChatsSrvProxy } from '../../../services/services-provider'

export const handlerAddChatMembers: ChatsActions['handlerAddChatMembers'] = async function (this, params): Promise<void> {
  const { sender, chatId, msgId, chatMessageId, value, displayable } = params
  if (!chatId || (chatId && !value)) {
    return
  }

  const chat = await appChatsSrvProxy.getChat(chatId)
  if (chat) {
    const { membersToAdd = [], updatedMembers } = value as { membersToAdd: string[], updatedMembers: string[] }
    chat.members = updatedMembers
    await appChatsSrvProxy.updateChat(chat)
    await this.getChatList()

    if (displayable) {
      const msgView: ChatMessageView<'incoming'> = {
        msgId: msgId!,
        attachments: [],
        messageType: 'incoming',
        sender: sender!,
        body: `[${membersToAdd.join(', ')}]add.members.system.message`,
        chatId,
        chatMessageType: 'system',
        chatMessageId: chatMessageId!,
        initialMessageId: null,
        timestamp: Date.now(),
        status: 'received',
      }

      await appChatsSrvProxy.upsertMessage(msgView)
      if (chatId === this.currentChatId) {
        this.currentChatMessages.push(msgView)
      }
    }
  }
}
