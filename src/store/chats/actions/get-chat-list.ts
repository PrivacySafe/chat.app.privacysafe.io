import { ChatsActions } from './types'
import { appChatsSrvProxy } from '@/services/services-provider'

export const getChatList: ChatsActions['getChatList'] = async function (this) {
  const res = await appChatsSrvProxy.getChatList()
  const unreadMessagesCount = await appChatsSrvProxy.getChatsUnreadMessagesCount()

  this.chatList = res.reduce((r, item) => {
    r[item.chatId] = {
      ...item,
      unread: unreadMessagesCount[item.chatId] || 0,
    }
    return r
  }, {} as Record<string, ChatView & { unread: number } & ChatMessageView<MessageType>>)
  return this.chatList
}
