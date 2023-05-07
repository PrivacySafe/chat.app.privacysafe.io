/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../../@types/chat.d.ts" />
// @deno-types="../sqlite-on-3nstorage/index.d.ts"
import { QueryExecResult } from '../sqlite-on-3nstorage/index.js'

type SqlValue = number | string | Uint8Array | Blob | null

export function objectFromQueryExecResult<T>(sqlResult: QueryExecResult): Array<T> {
  const { columns, values: rows } = sqlResult
  return rows.map((row: SqlValue[]) => row.reduce((obj, cellValue, index) => {
    const field = columns[index] as keyof T
    obj[field] = cellValue as any
    return obj
  }, {} as T))
}

export function chatValueToSqlInsertParams(value: ChatView) {
  const members = Array.isArray(value.members)
    ? value.members.sort()
    : []
  members.sort()
  return {
    $chatId: value.chatId,
    $name: value.name,
    $members: JSON.stringify(members),
    $createdAt: value.createdAt,
  }
}

export function messageValueToSqlInsertParams<T extends MessageType>(value: ChatMessageViewForDB<T>) {
  return {
    $chatMessageId: value.chatMessageId,
    $msgId: value.msgId,
    $messageType: value.messageType || 'outgoing',
    $sender: value.sender || null,
    $body: value.body,
    $attachments: value.attachments || null,
    $chatId: value.chatId,
    $chatMessageType: value.chatMessageType || 'regular',
    $initialMessageId: value.initialMessageId || null,
    $status: value.status,
    $timestamp: value.timestamp,
  }
}
