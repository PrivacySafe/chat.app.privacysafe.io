/*
Copyright (C) 2020 - 2025 3NSoft Inc.

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

// @deno-types="../../../../shared-libs/sqlite-on-3nstorage/index.d.ts"
// @deno-types="../../../../shared-libs/sqlite-on-3nstorage/sqljs.d.ts"
import { Database, SQLiteOn3NStorage } from '../../../../shared-libs/sqlite-on-3nstorage/index.js';
import { ParamsObject, SqlValue } from '../../../../shared-libs/sqlite-on-3nstorage/sqljs.js';
import { ensureIsAddressString, toCanonicalAddress } from '../../../../shared-libs/address-utils.ts';
import { makeDbRecordException } from '../../../utils/exceptions.ts';
import type { GroupChatStatus, SingleChatStatus } from '../../../../types/chat.types.ts';
import type { ChatIdObj } from '../../../../types/asmail-msgs.types.ts';
import type { MsgDbEntry } from './msgs-db.ts';
import {
  TransformDefinition,
  andEqualExprFor,
  forTableInsert,
  fromQueryResult,
  queryParamsFrom,
  setExprFor,
} from '../../../utils/for-sqlite.ts';

export interface ChatSettings {
  autoDeleteMessages?: string;
  [key: string]: unknown;
}

export interface GroupChatDbEntry extends GroupChatTableFields, FieldsFromMsgsDb {}

export interface GroupChatTableFields {
  chatId: string;
  members: Record<string, { hasAccepted: boolean }>;
  admins: string[];
  name: string;
  createdAt: number;
  lastUpdatedAt: number;
  status: GroupChatStatus;
  settings: ChatSettings | null;
}

export interface FieldsFromMsgsDb {
  lastMsg?: MsgDbEntry | null;
  unread?: number;
}

type GroupChatDbRecord = Omit<GroupChatDbEntry, 'members' | 'admins'> & {
  members: string;
  admins: string;
};

export interface OTOChatDbEntry extends OTOChatTableFields, FieldsFromMsgsDb {}

export interface OTOChatTableFields {
  peerCAddr: string;
  peerAddr: string;
  name: string;
  createdAt: number;
  lastUpdatedAt: number;
  status: SingleChatStatus;
  settings: ChatSettings | null;
}

export type ChatDbEntry = (GroupChatDbEntry & { isGroupChat: true }) | (OTOChatDbEntry & { isGroupChat: false });

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

const groupChatTabFields: TransformDefinition<GroupChatTableFields> = {
  chatId: 'as-is',
  name: 'as-is',
  createdAt: 'as-is',
  lastUpdatedAt: 'as-is',
  status: 'as-is',
  admins: {
    toSQLValue: (admins: GroupChatDbEntry['admins']): GroupChatDbRecord['admins'] => {
      if (admins.length < 1) {
        throw makeDbRecordException({
          invalidChatInsertData: true,
          message: `Chat admins array is empty`,
        });
      }
      for (const addr of admins) {
        try {
          ensureIsAddressString(addr);
        } catch (exc) {
          throw makeDbRecordException({
            invalidChatInsertData: true,
            message: `Invalid address entry in chat admins array`,
            cause: exc,
          });
        }
      }
      return JSON.stringify(admins);
    },
    fromSQLValue: (sv: SqlValue): GroupChatDbEntry['admins'] => {
      return JSON.parse(sv as string);
    },
  },
  members: {
    toSQLValue: (members: GroupChatDbEntry['members']): GroupChatDbRecord['members'] => {
      if (Object.keys(members).length < 1) {
        throw makeDbRecordException({
          invalidChatInsertData: true,
          message: `Chat members array has too few addresses`,
        });
      }
      for (const addr of Object.keys(members)) {
        try {
          ensureIsAddressString(addr);
        } catch (exc) {
          throw makeDbRecordException({
            invalidChatInsertData: true,
            message: `Invalid address entry in chat members array`,
            cause: exc,
          });
        }
      }
      return JSON.stringify(members);
    },
    fromSQLValue: (sv: SqlValue): GroupChatDbEntry['members'] => {
      return JSON.parse(sv as string);
    },
  },
  settings: {
    toSQLValue: (v: object | null): string | null => (v ? JSON.stringify(v): null),
    fromSQLValue: (sv: SqlValue): object | null => (sv ? JSON.parse(sv as string) : null),
  },
};

const otoChatTabFields: TransformDefinition<OTOChatTableFields> = {
  peerCAddr: 'as-is',
  peerAddr: 'as-is',
  name: 'as-is',
  status: 'as-is',
  createdAt: 'as-is',
  lastUpdatedAt: 'as-is',
  settings: {
    toSQLValue: (v: object | null): string | null => (v ? JSON.stringify(v): null),
    fromSQLValue: (sv: SqlValue): object | null => (sv ? JSON.parse(sv as string) : null),
  },
};

export function initializeV2chats(db: Database): void {
  db.exec(queryToCreateChatsDbV2);
}

function groupChatWhereParamsFor(chatId: string): {
  whereParams: ParamsObject;
  whereClause: string;
} {
  const whereParams = queryParamsFrom<Pick<GroupChatDbEntry, 'chatId'>>(
    { chatId }, groupChatTabFields,
  );
  const whereClause = andEqualExprFor(whereParams);
  return { whereParams, whereClause };
}

function otoChatWhereParamsFor(peerCAddr: string): {
  whereParams: ParamsObject;
  whereClause: string;
} {
  const whereParams = queryParamsFrom<Pick<OTOChatDbEntry, 'peerCAddr'>>(
    { peerCAddr }, otoChatTabFields,
  );
  const whereClause = andEqualExprFor(whereParams);
  return { whereParams, whereClause };
}

function isUniqueViolation(err: Error, ...columns: string[]): boolean {
  if (!err.message.includes(`UNIQUE constraint failed`)) {
    return false;
  }
  for (const column of columns) {
    if (err.message.includes(column)) {
      return true;
    }
  }
  return false;
}

export class ChatsDB {
  constructor(
    private readonly sqlite: SQLiteOn3NStorage,
  ) {
  }

  async saveLocally(): Promise<void> {
    await this.sqlite.saveToFile({ skipUpload: true });
  }

  async absorbChatRecords(groupChats: GroupChatDbEntry[], otoChats: OTOChatDbEntry[]): Promise<void> {
    for (const groupChat of groupChats) {
      const {
        insertParams, orderedColumns, orderedValues,
      } = forTableInsert(groupChat, groupChatTabFields);
      this.sqlite.db.exec(
        `INSERT INTO group_chats (${orderedColumns})
         VALUES (${orderedValues})`,
        insertParams,
      );
    }
    for (const otoChat of otoChats) {
      const {
        insertParams, orderedColumns, orderedValues,
      } = forTableInsert(otoChat, otoChatTabFields);
      this.sqlite.db.exec(
        `INSERT INTO oto_chats (${orderedColumns})
         VALUES (${orderedValues})`,
        insertParams,
      );
    }
    await this.saveLocally();
  }

  findChat({ isGroupChat, chatId }: ChatIdObj): ChatDbEntry | undefined {
    if (isGroupChat) {
      const chat = this.getGroupChat(chatId) as ChatDbEntry;
      if (chat) {
        chat.isGroupChat = true;
        return chat;
      }
    } else {
      const chat = this.getOTOChat(chatId) as ChatDbEntry;
      if (chat) {
        chat.isGroupChat = false;
        return chat;
      }
    }
  }

  getGroupChat(chatId: string): GroupChatDbEntry | undefined {
    const { whereClause, whereParams } = groupChatWhereParamsFor(chatId);
    const [sqlValue] = this.sqlite.db.exec(
      `SELECT *
       FROM group_chats
       WHERE ${whereClause}`,
      whereParams,
    );

    return sqlValue ? fromQueryResult(sqlValue, groupChatTabFields)[0] : undefined;
  }

  getOTOChat(peerCAddr: string): OTOChatDbEntry | undefined {
    const { whereClause, whereParams } = otoChatWhereParamsFor(peerCAddr);
    const [sqlValue] = this.sqlite.db.exec(
      `SELECT *
       FROM oto_chats
       WHERE ${whereClause}`,
      whereParams,
    );

    return sqlValue ? fromQueryResult(sqlValue, otoChatTabFields)[0] : undefined;
  }

  updateGroupChat(chatId: string, toUpdate: Partial<GroupChatDbEntry>): boolean {
    const updateParams = queryParamsFrom({
      ...toUpdate,
      chatId,
      lastUpdatedAt: Date.now(),
    }, groupChatTabFields);
    const setExpr = setExprFor<GroupChatDbEntry>(updateParams, ['chatId']);
    this.sqlite.db.exec(
      `UPDATE group_chats
       SET ${setExpr}
       WHERE chatId = $chatId`,
      updateParams,
    );
    return this.sqlite.db.getRowsModified() > 0;
  }

  getGroupChatsList(): GroupChatDbEntry[] {
    const [sqlValue] = this.sqlite.db.exec(`SELECT * FROM group_chats`);
    return sqlValue ? fromQueryResult(sqlValue, groupChatTabFields) : [];
  }

  addGroupChat(params: Omit<GroupChatDbEntry, 'createdAt' | 'lastUpdatedAt'>): GroupChatDbEntry {
    if (this.chatNameExists(params.name)) {
      throw makeDbRecordException({
        duplicateChatName: true,
      });
    }
    const now = Date.now();
    const {
      insertParams, orderedColumns, orderedValues,
    } = forTableInsert({
      ...params,
      createdAt: now,
      lastUpdatedAt: now,
    }, groupChatTabFields);
    try {
      this.sqlite.db.exec(
        `INSERT INTO group_chats (${orderedColumns})
         VALUES (${orderedValues})`,
        insertParams,
      );
    } catch (err) {
      if (isUniqueViolation(err as Error, 'chatId')) {
        throw makeDbRecordException({
          chatAlreadyExists: true,
        });
      } else {
        throw err;
      }
    }
    const chat = this.getGroupChat(params.chatId);
    if (chat) {
      return chat;
    } else {
      throw new Error(`Chat entry should've been created`);
    }
  }

  deleteGroupChat(chatId: string): boolean {
    const { whereClause, whereParams } = groupChatWhereParamsFor(chatId);
    this.sqlite.db.exec(`--sql
        DELETE
        FROM group_chats
        WHERE ${whereClause}
      `,
      whereParams,
    );
    return (this.sqlite.db.getRowsModified() > 0);
  }

  addOneToOneChat(params: Omit<OTOChatDbEntry, 'createdAt' | 'lastUpdatedAt' | 'peerCAddr'>): OTOChatDbEntry {
    if (this.chatNameExists(params.name)) {
      throw makeDbRecordException({
        duplicateChatName: true,
      });
    }
    const peerCAddr = toCanonicalAddress(params.peerAddr);
    const now = Date.now();
    const { insertParams, orderedColumns, orderedValues } = forTableInsert({
      ...params,
      peerCAddr,
      createdAt: now,
      lastUpdatedAt: now,
    }, otoChatTabFields);

    try {
      this.sqlite.db.exec(
        `INSERT INTO oto_chats (${orderedColumns})
         VALUES (${orderedValues})`,
        insertParams,
      );
    } catch (err) {
      if (isUniqueViolation(err as Error, 'peerCAddr')) {
        throw makeDbRecordException({
          chatAlreadyExists: true,
        });
      } else {
        throw err;
      }
    }

    const chat = this.getOTOChat(peerCAddr);
    if (chat) {
      return chat;
    } else {
      throw new Error(`Chat entry should've been created`);
    }
  }

  private chatNameExists(name: string): boolean {
    return this.chatNameExistsInOTOs(name) || this.chatNameExistsInGroups(name);
  }

  private chatNameExistsInOTOs(name: string): boolean {
    const whereParams = queryParamsFrom({ name }, otoChatTabFields);
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = this.sqlite.db.exec(
      `SELECT *
       FROM oto_chats
       WHERE ${whereClause}`,
      whereParams,
    );

    return !!sqlValue;
  }

  private chatNameExistsInGroups(name: string): boolean {
    const whereParams = queryParamsFrom({ name }, groupChatTabFields);
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = this.sqlite.db.exec(
      `SELECT *
       FROM group_chats
       WHERE ${whereClause}`,
      whereParams,
    );

    return !!sqlValue;
  }

  getOTOChatsList(): OTOChatDbEntry[] {
    const [sqlValue] = this.sqlite.db.exec(`SELECT * FROM oto_chats`);
    return sqlValue ? fromQueryResult(sqlValue, otoChatTabFields) : [];
  }

  deleteOTOChat(peerCAddr: string): boolean {
    const { whereClause, whereParams } = otoChatWhereParamsFor(peerCAddr);
    this.sqlite.db.exec(
      `DELETE
       FROM oto_chats
       WHERE ${whereClause}`,
      whereParams,
    );

    return this.sqlite.db.getRowsModified() > 0;
  }

  updateOTOChat(peerCAddr: string, toUpdate: Partial<OTOChatDbEntry>): boolean {
    const updateParams = queryParamsFrom({
      ...toUpdate,
      peerCAddr,
      lastUpdatedAt: Date.now(),
    }, otoChatTabFields);
    const setExpr = setExprFor<OTOChatDbEntry>(updateParams, ['peerCAddr']);
    this.sqlite.db.exec(
      `UPDATE oto_chats
       SET ${setExpr}
       WHERE peerCAddr = $peerCAddr`,
      updateParams,
    );

    return this.sqlite.db.getRowsModified() > 0;
  }
}
