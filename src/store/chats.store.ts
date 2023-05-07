/* eslint-disable object-curly-newline, @typescript-eslint/no-explicit-any */
import { defineStore } from 'pinia'
import { get, isEmpty, size, without } from 'lodash'
import { appChatsSrvProxy, appDeliverySrvProxy } from '@/services/services-provider'
import { randomStr } from '@/services/base/random'
import { useAppStore } from './app.store'

type SystemMessageHandlerParams = {
  msgId?: string;
  chatId?: string;
  chatMessageId?: string;
  value?: any;
  displayable?: boolean;
}

// @ts-ignore
const systemMessageHandlers: Record<Partial<ChatSystemEvent>, string> = {
  'update:status': 'updateMessageStatus',
}

export const useChatsStore = defineStore(
  'chats',
  {
    state: () => ({
      chatList: {} as Record<string, ChatView & { unread: number } & ChatMessageViewForDB<MessageType>>,
      currentChatId: null as string|null,
      currentChatMessages: [] as ChatMessageViewForDB<MessageType>[],
    }),

    getters: {
      currentChat(state): ChatView & { unread: number } & ChatMessageViewForDB<MessageType>|null {
        return state.currentChatId
          ? get(state, ['chatList', state.currentChatId], null)
          : null
      },
      currentChatName(): string {
        return get(this.currentChat, 'name', '')
      },
    },

    actions: {
      async getChatList(): Promise<Record<string, ChatView & { unread: number } & ChatMessageViewForDB<MessageType>>> {
        console.log('\nGET CHAT LIST')

        const res = await appChatsSrvProxy.getChatList()
        const unreadMessagesCount = await appChatsSrvProxy.getChatsUnreadMessagesCount()

        this.chatList = res.reduce((r, item) => {
          r[item.chatId] = {
            ...item,
            unread: unreadMessagesCount[item.chatId] || 0,
          }
          return r
        }, {} as Record<string, ChatView & { unread: number } & ChatMessageViewForDB<MessageType>>)
        return this.chatList
      },

      async createChat({ chatId, members, name }:
        { chatId?: string, members: string[], name: string },
      ): Promise<string> {
        let newChatId = ''
        try {
          newChatId = await appChatsSrvProxy.createChat({ chatId, members, name })
          console.log('\n(CLIENT) CREATE CHAT WITH ', members.join(', '))
          await this.getChatList()
        } catch (e) {
          console.error('\nCREATE CHAT ERROR: ', e)
        }
        return newChatId
      },

      async getChat(chatId: string | null): Promise<void> {
        if (!chatId) {
          this.currentChatId = null
          this.currentChatMessages = []
        } else {
          if (isEmpty(this.chatList)) {
            await this.getChatList()
          }

          this.currentChatId = chatId
          this.currentChatMessages = this.currentChat
            ? await appChatsSrvProxy.getMessagesByChat(chatId)
            : []
        }
      },

      async sendMessages(msg: ChatOutgoingMessage): Promise<void> {
        const appStore = useAppStore()
        // TODO code is made without taking into account file transfer
        const {
          msgId,
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
        const msgView: ChatMessageViewForDB<'outgoing'> = {
          chatMessageId,
          msgId: msgId!,
          messageType: 'outgoing',
          sender: appStore.user,
          body: plainTxtBody! || htmlTxtBody!,
          attachments: null,
          chatId: chatId!,
          chatMessageType: chatMessageType || 'regular',
          initialMessageId: initialMessageId || null,
          status,
          timestamp: Date.now(),
        }

        console.log('\nUPSERT MESSAGE (send): ', msgView.chatMessageId)
        await appChatsSrvProxy.upsertMessage(msgView)
        this.currentChatMessages.push(msgView)
        appStore.$emitter.emit('send:message', { chatId })
        await this.getChatList()

        appDeliverySrvProxy.addMessageToDeliveryList(msg, metaPath)
      },

      async updateMessageStatus({ msgId, chatMessageId, value }: SystemMessageHandlerParams): Promise<void> {
        const message = await appChatsSrvProxy.getMessage({ chatMsgId: chatMessageId, msgId })
        if (message) {
          message.status = value
          await appChatsSrvProxy.upsertMessage(message)
          if (message.chatId === this.currentChatId) {
            const updatedMessageIndex = this.currentChatMessages
              .findIndex(m => m.chatMessageId === chatMessageId)
            if (updatedMessageIndex > -1) {
              this.currentChatMessages[updatedMessageIndex].status = value
            }
          }
        }
      },

      async sendSystemMessage(
        { chatId, chatMessageId, recipients, event, value  }:
          { chatId: string, chatMessageId: string, recipients: string[], event: ChatSystemEvent, value: any },
      ): Promise<void> {
        const msgId = randomStr(8)
        const msgData: ChatOutgoingMessage = {
          msgId,
          msgType: 'chat',
          recipients,
          jsonBody: {
            chatId,
            chatMessageType: 'system',
            members: [],
            chatMessageId,
            chatSystemData: { event, value },
          },
        }
        appDeliverySrvProxy.addMessageToDeliveryList(msgData, `chat:${chatId}:${msgId}`)
      },

      async receiveMessage(me: string, msg: ChatIncomingMessage, currentChatId: string|null): Promise<void> {
        const {
          jsonBody,
          msgId,
          plainTxtBody,
          htmlTxtBody,
          sender,
        } = msg
        const {
          chatId,
          chatMessageType = 'regular',
          chatMessageId,
          members,
          chatName,
          initialMessageId,
          chatSystemData = {} as ChatSystemMessageData,
        } = jsonBody
        const isChatPresent = Object.keys(this.chatList).includes(chatId!)
        if (!isChatPresent) {
          const msgRecipients = without(members, me)
          const name = size(msgRecipients) > 1
            ? chatName || 'Group chat'
            : get(msgRecipients, 0, 'Untitled')
          await this.createChat({ chatId, members, name })
        }

        switch (chatMessageType) {
          case 'system':
            const { event,  value, displayable = false} = chatSystemData
            const systemMessageHandler = systemMessageHandlers[event]
            //@ts-ignore
            systemMessageHandler && this[systemMessageHandler] && await this[systemMessageHandler]({
              chatId, msgId, chatMessageId, value, displayable,
            })
            break
          default:
            const msgView: ChatMessageViewForDB<'incoming'> = {
              msgId,
              messageType: 'incoming',
              sender,
              body: plainTxtBody! || htmlTxtBody!,
              attachments: null, // FixMe
              chatId,
              chatMessageType,
              chatMessageId,
              initialMessageId: initialMessageId || null,
              timestamp: Date.now(),
              status: 'received',
            }
            console.log('\nUPSERT MESSAGE (receive): ', msgView.chatMessageId)
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
            break
        }
      },
    },
  },
)
