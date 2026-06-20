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
import { objectFromQueryExecResult, SQLiteOn3NStorage } from '../../shared-libs/sqlite-on-3nstorage/index.js';
import {
  MSGS_DBS_DIR_NAME,
  MSGS_DB_FNAME_PREFIX,
  DATASET_META_ATTR,
  ORPHANED_MSGS_DBS_DIR_NAME,
  AUXILIARY_DB_META_ATTR,
  MAIN_DB_META_ATTR,
  LIFETIME_DAYS_IN_AUXILIARY_DB,
} from '../../shared-libs/constants/index.ts';
import { msgsOrphanedTabFiels, msgsTabFields, msgWhereParamsFor } from './utils.ts';
import type { ChatIdObj, ChatMessageId } from '../../types/asmail-msgs.types.ts';
import type { ChatMessageReaction } from '../../types/chat.types.ts';
import { MsgDbEntry, MsgsDb, OrphanedMsgDbEntry, RefsToMsgsDataNoInDB } from '../types/index.ts';
import {
  andEqualExprFor,
  forTableInsert,
  fromQueryResult,
  queryParamsFrom,
  setExprFor,
} from '../utils/for-sqlite.ts';

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
      removeAfter INTEGER NOT NULL,
      history TEXT,
      reactions TEXT,
      settings TEXT,
      PRIMARY KEY (chatMessageId, groupChatId, otoPeerCAddr)
    ) STRICT
  `,
  `--sql
    CREATE INDEX IF NOT EXISTS grchat_id_msg_ts ON messages (
      groupChatId, timestamp	ASC
    )
  `,
  `--sql
    CREATE INDEX IF NOT EXISTS grchat_id_msg_ts_lifetime ON messages (
      groupChatId, timestamp, removeAfter	ASC
    )
  `,
  `--sql
    CREATE INDEX IF NOT EXISTS grchat_msg_statuses ON messages (
      groupChatId, status, isIncomingMsg, chatMessageType
    )
  `,
  `--sql
    CREATE INDEX IF NOT EXISTS oto_peer_msg_ts ON messages (
      otoPeerCAddr, timestamp	ASC
    )
  `,
  `--sql
    CREATE INDEX IF NOT EXISTS oto_peer_msg_ts_lifetime ON messages (
      otoPeerCAddr, timestamp, removeAfter	ASC
    )
  `,
  `--sql
    CREATE INDEX IF NOT EXISTS oto_peer_msg_statuses ON messages (
      otoPeerCAddr, status, isIncomingMsg, chatMessageType
    )
  `,
  `--sql
    CREATE INDEX IF NOT EXISTS msg_direction_ts ON messages (
      isIncomingMsg, timestamp	ASC
    )
  `,
].join(';\n');

const queryToCreateMsgsOrphanedDbV2 = [
  `--sql
    CREATE TABLE orphaned_messages (
      groupChatId TEXT,
      otoPeerCAddr TEXT,
      incomingMsgId TEXT NOT NULL,
      targetMessageId TEXT NOT NULL,
      rawPayload TEXT NOT NULL,
      bufferedAt INTEGER NOT NULL,
      PRIMARY KEY (incomingMsgId, groupChatId, otoPeerCAddr)
    ) STRICT
  `,
  `--sql
    CREATE INDEX IF NOT EXISTS idx_orphaned_target ON orphaned_messages(
      targetMessageId
    )
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
}): Promise<{ sqlite: SQLiteOn3NStorage; auxiliarySqlite: SQLiteOn3NStorage }> {
  const msgsDbFileName = `${MSGS_DB_FNAME_PREFIX}0`;
  const msgsDbFilePath = `${MSGS_DBS_DIR_NAME}/${msgsDbFileName}`;

  if (await fs.checkFilePresence(msgsDbFilePath)) {
    const msgsBdFileData = await fs.readBytes(msgsDbFilePath);
    if (msgsBdFileData) {
      await fsLocal.makeFolder(MSGS_DBS_DIR_NAME);
      await fsLocal.writeBytes(msgsDbFilePath, msgsBdFileData);
      await fs.deleteFile(msgsDbFilePath);
    }
  }

  const msgsDbFile = await fsLocal.writableFile(msgsDbFilePath);
  const sqlite = await SQLiteOn3NStorage.makeAndStart(msgsDbFile);

  const res = sqlite.db.exec(`PRAGMA table_info(messages)`);
  if (res.length === 0) {
    sqlite.db.exec(queryToCreateMsgsDbV2);
    await saveLocally(sqlite);
    await msgsDbFile.updateXAttrs({
      set: { [DATASET_META_ATTR]: { datasetVersion: 2, db: MAIN_DB_META_ATTR } },
    });
  }

  const msgsOrphanedDbFile = await fsLocal.writableFile(`${MSGS_DBS_DIR_NAME}/${ORPHANED_MSGS_DBS_DIR_NAME}`);
  const auxiliarySqlite = await SQLiteOn3NStorage.makeAndStart(msgsOrphanedDbFile);
  const res1 = auxiliarySqlite.db.exec(`PRAGMA table_info(orphaned_messages)`);
  if (res1.length === 0) {
    auxiliarySqlite.db.exec(queryToCreateMsgsOrphanedDbV2);
    await saveLocally(auxiliarySqlite);
    await msgsOrphanedDbFile.updateXAttrs({
      set: { [DATASET_META_ATTR]: { datasetVersion: 2, db: AUXILIARY_DB_META_ATTR } },
    });
  }

  return {
    sqlite,
    auxiliarySqlite,
  };
}

export async function msgsDb({
  fs,
  fsLocal,
}: {
  fs: web3n.files.WritableFS;
  fsLocal: web3n.files.WritableFS;
}): Promise<MsgsDb> {
  const { sqlite, auxiliarySqlite } = await getSqliteDb({ fs, fsLocal, saveLocally });

  async function saveLocally(sql: SQLiteOn3NStorage) {
    await sql.saveToFile({ skipUpload: true });
  }

  async function addMessage(msg: MsgDbEntry) {
    const { insertParams, orderedColumns, orderedValues } = forTableInsert(
      {
        ...msg,
        settings: {},
        removeAfter: 0,
      },
      msgsTabFields,
    );

    sqlite.db.exec(
      `--sql
      INSERT INTO messages (${orderedColumns})
      VALUES (${orderedValues})`,
      insertParams,
    );
    await saveLocally(sqlite);
  }

  async function getMessage(id: ChatMessageId): Promise<MsgDbEntry | undefined> {
    const { whereMsg, whereMsgParams } = msgWhereParamsFor(id);
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT *
      FROM messages
      WHERE ${whereMsg}`,
      whereMsgParams,
    );

    if (sqlValue) {
      return fromQueryResult(sqlValue, msgsTabFields)[0];
    }
  }

  async function getMessagesInOneToOneChat(otoPeerCAddr: string) {
    const whereParams = queryParamsFrom<Pick<MsgDbEntry, 'otoPeerCAddr'>>({ otoPeerCAddr }, msgsTabFields);
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT *
      FROM messages
      WHERE ${whereClause}
      ORDER BY timestamp ASC`,
      whereParams,
    );
    return sqlValue ? fromQueryResult(sqlValue, msgsTabFields) : [];
  }

  async function getMessagesInGroupChat(chatId: string) {
    const whereParams = queryParamsFrom<Pick<MsgDbEntry, 'groupChatId'>>({ groupChatId: chatId }, msgsTabFields);
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT *
      FROM messages
      WHERE ${whereClause}
      ORDER BY timestamp ASC`,
      whereParams,
    );

    return sqlValue ? fromQueryResult(sqlValue, msgsTabFields) : [];
  }

  function getMessagesByChat({ isGroupChat, chatId }: ChatIdObj) {
    return isGroupChat ? getMessagesInGroupChat(chatId) : getMessagesInOneToOneChat(chatId);
  }

  function getNotRegularMessagesByChat(chatId: ChatIdObj): MsgDbEntry[] {
    const query = `--sql
    SELECT *, groupChatId || otoPeerCAddr AS chatId
    FROM messages
    WHERE chatId=$chatId AND (chatMessageType='system' OR chatMessageType='invitation')`;

    const [sqlValue] = sqlite.db.exec(query, { $chatId: chatId.chatId });
    const msgs = sqlValue
      ? fromQueryResult<MsgDbEntry & { chatId?: string; maxTS?: number }>(sqlValue, msgsTabFields)
      : null;

    if (!msgs) {
      return [];
    }

    for (const msg of msgs) {
      msg?.chatId && delete msg.chatId;
    }

    return msgs;
  }

  function getMessagesWithSyncingSelfStatus(): MsgDbEntry[] {
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT *
      FROM messages
      WHERE status='syncing_self' AND isIncomingMsg=0
      ORDER BY timestamp ASC`,
    );

    return sqlValue ? fromQueryResult(sqlValue, msgsTabFields) : [];
  }

  async function getExpiredMessages(now: number): Promise<MsgDbEntry[]> {
    const query = `--sql
    SELECT *
    FROM messages
    WHERE chatMessageType='regular' AND removeAfter<$now AND removeAfter<>0`;
    const [sqlValue] = sqlite.db.exec(query, { $now: now });
    return sqlValue ? fromQueryResult(sqlValue, msgsTabFields) : [];
  }

  async function deleteMessage(chatMessageId: ChatMessageId) {
    const { whereMsg, whereMsgParams } = msgWhereParamsFor(chatMessageId);
    sqlite.db.exec(
      `--sql
      DELETE
      FROM messages
      WHERE ${whereMsg}`,
      whereMsgParams,
    );
    if (sqlite.db.getRowsModified() > 0) {
      await saveLocally(sqlite);
    }
  }

  function getLatestMsgInChat({ chatId }: ChatIdObj): MsgDbEntry | null {
    const query = `--sql
      SELECT *, groupChatId || otoPeerCAddr AS chatId, MAX(timestamp) AS maxTS
      FROM messages
      WHERE chatId=$chatId
    `;

    const [sqlValue] = sqlite.db.exec(query, { $chatId: chatId });
    const msgs = sqlValue
      ? fromQueryResult<MsgDbEntry & { chatId?: string; maxTS?: number }>(sqlValue, msgsTabFields)
      : [null];

    msgs[0]?.chatId && delete msgs[0].chatId;
    msgs[0]?.maxTS && delete msgs[0].maxTS;

    return msgs[0];
  }

  function getUnreadMsgsCountIn({ isGroupChat, chatId }: ChatIdObj): number {
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
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT COUNT(*) AS unread
      FROM messages
      WHERE ${whereClause}`,
      whereParams,
    );

    return sqlValue ? objectFromQueryExecResult<{ unread: number }>(sqlValue)[0].unread : 0;
  }

  function getLatestIncomingMsgTimestamp(): number | undefined {
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT max(timestamp) as maxTS
      FROM messages
      WHERE isIncomingMsg = 1`,
    );
    if (!sqlValue) {
      return;
    }

    const { maxTS } = objectFromQueryExecResult<{ maxTS: number | null }>(sqlValue)[0];

    return maxTS === null ? undefined : maxTS;
  }

  async function getRecentReactions(quantity: number): Promise<string[]> {
    const sqlQuery = `--sql
      SELECT *
      FROM messages
      WHERE chatMessageType='regular' AND reactions IS NOT NULL
      ORDER BY timestamp DESC
      LIMIT ${quantity * 4}`;

    const [sqlValue] = sqlite.db.exec(sqlQuery);

    if (!sqlValue) {
      return [];
    }

    const ownAddr = await w3n.mail?.getUserId();

    const messages = sqlValue ? fromQueryResult(sqlValue, msgsTabFields) : [];
    const result = [] as string[];
    for (const msg of messages) {
      const { reactions } = msg;
      const reaction = (reactions as Record<string, ChatMessageReaction>)[ownAddr!];
      if (reaction && !result.includes(reaction.name)) {
        result.unshift(reaction.name);
      }
    }

    return result.splice(0, quantity);
  }

  async function getInboxMsgsOfOTOChat(otoPeerCAddr: string): Promise<string[]> {
    const whereParams = queryParamsFrom<Pick<MsgDbEntry, 'otoPeerCAddr' | 'isIncomingMsg'>>(
      { otoPeerCAddr, isIncomingMsg: true },
      msgsTabFields,
    );
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT incomingMsgId
      FROM messages
      WHERE ${whereClause} AND incomingMsgId IS NOT NULL`,
      whereParams,
    );

    return sqlValue ? fromQueryResult(sqlValue, msgsTabFields).map(r => r.incomingMsgId!) : [];
  }

  async function getInboxMsgsOfGroupChat(groupChatId: string): Promise<string[]> {
    const whereParams = queryParamsFrom<Pick<MsgDbEntry, 'groupChatId' | 'isIncomingMsg'>>(
      { groupChatId, isIncomingMsg: true },
      msgsTabFields,
    );
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT incomingMsgId
      FROM messages
      WHERE ${whereClause} AND incomingMsgId IS NOT NULL`,
      whereParams,
    );
    return sqlValue ? fromQueryResult(sqlValue, msgsTabFields).map(r => r.incomingMsgId!) : [];
  }

  async function getAllOutgoingMsgAttachmentsInGroupChat(
    groupChatId: string,
  ): Promise<RefsToMsgsDataNoInDB['outgoingMsgs']> {
    const whereParams = queryParamsFrom<Pick<MsgDbEntry, 'groupChatId' | 'isIncomingMsg'>>(
      { groupChatId, isIncomingMsg: false },
      msgsTabFields,
    );
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT chatMessageId, attachments
      FROM messages
      WHERE ${whereClause} AND attachments IS NOT NULL`,
      whereParams,
    );

    return sqlValue
      ? fromQueryResult(sqlValue, msgsTabFields).map(r => ({
          chatMsgId: r.chatMessageId,
          attachments: r.attachments!,
        }))
      : [];
  }

  async function getAllOutgoingMsgAttachmentsInOTOChat(
    otoPeerCAddr: string,
  ): Promise<RefsToMsgsDataNoInDB['outgoingMsgs']> {
    const whereParams = queryParamsFrom<Pick<MsgDbEntry, 'otoPeerCAddr' | 'isIncomingMsg'>>(
      { otoPeerCAddr, isIncomingMsg: false },
      msgsTabFields,
    );
    const whereClause = andEqualExprFor(whereParams);
    const [sqlValue] = sqlite.db.exec(
      `--sql
      SELECT chatMessageId, attachments
      FROM messages
      WHERE ${whereClause} AND attachments IS NOT NULL`,
      whereParams,
    );

    return sqlValue
      ? fromQueryResult(sqlValue, msgsTabFields).map(r => ({
          chatMsgId: r.chatMessageId,
          attachments: r.attachments!,
        }))
      : [];
  }

  async function msgsInInboxAndOutgoingAttachmentsInGroupChat(chatId: string): Promise<RefsToMsgsDataNoInDB> {
    const inboxMsgs = await getInboxMsgsOfGroupChat(chatId);
    const outgoingMsgs = await getAllOutgoingMsgAttachmentsInGroupChat(chatId);
    return { inboxMsgs, outgoingMsgs };
  }

  async function msgsInInboxAndOutgoingAttachmentsInOTOChat(otoPeerCAddr: string): Promise<RefsToMsgsDataNoInDB> {
    const inboxMsgs = await getInboxMsgsOfOTOChat(otoPeerCAddr);
    const outgoingMsgs = await getAllOutgoingMsgAttachmentsInOTOChat(otoPeerCAddr);

    return { inboxMsgs, outgoingMsgs };
  }

  async function deleteMessagesInOneToOneChat(otoPeerCAddr: string): Promise<boolean> {
    const whereGroupParams = queryParamsFrom<Pick<MsgDbEntry, 'otoPeerCAddr'>>({ otoPeerCAddr }, msgsTabFields);
    const whereGroup = andEqualExprFor(whereGroupParams);
    sqlite.db.exec(
      `--sql
      DELETE
      FROM messages
      WHERE ${whereGroup}`,
      whereGroupParams,
    );

    return sqlite.db.getRowsModified() > 0;
  }

  async function deleteMessagesInGroupChat(groupChatId: string): Promise<boolean> {
    const whereGroupParams = queryParamsFrom<Pick<MsgDbEntry, 'groupChatId'>>({ groupChatId }, msgsTabFields);
    const whereGroup = andEqualExprFor(whereGroupParams);
    sqlite.db.exec(
      `--sql
      DELETE
      FROM messages
      WHERE ${whereGroup}`,
      whereGroupParams,
    );
    return sqlite.db.getRowsModified() > 0;
  }

  async function deleteMessagesInChat({
    isGroupChat,
    chatId,
  }: ChatIdObj): Promise<RefsToMsgsDataNoInDB | undefined> {
    const dataNotInDB = isGroupChat
      ? await msgsInInboxAndOutgoingAttachmentsInGroupChat(chatId)
      : await msgsInInboxAndOutgoingAttachmentsInOTOChat(chatId);

    const dbUpdated = isGroupChat
      ? await deleteMessagesInGroupChat(chatId)
      : await deleteMessagesInOneToOneChat(chatId);

    if (dbUpdated) {
      await saveLocally(sqlite);
      return dataNotInDB;
    }
  }

  async function updateMessageRecord(
    chatMessageId: ChatMessageId,
    toUpdate: Partial<MsgDbEntry>,
  ): Promise<MsgDbEntry | undefined> {
    const { whereMsg, whereMsgParams } = msgWhereParamsFor(chatMessageId);
    const updateParams = queryParamsFrom(toUpdate, msgsTabFields);
    const setExpr = setExprFor<MsgDbEntry>(updateParams, ['groupChatId', 'otoPeerCAddr', 'chatMessageId']);
    sqlite.db.exec(
      `--sql
      UPDATE messages
      SET ${setExpr}
      WHERE ${whereMsg}`,
      {
        ...updateParams,
        ...whereMsgParams,
      },
    );

    if (sqlite.db.getRowsModified() > 0) {
      await saveLocally(sqlite);
      return await getMessage(chatMessageId);
    }
  }

  /* block for working with "phantom" incoming messages */
  async function addOrphanedMessage(data: OrphanedMsgDbEntry) {
    const { insertParams, orderedColumns, orderedValues } = forTableInsert(
      {
        ...data,
        bufferedAt: Date.now(),
      },
      msgsOrphanedTabFiels,
    );

    const [sqlValue] = auxiliarySqlite.db.exec(
      `--sql
      INSERT INTO orphaned_messages (${orderedColumns})
      VALUES (${orderedValues})`,
      insertParams,
    );

    if (sqlValue) {
      await saveLocally(auxiliarySqlite);
    }
  }

  function getStuckMessageForTargetMessageId(id: string) {
    const [sqlValue] = auxiliarySqlite.db.exec(
      `--sql
      SELECT *
      FROM orphaned_messages
      WHERE targetMessageId=$targetMessageId`,
      { $targetMessageId: id },
    );

    if (sqlValue) {
      return fromQueryResult(sqlValue, msgsOrphanedTabFiels)[0];
    }
  }

  async function deleteOrphanedMessage(id: string) {
    const [sqlValue] = auxiliarySqlite.db.exec(
      `--sql
      DELETE FROM orphaned_messages
      WHERE targetMessageId=$targetMessageId`,
      { $targetMessageId: id },
    );

    if (sqlValue) {
      await saveLocally(auxiliarySqlite);
    }
  }

  async function collectGarbageInAuxiliaryDB() {
    const expirationTimestamp = Date.now() - LIFETIME_DAYS_IN_AUXILIARY_DB;
    const [sqlValue] = auxiliarySqlite.db.exec(
      `--sql
      DELETE FROM orphaned_messages
      WHERE bufferedAt < $expirationTimestamp`,
      { $expirationTimestamp: expirationTimestamp },
    );

    if (sqlValue) {
      await saveLocally(auxiliarySqlite);
    }
  }

  return {
    addMessage,
    getMessage,
    getExpiredMessages,
    getMessagesByChat,
    getNotRegularMessagesByChat,
    getMessagesWithSyncingSelfStatus,
    getLatestIncomingMsgTimestamp,
    getLatestMsgInChat,
    getUnreadMsgsCountIn,
    getRecentReactions,
    deleteMessage,
    deleteMessagesInChat,
    updateMessageRecord,

    addOrphanedMessage,
    getStuckMessageForTargetMessageId,
    deleteOrphanedMessage,
    collectGarbageInAuxiliaryDB,
  };
}
