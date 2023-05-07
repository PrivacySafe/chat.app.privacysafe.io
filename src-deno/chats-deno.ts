/* eslint-disable @typescript-eslint/triple-slash-reference, @typescript-eslint/no-explicit-any, max-len */
/// <reference path="../@types/platform-defs/injected-w3n.d.ts" />
/// <reference path="../@types/platform-defs/test-stand.d.ts" />
/// <reference path="../@types/app.d.ts" />
/// <reference path="../@types/contact.d.ts" />
/// <reference path="../@types/chat.d.ts" />
// @deno-types="./sqlite-on-3nstorage/index.d.ts"
import { SQLiteOn3NStorage } from './sqlite-on-3nstorage/index.js'
// @deno-types="./ipc-service.d.ts"
import { MultiConnectionIPCWrap } from './ipc-service.js'
// @ts-ignore
import { chatValueToSqlInsertParams, messageValueToSqlInsertParams, objectFromQueryExecResult } from './helpers/chats.helpers.ts'
// @ts-ignore
import { randomStr } from './helpers/random.ts'

type SqlValue = number | string | Blob | Uint8Array | null

const chatByIdQuery = 'SELECT * FROM chats WHERE chatId=$chatId'
const chatByMembersQuery = 'SELECT * FROM chats WHERE members=$members'
const chatsWithMessagesQuery = 'SELECT * FROM chats, messages WHERE chats.chatId=messages.chatId AND messages.timestamp=(SELECT Max(timestamp) FROM messages WHERE messages.chatId=chats.chatId)'
const chatsUnreadMessagesCountQuery = 'SELECT chatId, COUNT(*) AS unread FROM messages WHERE status="received" AND messageType="incoming" GROUP BY chatId'
const chatsWithoutMessagesQuery = 'SELECT * FROM chats WHERE NOT EXISTS (SELECT msgId FROM messages WHERE messages.chatId=chats.chatId)'
const insertChatQuery = 'INSERT INTO chats(chatId, name, members, createdAt) VALUES ($chatId, $name, $members, $createdAt)'
const upsertChatQuery = 'INSERT INTO chats(chatId, name, members, createdAt) VALUES ($chatId, $name, $members, $createdAt) ON CONFLICT(chatId) DO UPDATE SET chatId=$chatId, name=$name, members=$members, createdAt=$createdAt'
const deleteChatQuery = 'DELETE FROM chats WHERE chatId=$chatId'
const clearChatQuery = 'DELETE FROM messages WHERE chatId=$chatId'

const messagesByChatQuery = 'SELECT * FROM messages WHERE chatId=$chatId'
const messageByMsgIdQuery = 'SELECT * FROM messages WHERE msgId=$msgId'
const messageByChatMsgIdQuery = 'SELECT * FROM messages WHERE chatMessageId=$chatMessageId'
const deleteMessageByMsgId = 'DELETE FROM messages WHERE msgId=$msgId'
const deleteMessageByChatMsgId = 'DELETE FROM messages WHERE chatMessageId=$chatMessageId'
const insertMessageQuery = 'INSERT INTO messages(msgId, messageType, sender, body, attachments, chatId, chatMessageType, chatMessageId, initialMessageId, status, timestamp) VALUES ($msgId, $messageType, $sender, $body, $attachments, $chatId, $chatMessageType, $chatMessageId, $initialMessageId, $status, $timestamp)'
const upsertMessageQuery = 'INSERT INTO messages(msgId, messageType, sender, body, attachments, chatId, chatMessageType, chatMessageId, initialMessageId, status, timestamp) VALUES ($msgId, $messageType, $sender, $body, $attachments, $chatId, $chatMessageType, $chatMessageId, $initialMessageId, $status, $timestamp) ON CONFLICT(chatMessageId) DO UPDATE SET msgId=$msgId, messageType=$messageType, sender=$sender, body=$body, attachments=$attachments, chatId=$chatId, chatMessageType=$chatMessageType, chatMessageId=$chatMessageId, initialMessageId=$initialMessageId, status=$status, timestamp=$timestamp'

class ChatService {
  private readonly sqlite: SQLiteOn3NStorage

  constructor(
    sqlite: SQLiteOn3NStorage
  ) {
    this.sqlite = sqlite
  }

  static async initialization(): Promise<ChatService> {
    console.log('\n--- START CHAT SERVICE INITIALIZATION ---\n')
    const fs = await w3n.storage!.getAppSyncedFS()
    const file = await fs.writableFile('chats-db')
    const sqlite = await SQLiteOn3NStorage.makeAndStart(file)

    sqlite.db.exec(`CREATE TABLE IF NOT EXISTS chats (
      chatId TEXT PRIMARY KEY UNIQUE,
      name TEXT NOT NULL,
      members TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    ) STRICT`)

    sqlite.db.exec(`CREATE TABLE IF NOT EXISTS messages (
      chatMessageId TEXT PRIMARY KEY UNIQUE,
      msgId TEXT NOT NULL,
      messageType TEXT NOT NULL,
      sender TEXT,
      body TEXT NOT NULL,
      attachments BLOB,
      chatMessageType TEXT NOT NULL,
      initialMessageId TEXT,
      status TEXT,
      timestamp INTEGER NOT NULL,
      chatId TEXT NOT NULL,
      FOREIGN KEY (chatId) REFERENCES chats (chatId) ON DELETE CASCADE
    ) STRICT`)

    await sqlite.saveToFile({ skipUpload: true })
    return new ChatService(sqlite)
  }

  async createChat({ chatId, members, name }: { chatId?: string, members: string[], name: string }): Promise<string> {
    const membersAsString = JSON.stringify(members.sort())
    const [sqlValue] = this.sqlite.db.exec(chatByMembersQuery, { $members: membersAsString })
    if (!sqlValue) {
      try {
        const newChatId = chatId || randomStr(10)
        const params = chatValueToSqlInsertParams({
          chatId: newChatId,
          name,
          members,
          createdAt: Date.now(),
        })

        this.sqlite.db.exec(insertChatQuery, params as any)
        const countModifiedRow = this.sqlite.db.getRowsModified()
        if (countModifiedRow > 0) {
          await this.sqlite.saveToFile({ skipUpload: true })
        }
        return newChatId
      } catch (e) {
        console.error('\nCreate chat error: ', e)
        throw e
      }
    } else {
      const chatData = objectFromQueryExecResult<ChatViewForDB>(sqlValue)[0]
      const { chatId: currentChatId } = chatData
      return currentChatId
    }
  }

  async getChatList(): Promise<Array<ChatView & ChatMessageViewForDB<MessageType>>> {
    const [sqlValue1] = this.sqlite.db.exec(chatsWithMessagesQuery)
    const [sqlValue2] = this.sqlite.db.exec(chatsWithoutMessagesQuery)
    const chatsWithMessages = sqlValue1
      ? objectFromQueryExecResult(sqlValue1)
        .map(item => (
          {
            // @ts-ignore
            ...item,
            // @ts-ignore
            members: JSON.parse(item.members),
          }
        )) as Array<ChatView & ChatMessageViewForDB<MessageType>>
      : [] as Array<ChatView & ChatMessageViewForDB<MessageType>>
    const chatsWithoutMessages = sqlValue2
      ? objectFromQueryExecResult(sqlValue2)
        .map(item => (
          {
            // @ts-ignore
            ...item,
            // @ts-ignore
            members: JSON.parse(item.members),
          }
        )) as Array<ChatView & ChatMessageViewForDB<MessageType>>
      : [] as Array<ChatView & ChatMessageViewForDB<MessageType>>

    return [...chatsWithMessages, ...chatsWithoutMessages]
  }

  async getChatsUnreadMessagesCount(): Promise<Record<string, number>> {
    const [sqlValue] = this.sqlite.db.exec(chatsUnreadMessagesCountQuery)
    const res = sqlValue
      ? objectFromQueryExecResult<{ chatId: string, unread: number }>(sqlValue)
      : []

    return res.reduce((r: Record<string, number>, item: { chatId: string, unread: number }) => {
      const { chatId, unread } = item
      r[chatId] = unread
      return r
    }, {} as Record<string, number>)
  }

  async getChat(chatId: string): Promise<ChatView | null> {
    const [sqlValue] = this.sqlite.db.exec(chatByIdQuery, { $chatId: chatId })
    if (!sqlValue)
      return null

    const chatData = objectFromQueryExecResult<ChatViewForDB>(sqlValue)[0]
    return {
      ...chatData,
      members: JSON.parse(chatData.members),
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    if (chatId) {
      this.sqlite.db.exec(deleteChatQuery, { $chatId: chatId })
    }
  }

  async clearChat(chatId: string): Promise<void> {
    if (chatId) {
      this.sqlite.db.exec(clearChatQuery, { $chatId: chatId })
    }
  }

  async upsertMessage(value: ChatMessageViewForDB<MessageType>): Promise<void> {
    try {
      const params = messageValueToSqlInsertParams(value)
      this.sqlite.db.exec(upsertMessageQuery, params as any)
      const countModifiedRow = this.sqlite.db.getRowsModified()
      if (countModifiedRow > 0) {
        await this.sqlite.saveToFile({ skipUpload: true })
      }
    } catch (e) {
      console.error('\nUpsert message error: ', e)
      throw e
    }
  }

  async getMessage({ msgId, chatMsgId }: { msgId?: string, chatMsgId?: string }): Promise<ChatMessageViewForDB<MessageType>|null> {
    if (!msgId && !chatMsgId)
      return null

    const [sqlValue] =  chatMsgId
      ? this.sqlite.db.exec(messageByChatMsgIdQuery, { $chatMessageId: chatMsgId })
      : this.sqlite.db.exec(messageByMsgIdQuery, { $msgId: msgId! })

    const message = objectFromQueryExecResult<ChatMessageViewForDB<MessageType>>(sqlValue)[0]
    return message
  }

  async deleteMessage({ msgId, chatMsgId }: { msgId?: string, chatMsgId?: string }): Promise<void> {
    if (!msgId && !chatMsgId)
      return

    if (chatMsgId) {
      this.sqlite.db.exec(deleteMessageByChatMsgId, { $chatMessageId: chatMsgId })
    } else {
      this.sqlite.db.exec(deleteMessageByMsgId, { $msgId: msgId! })
    }
  }

  async getMessagesByChat(chatId: string): Promise<ChatMessageViewForDB<MessageType>[]> {
    const [sqlValue] = this.sqlite.db.exec(messagesByChatQuery, { $chatId: chatId })
    if (!sqlValue)
      return []

    const messages = objectFromQueryExecResult(sqlValue) as ChatMessageViewForDB<MessageType>[]
    return messages
  }
}

ChatService.initialization()
  .then(async srv => {
    const srvWrapInternal = new MultiConnectionIPCWrap('AppChatsInternal')
    srvWrapInternal.exposeReqReplyMethods(srv, [
      'createChat',
      'getChatList',
      'getChatsUnreadMessagesCount',
      'getChat',
      'deleteChat',
      'clearChat',
      'getMessage',
      'deleteMessage',
      'getMessagesByChat',
      'upsertMessage',
    ])
    srvWrapInternal.startIPC()
  })
  .catch(err => {
    console.error(`Error in a startup of chats service component`, err)
    setTimeout(() => w3n.closeSelf!(), 100)
  })
