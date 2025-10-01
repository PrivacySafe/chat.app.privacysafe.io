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
import {
  Database,
  objectFromQueryExecResult,
  SQLiteOn3NStorage,
} from '../../../../shared-libs/sqlite-on-3nstorage/index.js';
import { ParamsObject } from '../../../../shared-libs/sqlite-on-3nstorage/sqljs.js';
import type { ChatMessageHistory, ChatMessageReaction, ChatMessageAttachmentsInfo, MessageStatus } from '../../../../types/chat.types.ts';
import type { RelatedMessage, ChatIdObj, ChatMessageId } from '../../../../types/asmail-msgs.types.ts';
import { GroupChatDbEntry, OTOChatDbEntry } from './chats-db.ts';
import {
  TransformDefinition,
  andEqualExprFor,
  booleanTransform,
  forTableInsert,
  fromQueryResult,
  optJsonTransform,
  optStringAsEmptyTransform,
  queryParamsFrom,
  setExprFor,
} from '../../../utils/for-sqlite.ts';

export interface MsgDbEntry {
  groupChatId: GroupChatDbEntry['chatId'] | null;
  otoPeerCAddr: OTOChatDbEntry['peerCAddr'] | null;
  chatMessageId: string;
  isIncomingMsg: boolean;
  incomingMsgId: string | null;
  groupSender: string | null;
  body: string | null;
  attachments: ChatMessageAttachmentsInfo[] | null;
  chatMessageType: 'regular' | 'system' | 'invitation';
  relatedMessage: RelatedMessage | null;
  status: MessageStatus | null;
  timestamp: number;
  history: ChatMessageHistory | null;
  reactions: Record<string, ChatMessageReaction> | null;
}

export interface RefsToMsgsDataNoInDB {
  inboxMsgs: string[];
  outgoingMsgs: {
    chatMsgId: string;
    attachments: ChatMessageAttachmentsInfo[];
  }[];
}

const queryToCreateMsgsDbV2 = [
  `--sql
    CREATE TABLE messages (
      groupChatId TEXT,
      otoPeerCAddr TEXT,
      chatMessageId TEXT NOT NULL,
      isIncomingMsg INTEGER NOT NULL,
      incomingMsgId TEXT,
      groupSender TEXT,
      body TEXT,
      attachments TEXT,
      chatMessageType TEXT NOT NULL,
      relatedMessage TEXT,
      status TEXT,
      timestamp INTEGER NOT NULL,
      history TEXT,
      reactions TEXT,
      PRIMARY KEY (chatMessageId, groupChatId, otoPeerCAddr)
    ) STRICT
  `,

  // indecies to help queries

  `--sql
    CREATE INDEX grchat_id_msg_ts ON messages (
      groupChatId, timestamp	ASC
    )
  `,
  `--sql
    CREATE INDEX grchat_msg_statuses ON messages (
      groupChatId, status, isIncomingMsg, chatMessageType
    )
  `,
  `--sql
    CREATE INDEX oto_peer_msg_ts ON messages (
      otoPeerCAddr, timestamp	ASC
    )
  `,
  `--sql
    CREATE INDEX oto_peer_msg_statuses ON messages (
      otoPeerCAddr, status, isIncomingMsg, chatMessageType
    )
  `,
  `--sql
    CREATE INDEX msg_direction_ts ON messages (
      isIncomingMsg, timestamp	ASC
    )
  `,
].join(';\n');

const msgsTabFields: TransformDefinition<MsgDbEntry> = {
  // note that fields in primary key are forced to be non-null
  groupChatId: optStringAsEmptyTransform,
  otoPeerCAddr: optStringAsEmptyTransform,
  chatMessageId: 'as-is',
  isIncomingMsg: booleanTransform,
  incomingMsgId: 'as-is',
  groupSender: 'as-is',
  body: 'as-is',
  attachments: optJsonTransform,
  chatMessageType: 'as-is',
  relatedMessage: optJsonTransform,
  status: 'as-is',
  timestamp: 'as-is',
  history: optJsonTransform,
  reactions: optJsonTransform,
};

export function initializeV2msgs(db: Database): void {
  db.exec(queryToCreateMsgsDbV2);
}

function msgWhereParamsFor(id: ChatMessageId): {
  whereMsgParams: ParamsObject;
  whereMsg: string;
} {
  const { chatId: { isGroupChat, chatId }, chatMessageId } = id;
  const whereMsgParams = queryParamsFrom<
    Pick<MsgDbEntry, 'chatMessageId' | 'groupChatId' | 'otoPeerCAddr'>
  >(
    {
      chatMessageId,
      groupChatId: (isGroupChat ? chatId : null),
      otoPeerCAddr: (!isGroupChat ? chatId : null),
    },
    msgsTabFields,
  );
  const whereMsg = andEqualExprFor(whereMsgParams);
  return { whereMsgParams, whereMsg };
}

export class MsgsDBs {
  // XXX add content of sqlite dbs split and marked by timestamp
  constructor(
    private readonly latestDB: SQLiteOn3NStorage,
  ) {
  }

  async saveLocally(): Promise<void> {
    await this.latestDB.saveToFile({ skipUpload: true });
  }

  async addMessage(msg: MsgDbEntry): Promise<void> {
    const { insertParams, orderedColumns, orderedValues } = forTableInsert(msg, msgsTabFields);

    this.latestDB.db.exec(
      `INSERT INTO messages(${orderedColumns})
       VALUES (${orderedValues})`,
      insertParams,
    );
  }

  async absorbMsgRecords(msgRecords: MsgDbEntry[]): Promise<void> {
    for (const msg of msgRecords) {
      this.addMessage(msg);
    }
    await this.saveLocally();
  }

  async getMessage(id: ChatMessageId): Promise<MsgDbEntry | undefined> {
    const { whereMsg, whereMsgParams } = msgWhereParamsFor(id);
    const [sqlValue] = this.latestDB.db.exec(
      `SELECT *
       FROM messages
       WHERE ${whereMsg}`,
      whereMsgParams,
    );

    if (sqlValue) {
      return fromQueryResult(sqlValue, msgsTabFields)[0];
    }
  }

  async getMessagesInGroupChat(chatId: string) {
    const whereParams = queryParamsFrom<Pick<MsgDbEntry, 'groupChatId'>>(
      {
        groupChatId: chatId,
      },
      msgsTabFields,
    );
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = this.latestDB.db.exec(
      `SELECT *
       FROM messages
       WHERE ${whereClause}
       ORDER BY timestamp ASC`,
      whereParams,
    );

    return sqlValue ? fromQueryResult(sqlValue, msgsTabFields) : [];
  }

  async msgsInInboxAndOutgoingAttachmentsInOTOChat(otoPeerCAddr: string): Promise<RefsToMsgsDataNoInDB> {
    const inboxMsgs = await this.getInboxMsgsOfOTOChat(otoPeerCAddr);
    const outgoingMsgs = await this.getAllOutgoingMsgAttachmentsInOTOChat(otoPeerCAddr);

    return { inboxMsgs, outgoingMsgs };
  }

  private async getInboxMsgsOfOTOChat(otoPeerCAddr: string): Promise<string[]> {
    const whereParams = queryParamsFrom<Pick<MsgDbEntry, 'otoPeerCAddr' | 'isIncomingMsg'>>(
      { otoPeerCAddr, isIncomingMsg: true },
      msgsTabFields,
    );
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = this.latestDB.db.exec(
      `SELECT incomingMsgId
       FROM messages
       WHERE ${whereClause}
         AND incomingMsgId IS NOT NULL
      `,
      whereParams,
    );

    return sqlValue
      ? fromQueryResult(sqlValue, msgsTabFields).map(r => r.incomingMsgId!)
      : [];
  }

  private async getAllOutgoingMsgAttachmentsInOTOChat(otoPeerCAddr: string): Promise<RefsToMsgsDataNoInDB['outgoingMsgs']> {
    const whereParams = queryParamsFrom<Pick<MsgDbEntry, 'otoPeerCAddr' | 'isIncomingMsg'>>(
      { otoPeerCAddr, isIncomingMsg: false },
      msgsTabFields,
    );
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = this.latestDB.db.exec(
      `SELECT chatMessageId, attachments
       FROM messages
       WHERE ${whereClause}
         AND attachments IS NOT NULL
      `,
      whereParams,
    );

    return sqlValue
      ? fromQueryResult(sqlValue, msgsTabFields).map(r => ({
        chatMsgId: r.chatMessageId,
        attachments: r.attachments!,
      }))
      : [];
  }

  async getMessagesInOneToOneChat(otoPeerCAddr: string) {
    const whereParams = queryParamsFrom<Pick<MsgDbEntry, 'otoPeerCAddr'>>(
      { otoPeerCAddr }, msgsTabFields,
    );
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = this.latestDB.db.exec(
      `SELECT *
       FROM messages
       WHERE ${whereClause}
       ORDER BY timestamp ASC`,
      whereParams,
    );

    return sqlValue ? fromQueryResult(sqlValue, msgsTabFields) : [];
  }

  async deleteMessage(id: ChatMessageId): Promise<boolean> {
    const { whereMsg, whereMsgParams } = msgWhereParamsFor(id);
    this.latestDB.db.exec(`--sql
        DELETE
        FROM messages
        WHERE ${whereMsg}
      `,
      whereMsgParams,
    );

    return this.latestDB.db.getRowsModified() > 0;
  }

  async msgsInInboxAndOutgoingAttachmentsInGroupChat(chatId: string): Promise<RefsToMsgsDataNoInDB> {
    const inboxMsgs = await this.getInboxMsgsOfGroupChat(chatId);
    const outgoingMsgs = await this.getAllOutgoingMsgAttachmentsInGroupChat(chatId);
    return { inboxMsgs, outgoingMsgs };
  }

  private async getInboxMsgsOfGroupChat(groupChatId: string): Promise<string[]> {
    const whereParams = queryParamsFrom<Pick<MsgDbEntry, 'groupChatId' | 'isIncomingMsg'>>(
      { groupChatId, isIncomingMsg: true },
      msgsTabFields,
    );
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = this.latestDB.db.exec(
      `SELECT incomingMsgId
       FROM messages
       WHERE ${whereClause}
         AND incomingMsgId IS NOT NULL
      `,
      whereParams,
    );

    return sqlValue
      ? fromQueryResult(sqlValue, msgsTabFields).map(r => r.incomingMsgId!)
      : [];
  }

  private async getAllOutgoingMsgAttachmentsInGroupChat(groupChatId: string): Promise<RefsToMsgsDataNoInDB['outgoingMsgs']> {
    const whereParams = queryParamsFrom<Pick<MsgDbEntry, 'groupChatId' | 'isIncomingMsg'>>(
      { groupChatId, isIncomingMsg: false },
      msgsTabFields,
    );
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = this.latestDB.db.exec(
      `SELECT chatMessageId, attachments
       FROM messages
       WHERE ${whereClause}
         AND attachments IS NOT NULL
      `,
      whereParams,
    );

    return sqlValue
      ? fromQueryResult(sqlValue, msgsTabFields).map(r => ({
        chatMsgId: r.chatMessageId,
        attachments: r.attachments!,
      }))
      : [];
  }

  async deleteMessagesInOneToOneChat(otoPeerCAddr: string): Promise<boolean> {
    const whereGroupParams = queryParamsFrom<Pick<MsgDbEntry, 'otoPeerCAddr'>>(
      { otoPeerCAddr },
      msgsTabFields,
    );
    const whereGroup = andEqualExprFor(whereGroupParams);
    this.latestDB.db.exec(`--sql
        DELETE
        FROM messages
        WHERE ${whereGroup}
      `,
      whereGroupParams,
    );

    return this.latestDB.db.getRowsModified() > 0;
  }

  async deleteMessagesInGroupChat(groupChatId: string): Promise<boolean> {
    const whereGroupParams = queryParamsFrom<Pick<MsgDbEntry, 'groupChatId'>>(
      { groupChatId },
      msgsTabFields,
    );
    const whereGroup = andEqualExprFor(whereGroupParams);
    this.latestDB.db.exec(`--sql
        DELETE
        FROM messages
        WHERE ${whereGroup}
      `,
      whereGroupParams,
    );
    return this.latestDB.db.getRowsModified() > 0;
  }

  getUnreadMsgsCountIn({ isGroupChat, chatId }: ChatIdObj): number {
    const whereParams = queryParamsFrom<
      Pick<MsgDbEntry, 'groupChatId' | 'otoPeerCAddr' | 'isIncomingMsg' | 'chatMessageType' | 'status'>
    >(
      {
        groupChatId: isGroupChat ? chatId : null,
        otoPeerCAddr: !isGroupChat ? chatId : null,
        isIncomingMsg: true,
        chatMessageType: 'regular',
        status: 'unread',
      },
      msgsTabFields,
    );
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = this.latestDB.db.exec(
      `SELECT COUNT(*) AS unread
       FROM messages
       WHERE ${whereClause}`,
      whereParams,
    );

    return sqlValue
      ? objectFromQueryExecResult<{ unread: number }>(sqlValue)[0].unread
      : 0;
  }

  getNotRegularMessagesByChat({ chatId }: ChatIdObj): MsgDbEntry[] {
    const query = `--sql
      SELECT *, groupChatId || otoPeerCAddr AS chatId
      FROM messages
      WHERE chatId=$chatId AND (chatMessageType='system' OR chatMessageType='invitation')
    `;

    const [sqlValue] = this.latestDB.db.exec(query, { $chatId: chatId });
    const msgs = sqlValue
      ? fromQueryResult<MsgDbEntry & { chatId?: string; maxTS?: number }>(sqlValue, msgsTabFields)
      : null;

    if (!msgs) {
      return [];
    }

    for (const msg of msgs) {
      msg?.chatId && (delete msg.chatId);
    }

    return msgs;
  }

  getLatestMsgInChat({ chatId }: ChatIdObj): MsgDbEntry | null {
    const query = `--sql
      SELECT *, groupChatId || otoPeerCAddr AS chatId, MAX(timestamp) AS maxTS
      FROM messages
      WHERE chatId=$chatId
    `;

    const [sqlValue] = this.latestDB.db.exec(query, { $chatId: chatId });
    const msgs = sqlValue
      ? fromQueryResult<MsgDbEntry & { chatId?: string; maxTS?: number }>(sqlValue, msgsTabFields)
      : [null];

    msgs[0]?.chatId && (delete msgs[0].chatId);
    msgs[0]?.maxTS && (delete msgs[0].maxTS);

    return msgs[0];
  }

  getLatestIncomingMsgTimestamp(): number | undefined {
    const [sqlValue] = this.latestDB.db.exec(
      `SELECT max(timestamp) as maxTS
       FROM messages
       WHERE isIncomingMsg = 1`,
    );
    if (!sqlValue) {
      return;
    }

    const { maxTS } = objectFromQueryExecResult<{ maxTS: number | null }>(sqlValue)[0];

    return maxTS === null ? undefined : maxTS;
  }

  async updateMessageRecord(id: ChatMessageId, toUpdate: Partial<MsgDbEntry>): Promise<boolean> {
    const { whereMsg, whereMsgParams } = msgWhereParamsFor(id);
    const updateParams = queryParamsFrom(toUpdate, msgsTabFields);
    const setExpr = setExprFor<MsgDbEntry>(updateParams, [
      'groupChatId', 'otoPeerCAddr', 'chatMessageId',
    ]);
    this.latestDB.db.exec(
      `UPDATE messages
       SET ${setExpr}
       WHERE ${whereMsg}`,
      {
        ...updateParams,
        ...whereMsgParams,
      },
    );

    return this.latestDB.db.getRowsModified() > 0;
  }
}
