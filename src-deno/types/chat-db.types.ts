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
import type { ChatIdObj } from '../../types/asmail-msgs.types.ts';
import type { GroupChatStatus, SingleChatStatus } from '../../types/chat.types.ts';
import type { MsgDbEntry, RefsToMsgsDataNoInDB } from './msgs-db.types.ts';

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

export type GroupChatDbRecord = Omit<GroupChatDbEntry, 'members' | 'admins'> & {
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

export interface ChatsDb {
  findChat(chatIdObj: ChatIdObj): ChatDbEntry | undefined;
  addOneToOneChat(
    params: Omit<OTOChatDbEntry, 'createdAt' | 'lastUpdatedAt' | 'peerCAddr'>,
  ): Promise<OTOChatDbEntry>;
  addGroupChat(chat: Omit<GroupChatDbEntry, 'createdAt' | 'lastUpdatedAt'>): Promise<GroupChatDbEntry>;
  updateOTOChatRecord(peerCAddr: string, toUpdate: Partial<OTOChatDbEntry>): Promise<OTOChatDbEntry | undefined>;
  updateGroupChatRecord(
    chatId: string,
    toUpdate: Partial<GroupChatDbEntry>,
  ): Promise<GroupChatDbEntry | undefined>;
  getChatList(): ChatDbEntry[];
  deleteChat(chatId: ChatIdObj): Promise<RefsToMsgsDataNoInDB | undefined>;
}
