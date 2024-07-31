/*
 Copyright (C) 2020 - 2024 3NSoft Inc.

 This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU General Public License as published by the Free Software
 Foundation, either version 3 of the License, or (at your option) any later
 version.

 This program is distributed in the hope that it will be useful, but
 WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 this program. If not, see <http://www.gnu.org/licenses/>.
*/

/* eslint-disable @typescript-eslint/triple-slash-reference, @typescript-eslint/no-explicit-any, max-len */
/// <reference path="../@types/platform-defs/injected-w3n.d.ts" />
/// <reference path="../@types/platform-defs/test-stand.d.ts" />
/// <reference path="../@types/app.d.ts" />
/// <reference path="../@types/contact.d.ts" />
/// <reference path="../@types/chat.d.ts" />
// @deno-types="./sqlite-on-3nstorage/index.d.ts"
import { SQLiteOn3NStorage } from './helpers/sqlite-on-3nstorage/index.js'
// @deno-types="./ipc-service.d.ts"
import { MultiConnectionIPCWrap } from './helpers/ipc-service.js'
import { chatValueToSqlInsertParams, messageValueToSqlInsertParams, objectFromQueryExecResult } from './helpers/chats.helpers.ts'
import { getRandomId } from './helpers/common.helpers.ts'

type FSSyncException = web3n.files.FSSyncException;

type SqlValue = number | string | Blob | Uint8Array | null

const chatByIdQuery = 'SELECT * FROM chats WHERE chatId=$chatId'
const chatByMembersQuery = 'SELECT * FROM chats WHERE members=$members'
const chatsWithMessagesQuery = 'SELECT * FROM chats, messages WHERE chats.chatId=messages.chatId AND messages.timestamp=(SELECT Max(timestamp) FROM messages WHERE messages.chatId=chats.chatId)'
const chatsUnreadMessagesCountQuery = 'SELECT chatId, COUNT(*) AS unread FROM messages WHERE status="received" AND messageType="incoming" AND chatMessageType="regular" GROUP BY chatId'
const chatsWithoutMessagesQuery = 'SELECT * FROM chats WHERE NOT EXISTS (SELECT msgId FROM messages WHERE messages.chatId=chats.chatId)'
const insertChatQuery = 'INSERT INTO chats(chatId, name, members, admins, createdAt) VALUES ($chatId, $name, $members, $admins, $createdAt)'
const upsertChatQuery = 'INSERT INTO chats(chatId, name, members, admins, createdAt) VALUES ($chatId, $name, $members, $admins, $createdAt) ON CONFLICT(chatId) DO UPDATE SET chatId=$chatId, name=$name, members=$members, admins=$admins, createdAt=$createdAt'
const deleteChatQuery = 'PRAGMA foreign_keys=ON; DELETE FROM chats WHERE chatId=$chatId'
const clearChatQuery = 'DELETE FROM messages WHERE chatId=$chatId'

const messagesByChatQuery = 'SELECT * FROM messages WHERE chatId=$chatId'
const messageByMsgIdQuery = 'SELECT * FROM messages WHERE msgId=$msgId'
const messageByChatMsgIdQuery = 'SELECT * FROM messages WHERE chatMessageId=$chatMessageId'
// const deleteMessageByChatId = 'DELETE FROM messages WHERE chatId=$chatId'
const deleteMessageByMsgId = 'DELETE FROM messages WHERE msgId=$msgId'
const deleteMessageByChatMsgId = 'DELETE FROM messages WHERE chatMessageId=$chatMessageId'
const insertMessageQuery = 'INSERT INTO messages(msgId, messageType, sender, body, attachments, chatId, chatMessageType, chatMessageId, initialMessageId, status, timestamp) VALUES ($msgId, $messageType, $sender, $body, $attachments, $chatId, $chatMessageType, $chatMessageId, $initialMessageId, $status, $timestamp)'
const upsertMessageQuery = 'INSERT INTO messages(msgId, messageType, sender, body, attachments, chatId, chatMessageType, chatMessageId, initialMessageId, status, timestamp) VALUES ($msgId, $messageType, $sender, $body, $attachments, $chatId, $chatMessageType, $chatMessageId, $initialMessageId, $status, $timestamp) ON CONFLICT(chatMessageId) DO UPDATE SET msgId=$msgId, messageType=$messageType, sender=$sender, body=$body, attachments=$attachments, chatId=$chatId, chatMessageType=$chatMessageType, chatMessageId=$chatMessageId, initialMessageId=$initialMessageId, status=$status, timestamp=$timestamp'

export class ChatService {
  private readonly sqlite: SQLiteOn3NStorage

  constructor(
    sqlite: SQLiteOn3NStorage
  ) {
    this.sqlite = sqlite
  }

  static async initialization(): Promise<ChatService> {
    const fs = await w3n.storage!.getAppSyncedFS()
    const file = await fs.writableFile('chats-db')
    const sqlite = await SQLiteOn3NStorage.makeAndStart(file)

    sqlite.db.exec(`CREATE TABLE IF NOT EXISTS chats (
      chatId TEXT PRIMARY KEY UNIQUE,
      name TEXT,
      members TEXT NOT NULL,
      admins TEXT NOT NULL,
      createdAt INTEGER NOT NULL
    ) STRICT`)

    sqlite.db.exec(`CREATE TABLE IF NOT EXISTS messages (
      chatMessageId TEXT PRIMARY KEY UNIQUE,
      msgId TEXT NOT NULL,
      messageType TEXT NOT NULL,
      sender TEXT,
      body TEXT NOT NULL,
      attachments TEXT,
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

  async saveDbFile() {
    const countModifiedRow = this.sqlite.db.getRowsModified()
    if (countModifiedRow > 0) {
      await this.sqlite.saveToFile({ skipUpload: true })
      .catch((exc: FSSyncException) => {
        if ((exc.type === 'fs-sync') && exc.alreadyUploading) {
          return  // explicit do nothing
        } else {
          w3n.log!('error', `Error is thrown when saving file chat db file`, exc)
        }
      })
    }
  }

  async createChat({ chatId, members, admins, name }: { chatId?: string, members: string[], admins: string[], name: string }): Promise<string> {
    const membersAsString = JSON.stringify(members.sort())
    const [sqlValue] = this.sqlite.db.exec(chatByMembersQuery, { $members: membersAsString })
    if (!sqlValue) {
      try {
        const newChatId = chatId || getRandomId(10)
        const params = chatValueToSqlInsertParams({
          chatId: newChatId,
          name,
          members,
          admins,
          createdAt: Date.now(),
        })

        this.sqlite.db.exec(insertChatQuery, params as any)
        await this.saveDbFile()
        return newChatId
      } catch (e) {
        w3n.log!('error', 'Create chat throw error', e)
        throw e
      }
    } else {
      const chatData = objectFromQueryExecResult<ChatViewForDB>(sqlValue)[0]
      const { chatId: currentChatId } = chatData
      return currentChatId
    }
  }

  async updateChat(value: ChatView): Promise<void> {
    try {
      const params = chatValueToSqlInsertParams(value)
      this.sqlite.db.exec(upsertChatQuery, params as any)
      await this.saveDbFile()
    } catch (e) {
      w3n.log!('error', 'Update chat throws error', e)
      throw e
    }
  }

  async getChatList(): Promise<Array<ChatView & ChatMessageView<MessageType>>> {
    const [sqlValue1] = this.sqlite.db.exec(chatsWithMessagesQuery)
    const [sqlValue2] = this.sqlite.db.exec(chatsWithoutMessagesQuery)
    const chatsWithMessages = sqlValue1
      ? objectFromQueryExecResult<ChatView & ChatMessageView<MessageType> & { members: string, admins: string, attachments: string }>(sqlValue1)
        .map(item => (
          {
            ...item,
            members: JSON.parse(item.members),
            admins: JSON.parse(item.admins),
            attachments: item.attachments ? JSON.parse(item.attachments) : [],
          }
        )) as Array<ChatView & ChatMessageView<MessageType>>
      : [] as Array<ChatView & ChatMessageView<MessageType>>
    const chatsWithoutMessages = sqlValue2
      ? objectFromQueryExecResult<ChatView & ChatMessageView<MessageType> & { members: string, admins: string, attachments: string }>(sqlValue2)
        .map(item => (
          {
            ...item,
            members: JSON.parse(item.members),
            admins: JSON.parse(item.admins),
            attachments: item.attachments ? JSON.parse(item.attachments) : [],
          }
        )) as Array<ChatView & ChatMessageView<MessageType>>
      : [] as Array<ChatView & ChatMessageView<MessageType>>

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
      admins: JSON.parse(chatData.admins),
    }
  }

  async deleteChat(chatId: string): Promise<void> {
    if (chatId) {
      this.sqlite.db.exec(deleteChatQuery, { $chatId: chatId })
      await this.saveDbFile()
    }
  }

  async clearChat(chatId: string): Promise<void> {
    if (chatId) {
      this.sqlite.db.exec(clearChatQuery, { $chatId: chatId })
      await this.saveDbFile()
    }
  }

  async upsertMessage(value: ChatMessageView<MessageType>): Promise<void> {
    try {
      const params = messageValueToSqlInsertParams(value)
      this.sqlite.db.exec(upsertMessageQuery, params as any)
      await this.saveDbFile()
    } catch (e) {
      console.error('\nUpsert message error: ', e)
      throw e
    }
  }

  async getMessage({ msgId, chatMsgId }: { msgId?: string, chatMsgId?: string }): Promise<ChatMessageView<MessageType>|null> {
    if (!msgId && !chatMsgId)
      return null

    const [sqlValue] =  chatMsgId
      ? this.sqlite.db.exec(messageByChatMsgIdQuery, { $chatMessageId: chatMsgId })
      : this.sqlite.db.exec(messageByMsgIdQuery, { $msgId: msgId! })

    const message = objectFromQueryExecResult<ChatMessageViewForDB<MessageType>>(sqlValue)[0]
    return message
      ? {
        ...message,
        attachments: message.attachments ? JSON.parse(message.attachments) : null,
      }
    : null
  }

  async deleteMessage({ msgId, chatMsgId }: { msgId?: string, chatMsgId?: string }): Promise<void> {
    if (!msgId && !chatMsgId)
      return

    if (chatMsgId) {
      this.sqlite.db.exec(deleteMessageByChatMsgId, { $chatMessageId: chatMsgId })
    } else {
      this.sqlite.db.exec(deleteMessageByMsgId, { $msgId: msgId! })
    }
    await this.saveDbFile()
  }

  async getMessagesByChat(chatId: string): Promise<ChatMessageView<MessageType>[]> {
    const [sqlValue] = this.sqlite.db.exec(messagesByChatQuery, { $chatId: chatId })
    if (!sqlValue)
      return []

    const messages = objectFromQueryExecResult(sqlValue) as ChatMessageViewForDB<MessageType>[]
    return messages.map(m => ({
      ...m,
      attachments: m.attachments ? JSON.parse(m.attachments) : null,
    }))
  }
}

export async  function setupAndStartAppChatsInternalService():
Promise<ChatService> {
  const srv = await ChatService.initialization();
  const srvWrapInternal = new MultiConnectionIPCWrap('AppChatsInternal')
  srvWrapInternal.exposeReqReplyMethods(srv, [
    'createChat',
    'updateChat',
    'getChatList',
    'getChatsUnreadMessagesCount',
    'getChat',
    'deleteChat',
    'clearChat',
    'getMessage',
    'deleteMessage',
    'getMessagesByChat',
    'upsertMessage',
  ]);
  srvWrapInternal.startIPC();
  return srv;
}

