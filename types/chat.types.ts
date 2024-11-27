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

/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Nullable } from '@v1nt1248/3nclient-lib';

export type MessageDeliveryStatus = 'sending' | 'sent' | 'received' | 'error' | 'canceled';

export interface MessageDeliveryInfo {
  msgId: string;
  status: MessageDeliveryStatus;
  value: string | number;
}

export interface SendingMessageStatus {
  msgId?: string;
  status: web3n.asmail.DeliveryProgress | undefined;
  info: MessageDeliveryInfo | undefined;
}

export interface DeliveryMessageProgress {
  id: string;
  progress: web3n.asmail.DeliveryProgress;
}

export interface SendingError {
  mail: string;
  text: string;
}

export type ChatMessageType = 'regular' | 'system' | 'webrtc-call';
export type MessageType = 'incoming' | 'outgoing';

export type ChatSystemEventBase = 'add' | 'delete' | 'remove' | 'update' | 'send';
export type ChatSystemEventEntity = 'status' | 'chatName' | 'members' | 'admins' | 'message';
export type ChatSystemEvent = `${Partial<ChatSystemEventBase>}:${Partial<ChatSystemEventEntity>}`;

export type ChatMessageLocalMeta = `chat:${string}:${string}` // 'chat:${chatId}:${msgId}'

export interface ChatSystemMessageData {
  event: ChatSystemEvent;
  value: any;
  displayable?: boolean;
}

export interface ChatMessageJsonBody {
  chatId: string;
  chatName?: string;
  chatMessageType?: ChatMessageType;
  chatMessageId: string;
  members: string[];
  admins: string[];
  initialMessageId?: string;
  chatSystemData?: ChatSystemMessageData;
  webrtcMsg?: WebRTCMsg;
}

export interface WebRTCMsg {
  channel: string;
  data: WebRTCOffBandMessage | WebRTCOffBandMessage[];
}

export interface WebRTCOffBandMessage {
  description?: RTCSessionDescription;
  candidate?: any;
}

export interface ChatIncomingMessage extends web3n.asmail.IncomingMessage {
  msgType: 'chat';
  jsonBody: ChatMessageJsonBody;
}

export interface ChatOutgoingMessage extends web3n.asmail.OutgoingMessage {
  jsonBody: ChatMessageJsonBody;
  status?: MessageDeliveryStatus;
}

export interface ChatView {
  chatId: string;
  name: string;
  members: string[];
  admins: string[];
  createdAt: number;
}

export type ChatViewForDB = Omit<ChatView, 'members' | 'admins'> & { members: string, admins: string };

export interface ChatMessageAttachmentsInfo {
  id?: string;
  name: string;
  size: number;
}

export interface ChatMessageViewBase<T extends MessageType> {
  msgId: string;
  messageType: T;
  sender: string;
  body: string;
  chatId: string;
  chatMessageType: ChatMessageType;
  chatMessageId: string;
  initialMessageId: Nullable<string>;
  status?: MessageDeliveryStatus;
  timestamp: number;
}

export interface ChatMessageView<T extends MessageType> extends ChatMessageViewBase<T> {
  attachments: ChatMessageAttachmentsInfo[] | null;
}

export interface ChatMessageViewForDB<T extends MessageType> extends ChatMessageViewBase<T> {
  attachments: string | null;
}

export type ChatMessageActionType =
  'reply'
  | 'copy'
  | 'forward'
  | 'download'
  | 'resend'
  | 'delete_message'
  | 'cancel_sending';

export interface ChatMessageAction {
  id: ChatMessageActionType;
  icon: {
    name: string;
    horizontalFlip?: boolean;
    rotateIcon?: 1 | 2 | 3,
  };
  title: string;
  conditions: string[];
  blockStart?: boolean;
  accent?: string;
  disabled?: boolean;
}

export type ChatListItemView = ChatView & { unread: number } & ChatMessageView<MessageType>;
