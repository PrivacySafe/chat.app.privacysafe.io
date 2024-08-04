import { difference, size, without } from 'lodash'
import { ChatsActions } from './types'
import { useAppStore } from '../..'
import { msgIdLength } from '../../../constants'
import { appChatsSrvProxy } from '../../../services/services-provider'
import { getRandomId } from '@v1nt1248/3nclient-lib'

export const updateMembers: ChatsActions['updateMembers'] = async function (this, chat, users): Promise<void> {
  if (!chat || size(users) === 0) {
    return
  }

  const appStore = useAppStore()
  const me = appStore.user
  const { members } = chat
  const membersToDelete = difference(members, users)
  const membersToAdd = difference(users, members)
  const updatedMembers = [...without(members, ...membersToDelete), ...membersToAdd]

  const updatedChat: ChatView = {
    chatId: chat.chatId,
    name: chat.name,
    members: updatedMembers,
    admins: chat.admins,
    createdAt: chat.createdAt,
  }

  await appChatsSrvProxy.updateChat(updatedChat)
  this.chatList[chat.chatId].members = updatedMembers

  let msgViewOne: ChatMessageView<'outgoing'>|undefined
  let msgViewTwo: ChatMessageView<'outgoing'>|undefined
  const recipients = [...members, ...membersToAdd]

  if (size(membersToAdd) > 0) {
    const chatMessageId = getRandomId(msgIdLength)
    const msgId = await this.sendSystemMessage({
      chatId: chat.chatId,
      chatMessageId,
      recipients,
      event: 'add:members',
      value: { membersToAdd, updatedMembers },
      displayable: true,
    })
    msgViewOne = {
      msgId,
      attachments: [],
      messageType: 'outgoing',
      sender: me,
      body: `[${membersToAdd.join(', ')}]add.members.system.message`,
      chatId: chat.chatId,
      chatMessageType: 'system',
      chatMessageId,
      initialMessageId: null,
      timestamp: Date.now(),
      status: 'received',
    }
  }

  if (size(membersToDelete) > 0) {
    const chatMessageId = getRandomId(msgIdLength)
    const msgId = await this.sendSystemMessage({
      chatId: chat.chatId,
      chatMessageId,
      recipients,
      event: 'remove:members',
      value: { membersToDelete, updatedMembers },
      displayable: true,
    })
    msgViewTwo = {
      msgId,
      attachments: [],
      messageType: 'outgoing',
      sender: me,
      body: `[${membersToDelete.join(', ')}]remove.members.system.message`,
      chatId: chat.chatId,
      chatMessageType: 'system',
      chatMessageId,
      initialMessageId: null,
      timestamp: Date.now(),
      status: 'received',
    }
  }

  msgViewOne && await appChatsSrvProxy.upsertMessage(msgViewOne)
  msgViewTwo && await appChatsSrvProxy.upsertMessage(msgViewTwo)

  if (chat.chatId === this.currentChatId) {
    msgViewOne && this.currentChatMessages.push(msgViewOne)
    msgViewTwo && this.currentChatMessages.push(msgViewTwo)
  }
}
