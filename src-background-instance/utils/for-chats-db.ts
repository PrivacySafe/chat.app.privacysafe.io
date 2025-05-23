/* eslint-disable @typescript-eslint/triple-slash-reference */
// @deno-types="../../shared-libs/sqlite-on-3nstorage/index.d.ts"
import { QueryExecResult } from '../../shared-libs/sqlite-on-3nstorage/index.js';
import type { ChatView, ChatMessageView, MessageType } from '../../types/index.ts';

type SqlValue = number | string | Uint8Array | Blob | null

export function objectFromQueryExecResult<T>(sqlResult: QueryExecResult): Array<T> {
  const { columns, values: rows } = sqlResult;
  return rows.map((row: SqlValue[]) => row.reduce((obj, cellValue, index) => {
    const field = columns[index] as keyof T;
    obj[field] = cellValue as any;
    return obj;
  }, {} as T));
}

export function chatValueToSqlInsertParams(value: ChatView) {
  const members = Array.isArray(value.members)
    ? value.members.sort()
    : [];
  members.sort();
  const admins = Array.isArray(value.admins)
    ? value.admins.sort()
    : [];

  return {
    $chatId: value.chatId,
    $name: value.name || null,
    $members: JSON.stringify(members),
    $admins: JSON.stringify(admins),
    $createdAt: value.createdAt,
  };
}

export function messageValueToSqlInsertParams<T extends MessageType>(value: ChatMessageView<T>) {
  return {
    $chatMessageId: value.chatMessageId,
    $msgId: value.msgId,
    $messageType: value.messageType || 'outgoing',
    $sender: value.sender || null,
    $body: value.body,
    $attachments: value.attachments ? JSON.stringify(value.attachments) : null,
    $chatId: value.chatId,
    $chatMessageType: value.chatMessageType || 'regular',
    $initialMessageId: value.initialMessageId || null,
    $status: value.status,
    $timestamp: value.timestamp,
  };
}
