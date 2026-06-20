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
import type { ChatIdObj, ChatMessageId, RelatedMessage } from '../../types/asmail-msgs.types.ts';
import type {
  ChatMessageAttachmentsInfo,
  ChatMessageHistory,
  ChatMessageReaction,
  MessageStatus,
} from '../../types/chat.types.ts';
import type { GroupChatDbEntry, OTOChatDbEntry } from './chat-db.types.ts';

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
  settings?: Record<string, unknown> | null;
  removeAfter: number;
}

export interface RefsToMsgsDataNoInDB {
  inboxMsgs: string[];
  outgoingMsgs: {
    chatMsgId: string;
    attachments: ChatMessageAttachmentsInfo[];
  }[];
}

export interface OrphanedMsgDbEntry {
  groupChatId: GroupChatDbEntry['chatId'] | null;
  otoPeerCAddr: OTOChatDbEntry['peerCAddr'] | null;
  incomingMsgId: string | null;
  targetMessageId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawPayload: any;
  bufferedAt: number;
}

export interface MsgsDb {
  addMessage(msg: MsgDbEntry): Promise<void>;
  getMessage(id: ChatMessageId): Promise<MsgDbEntry | undefined>;
  getExpiredMessages(now: number): Promise<MsgDbEntry[]>;
  getMessagesByChat(chatIdObj: ChatIdObj): Promise<MsgDbEntry[]>;
  getNotRegularMessagesByChat(chatId: ChatIdObj): MsgDbEntry[];
  getMessagesWithSyncingSelfStatus(): MsgDbEntry[];
  getLatestIncomingMsgTimestamp(): number | undefined;
  getLatestMsgInChat(chatIdObj: ChatIdObj): MsgDbEntry | null;
  getUnreadMsgsCountIn(chatIdObj: ChatIdObj): number;
  getRecentReactions(quantity: number): Promise<string[]>;
  deleteMessage(chatMessageId: ChatMessageId): Promise<void>;
  deleteMessagesInChat(chatIdObj: ChatIdObj): Promise<RefsToMsgsDataNoInDB | undefined>;
  updateMessageRecord(
    chatMessageId: ChatMessageId,
    toUpdate: Partial<MsgDbEntry>,
  ): Promise<MsgDbEntry | undefined>;

  addOrphanedMessage(data: OrphanedMsgDbEntry): Promise<void>;
  getStuckMessageForTargetMessageId(id: string): OrphanedMsgDbEntry | undefined;
  deleteOrphanedMessage(id: string): Promise<void>;
  collectGarbageInAuxiliaryDB(): Promise<void>;
}
