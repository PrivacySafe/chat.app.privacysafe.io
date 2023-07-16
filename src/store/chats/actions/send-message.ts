import { ChatsActions } from './types'
import { appChatsSrvProxy, appDeliverySrvProxy } from '@/services/services-provider'
import { useAppStore } from '@/store'
import { getAttachmentFilesInfo } from '@/helpers/chats.helper'

export const sendMessage: ChatsActions['sendMessage'] = async function (this, msg) {
  const appStore = useAppStore()
  const {
    msgId,
    attachments,
    jsonBody,
    plainTxtBody,
    htmlTxtBody,
    status,
  } = msg
  const {
    chatId,
    chatMessageType,
    chatMessageId,
    initialMessageId,
  } = jsonBody
  const metaPath: ChatMessageLocalMeta = `chat:${chatId}:${msgId}`

  const msgView: ChatMessageView<'outgoing'> = {
    chatMessageId,
    msgId: msgId!,
    messageType: 'outgoing',
    sender: appStore.user,
    body: plainTxtBody! || htmlTxtBody! || '',
    attachments: await getAttachmentFilesInfo({ outgoingAttachments: attachments! }),
    chatId: chatId!,
    chatMessageType: chatMessageType || 'regular',
    initialMessageId: initialMessageId || null,
    status,
    timestamp: Date.now(),
  }

  await appChatsSrvProxy.upsertMessage(msgView)
  this.currentChatMessages.push(msgView)
  appStore.$emitter.emit('send:message', { chatId })
  await this.getChatList()

  appDeliverySrvProxy.addMessageToDeliveryList(msg, metaPath)
}
