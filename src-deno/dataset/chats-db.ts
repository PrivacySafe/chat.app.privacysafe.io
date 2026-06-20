/*
 Copyright (C) 2026 3NSoft Inc.

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
// @deno-types="../../../shared-libs/sqlite-on-3nstorage/sqljs.d.ts"
import type { ChatIdObj } from '../../types/asmail-msgs.types.ts';
import type { ChatDbEntry, GroupChatDbEntry, OTOChatDbEntry, ChatsDb } from '../types/index.ts';
import { CHATS_DB_FNAME, CHATS_DB_META_ATTR, DATASET_META_ATTR } from '../../shared-libs/constants/index.ts';
import { SQLiteOn3NStorage } from '../../shared-libs/sqlite-on-3nstorage/index.js';
import {
  otoChatTabFields,
  otoChatWhereParamsFor,
  groupChatTabFields,
  groupChatWhereParamsFor,
  ensureAllAdminsAreInMembers,
  isUniqueViolation,
} from './utils.ts';
import {
  fromQueryResult,
  queryParamsFrom,
  andEqualExprFor,
  forTableInsert,
  setExprFor,
} from '../utils/for-sqlite.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';
import { toCanonicalAddress } from '../../shared-libs/address-utils.ts';
import { msgsDb } from './msgs-db.ts';

const queryToCreateChatsDbV2 = [
  `--sql
    CREATE TABLE group_chats (
      chatId TEXT NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      members TEXT NOT NULL,
      admins TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      lastUpdatedAt INTEGER NOT NULL,
      settings TEXT
    ) STRICT
  `,
  `--sql
    CREATE TABLE oto_chats (
      peerCAddr TEXT NOT NULL PRIMARY KEY,
      peerAddr TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      lastUpdatedAt INTEGER NOT NULL,
      settings TEXT
    ) STRICT
  `,
  `--sql
    CREATE UNIQUE INDEX group_chat_name ON group_chats (name)
  `,
  `--sql
    CREATE UNIQUE INDEX oto_chat_name ON oto_chats (name)
  `,
].join(';\n');

async function getSqliteDb({
  fs,
  fsLocal,
  saveLocally,
}: {
  fs: web3n.files.WritableFS;
  fsLocal: web3n.files.WritableFS;
  saveLocally: (sql: SQLiteOn3NStorage) => Promise<void>;
}): Promise<SQLiteOn3NStorage> {
  const chatsDbFile = await fsLocal.writableFile(CHATS_DB_FNAME);

  if (await fs.checkFilePresence(CHATS_DB_FNAME)) {
    const chatsBdFileData = await fs.readBytes(CHATS_DB_FNAME);
    if (chatsBdFileData) {
      await chatsDbFile.writeBytes(chatsBdFileData);
      await fs.deleteFile(CHATS_DB_FNAME);
    }
  }

  const sqlite = await SQLiteOn3NStorage.makeAndStart(chatsDbFile);

  const res = sqlite.db.exec(`PRAGMA table_info(group_chats)`);
  if (res.length === 0) {
    sqlite.db.exec(queryToCreateChatsDbV2);
    await saveLocally(sqlite);
    await chatsDbFile.updateXAttrs({
      set: { [DATASET_META_ATTR]: { datasetVersion: 2, db: CHATS_DB_META_ATTR } },
    });
  }

  return sqlite;
}

export async function chatsDb({
  fs,
  fsLocal,
  msgsBdSrv,
}: {
  fs: web3n.files.WritableFS;
  fsLocal: web3n.files.WritableFS;
  msgsBdSrv: Awaited<ReturnType<typeof msgsDb>>;
}): Promise<ChatsDb> {
  const sqlite = await getSqliteDb({ fs, fsLocal, saveLocally });

  async function saveLocally(sql: SQLiteOn3NStorage) {
    await sql.saveToFile({ skipUpload: true });
  }

  function getOTOChat(peerCAddr: string): OTOChatDbEntry | undefined {
    const { whereClause, whereParams } = otoChatWhereParamsFor(peerCAddr);
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT *
      FROM oto_chats
      WHERE ${whereClause}`,
      whereParams,
    );
    return sqlValue ? fromQueryResult(sqlValue, otoChatTabFields)[0] : undefined;
  }

  function getGroupChat(chatId: string): GroupChatDbEntry | undefined {
    const { whereClause, whereParams } = groupChatWhereParamsFor(chatId);
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT *
      FROM group_chats
      WHERE ${whereClause}`,
      whereParams,
    );
    return sqlValue ? fromQueryResult(sqlValue, groupChatTabFields)[0] : undefined;
  }

  function findChat({ isGroupChat, chatId }: ChatIdObj): ChatDbEntry | undefined {
    const chat = (isGroupChat ? getGroupChat(chatId) : getOTOChat(chatId)) as ChatDbEntry | undefined;
    if (chat) {
      chat.isGroupChat = isGroupChat;
      chat.lastMsg = msgsBdSrv.getLatestMsgInChat({ isGroupChat, chatId });
      chat.unread = msgsBdSrv.getUnreadMsgsCountIn({ isGroupChat, chatId });
    }
    return chat;
  }

  function chatNameExistsInOTOs(name: string): boolean {
    const whereParams = queryParamsFrom({ name }, otoChatTabFields);
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT *
      FROM oto_chats
      WHERE ${whereClause}`,
      whereParams,
    );
    return !!sqlValue;
  }

  function chatNameExistsInGroups(name: string): boolean {
    const whereParams = queryParamsFrom({ name }, groupChatTabFields);
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT *
      FROM group_chats
      WHERE ${whereClause}`,
      whereParams,
    );
    return !!sqlValue;
  }

  function chatNameExists(name: string): boolean {
    return chatNameExistsInOTOs(name) || chatNameExistsInGroups(name);
  }

  async function addOneToOneChat(
    params: Omit<OTOChatDbEntry, 'createdAt' | 'lastUpdatedAt' | 'peerCAddr'>,
  ): Promise<OTOChatDbEntry> {
    if (chatNameExists(params.name)) {
      throw makeDbRecordException({ duplicateChatName: true });
    }

    const peerCAddr = toCanonicalAddress(params.peerAddr);
    const now = Date.now();
    const { insertParams, orderedColumns, orderedValues } = forTableInsert(
      {
        ...params,
        settings: { autoDeleteMessages: '0' },
        peerCAddr,
        createdAt: now,
        lastUpdatedAt: now,
      },
      otoChatTabFields,
    );

    try {
      sqlite.db.exec(
        `--sql
        INSERT INTO oto_chats (${orderedColumns})
        VALUES (${orderedValues})`,
        insertParams,
      );
      await saveLocally(sqlite);
    } catch (err) {
      if (isUniqueViolation(err as Error, 'peerCAddr')) {
        throw makeDbRecordException({ chatAlreadyExists: true });
      } else {
        throw err;
      }
    }

    const chat = getOTOChat(peerCAddr);
    if (chat) {
      return chat;
    } else {
      throw new Error(`Chat entry should've been created`);
    }
  }

  async function addGroupChat(
    chat: Omit<GroupChatDbEntry, 'createdAt' | 'lastUpdatedAt'>,
  ): Promise<GroupChatDbEntry> {
    ensureAllAdminsAreInMembers(chat.admins, chat.members);

    if (chatNameExists(chat.name)) {
      throw makeDbRecordException({ duplicateChatName: true });
    }
    const now = Date.now();
    const { insertParams, orderedColumns, orderedValues } = forTableInsert(
      {
        ...chat,
        settings: { autoDeleteMessages: '0' },
        createdAt: now,
        lastUpdatedAt: now,
      },
      groupChatTabFields,
    );
    try {
      sqlite.db.exec(
        `--sql
        INSERT INTO group_chats (${orderedColumns})
        VALUES (${orderedValues})`,
        insertParams,
      );
      await saveLocally(sqlite);
    } catch (err) {
      if (isUniqueViolation(err as Error, 'chatId')) {
        throw makeDbRecordException({ chatAlreadyExists: true });
      } else {
        throw err;
      }
    }
    const res = getGroupChat(chat.chatId);
    if (res) {
      return res;
    } else {
      throw new Error(`Chat entry should've been created`);
    }
  }

  async function updateOTOChatRecord(
    peerCAddr: string,
    toUpdate: Partial<OTOChatDbEntry>,
  ): Promise<OTOChatDbEntry | undefined> {
    const updateParams = queryParamsFrom(
      {
        ...toUpdate,
        peerCAddr,
        lastUpdatedAt: Date.now(),
      },
      otoChatTabFields,
    );
    const setExpr = setExprFor<OTOChatDbEntry>(updateParams, ['peerCAddr']);
    sqlite.db.exec(
      `--sql
      UPDATE oto_chats
      SET ${setExpr}
      WHERE peerCAddr = $peerCAddr`,
      updateParams,
    );
    if (sqlite.db.getRowsModified() > 0) {
      await saveLocally(sqlite);
      return getOTOChat(peerCAddr);
    }
  }

  async function updateGroupChatRecord(
    chatId: string,
    toUpdate: Partial<GroupChatDbEntry>,
  ): Promise<GroupChatDbEntry | undefined> {
    const updateParams = queryParamsFrom(
      {
        ...toUpdate,
        chatId,
        lastUpdatedAt: Date.now(),
      },
      groupChatTabFields,
    );
    const setExpr = setExprFor<GroupChatDbEntry>(updateParams, ['chatId']);
    sqlite.db.exec(
      `--sql
      UPDATE group_chats
      SET ${setExpr}
      WHERE chatId = $chatId`,
      updateParams,
    );
    if (sqlite.db.getRowsModified() > 0) {
      await saveLocally(sqlite);
      return getGroupChat(chatId);
    }
  }

  function getOTOChatsList(): OTOChatDbEntry[] {
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT *
      FROM oto_chats`,
    );
    return sqlValue ? fromQueryResult(sqlValue, otoChatTabFields) : [];
  }

  function getGroupChatsList(): GroupChatDbEntry[] {
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT *
      FROM group_chats`,
    );
    return sqlValue ? fromQueryResult(sqlValue, groupChatTabFields) : [];
  }

  function getChatList(): ChatDbEntry[] {
    const otoChats = (getOTOChatsList() as ChatDbEntry[]).map(c => {
      c.isGroupChat = false;
      const { peerCAddr } = c as OTOChatDbEntry;
      c.lastMsg = msgsBdSrv.getLatestMsgInChat({ isGroupChat: false, chatId: peerCAddr });
      c.unread = msgsBdSrv.getUnreadMsgsCountIn({ isGroupChat: false, chatId: peerCAddr });
      return c;
    });

    const groupChats = (getGroupChatsList() as ChatDbEntry[]).map(c => {
      c.isGroupChat = true;
      const { chatId } = c as GroupChatDbEntry;
      c.lastMsg = msgsBdSrv.getLatestMsgInChat({ isGroupChat: true, chatId });
      c.unread = msgsBdSrv.getUnreadMsgsCountIn({ isGroupChat: true, chatId });
      return c;
    });

    return [...otoChats, ...groupChats];
  }

  async function deleteOTOChat(peerCAddr: string) {
    const { whereClause, whereParams } = otoChatWhereParamsFor(peerCAddr);
    sqlite.db.exec(
      `--sql
      DELETE FROM oto_chats
      WHERE ${whereClause}`,
      whereParams,
    );
    if (sqlite.db.getRowsModified() > 0) {
      await saveLocally(sqlite);
    }
  }

  async function deleteGroupChat(chatId: string) {
    const { whereClause, whereParams } = groupChatWhereParamsFor(chatId);
    sqlite.db.exec(
      `--sql
      DELETE FROM group_chats
      WHERE ${whereClause}`,
      whereParams,
    );
    if (sqlite.db.getRowsModified() > 0) {
      await saveLocally(sqlite);
    }
  }

  async function deleteChat(chatId: ChatIdObj) {
    if (chatId.isGroupChat) {
      await deleteGroupChat(chatId.chatId);
    } else {
      await deleteOTOChat(chatId.chatId);
    }

    return msgsBdSrv.deleteMessagesInChat(chatId);
  }

  return {
    findChat,
    addOneToOneChat,
    addGroupChat,
    updateOTOChatRecord,
    updateGroupChatRecord,
    getChatList,
    deleteChat,
  };
}
