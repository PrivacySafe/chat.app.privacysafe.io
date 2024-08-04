import { size, without } from 'lodash'
import { ChatsActions } from './types'
import { appChatsSrvProxy, appDeliverySrvProxy } from '../../../services/services-provider'
import { useContactsStore } from '../..'
import { getAttachmentFilesInfo } from '../../../helpers/chats.helper'

const systemMessageHandlers: Partial<Record<ChatSystemEvent, string>> = {
  'update:status': 'handleUpdateMessageStatus',
  'update:chatName': 'handleUpdateChatName',
  'delete:members': 'handlerDeleteChatMembers',
  'add:members': 'handlerAddChatMembers',
  'remove:members': 'handlerRemoveChatMembers',
  'delete:message': 'handlerDeleteChatMessage',
}

export const receiveMessage: ChatsActions['receiveMessage'] = async function (this, { me, msg, currentChatId }) {
  const contactsStore = useContactsStore()
  await contactsStore.fetchContactList()

  const {
    jsonBody,
    msgId,
    attachments,
    plainTxtBody,
    htmlTxtBody,
    sender,
  } = msg
  const {
    chatId,
    chatMessageType = 'regular',
    chatMessageId,
    members,
    admins = [],
    chatName,
    initialMessageId,
    chatSystemData = {} as ChatSystemMessageData,
  } = jsonBody
  const isChatPresent = Object.keys(this.chatList).includes(chatId!)

  if (!isChatPresent) {
    const msgRecipients = without(members, me)
    const name = size(msgRecipients) > 1
      ? chatName || 'Group chat'
      : chatName || sender
    await this.createChat({ chatId, members, admins, name })
  }

  switch (chatMessageType) {
    case 'system':
      const { event,  value, displayable = false} = chatSystemData
      const systemMessageHandler = systemMessageHandlers[event]
      //@ts-ignore
      systemMessageHandler && this[systemMessageHandler] && await this[systemMessageHandler]({
        chatId, msgId, sender, chatMessageId, value, displayable,
      })
      break
    default:
      const msgView: ChatMessageView<'incoming'> = {
        msgId,
        attachments: await getAttachmentFilesInfo({ incomingAttachments: attachments }),
        messageType: 'incoming',
        sender,
        body: plainTxtBody! || htmlTxtBody! || '',
        chatId,
        chatMessageType,
        chatMessageId,
        initialMessageId: initialMessageId || null,
        timestamp: Date.now(),
        status: 'received',
      }

      await appChatsSrvProxy.upsertMessage(msgView)
      if (chatId === currentChatId) {
        this.currentChatMessages.push(msgView)
      }
      await this.getChatList()
      this.sendSystemMessage({
        chatId,
        chatMessageId,
        recipients: [sender],
        event: 'update:status',
        value: 'received',
      })
      if (!attachments) {
        appDeliverySrvProxy.removeMessageFromInbox([msgId])
      }
      break
  }
}
