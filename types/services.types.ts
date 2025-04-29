/*
 Copyright (C) 2024 - 2025 3NSoft Inc.

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

import type { Person, PersonView } from './contact.types';
import type {
  ChatView,
  ChatIncomingMessage,
  ChatMessageView,
  ChatMessageLocalMeta,
  ChatOutgoingMessage,
  SendingMessageStatus,
  MessageType,
  WebRTCMsg,
  WebRTCOffBandMessage,
} from './chat.types';
import type { IncomingCallCmdArg } from './chat-commands.types';

/**
 * This service comes from contacts app
 */
export interface AppContacts {
  getContact(id: string): Promise<Person>;
  getContactList(): Promise<PersonView[]>;
  upsertContact(value: Person): Promise<void>;
}

/**
 * This app's service.
 * It is a singleton in "background instance" component.
 * This service manages data state of chats app.
 */
export interface AppChatsSrv {
  getChatList(): Promise<Array<ChatView & ChatMessageView<MessageType>>>;
  getChatsUnreadMessagesCount(): Promise<Record<string, number>>;
  createChat(
    { chatId, members, admins, name }: { chatId?: string, members: string[], admins: string[], name: string },
  ): Promise<string>;
  updateChat(value: ChatView): Promise<void>;
  getChat(chatId: string): Promise<ChatView | null>;
  deleteChat(chatId: string): Promise<void>;
  deleteMessagesInChat(chatId: string): Promise<void>;
  getMessage(
    { msgId, chatMsgId }: { msgId?: string, chatMsgId?: string },
  ): Promise<ChatMessageView<MessageType>|null>;
  deleteMessage({ msgId, chatMsgId }: { msgId?: string, chatMsgId?: string }): Promise<void>;
  getMessagesByChat(chatId: string): Promise<ChatMessageView<MessageType>[]>;
  upsertMessage(value: ChatMessageView<MessageType>): Promise<void>;
}

/**
 * This app's service.
 * It is a singleton in "background instance" component.
 * This service does ASMail sending.
 */
export interface AppDeliverySrv {
  checkAddressExistenceForASMail(addr: string): Promise<AddressCheckResult>;
  addMessageToDeliveryList(
    message: ChatOutgoingMessage, localMetaPath: ChatMessageLocalMeta, systemMessage?: boolean,
  ): Promise<void>;
  removeMessageFromDeliveryList(msgIds: string[]): Promise<void>;
  getMessage(msgId: string): Promise<ChatIncomingMessage | undefined>;
  getDeliveryList(localMetaPath: ChatMessageLocalMeta): Promise<SendingMessageStatus[]>;
  removeMessageFromInbox(msgIds: string[]): Promise<void>;
}

export type AddressCheckResult = 'found' | 'found-but-access-restricted' | 'not-present-at-domain' | 'no-service-for-domain';

/**
 * This app's service.
 * It is a singleton in "background instance" component.
 * This service does ASMail sending.
 */
export interface AppDeliveryService {
  watchIncomingMessages(obs: web3n.Observer<ChatIncomingMessage>): () => void;
  watchOutgoingMessages(obs: web3n.Observer<{id: string, progress: web3n.asmail.DeliveryProgress}>): () => void;
}

export interface FileLinkStoreService {
  saveLink(file: web3n.files.ReadonlyFile): Promise<string>;
  getLink(fileId: string): Promise<web3n.files.SymLink|null|undefined>;
  getFile(fileId: string): Promise<web3n.files.Linkable|null|undefined>;
  deleteLink(fileId: string): Promise<void>;
}

/**
 * This app's service.
 * It is a singleton in "background instance" component.
 * This service manages video chat windows: opens them, keeps track of them,
 * passes signals to them, etc.
 */
export interface VideoGUIOpener {
  startVideoCallForChatRoom(chatId: string): Promise<void>;
  joinCallInRoom(callDetails: IncomingCallCmdArg): Promise<void>;
  watchVideoChats(obs: web3n.Observer<VideoChatEvent>): () => void;
}

export interface VideoChatEvent {
  type: 'gui-closed' | 'gui-opened' | 'call-started' | 'call-ended';
  chatId: string;
}

/**
 * This app's service.
 * It is present in every instance of "video chat" component.
 * This service provides control over respective video chat window.
 */
export interface VideoChatComponent {
  focusWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  watch(obs: web3n.Observer<CallGUIEvent>): () => void;
  startCallGUIForChat(chat: ChatInfoForCall): Promise<void>;
  handleWebRTCSignal(peerAddr: string, msg: WebRTCMsg): Promise<void>;
}

export type CallGUIEvent =
  StartChannelEvent | CloseChannelEvent | OutgoingWebRTCSignalEvent |
  CallStartedEvent;

export interface OutgoingWebRTCSignalEvent {
  type: 'webrtc-signal';
  peerAddr: string;
  channel: string;
  data: WebRTCOffBandMessage;
}

export interface StartChannelEvent {
  type: 'start-channel';
  channel: string;
  peerAddr: string;
}

export interface CloseChannelEvent {
  type: 'close-channel';
  channel: string;
  peerAddr: string;
}

export interface CallStartedEvent {
  type: 'call-started';
}

export interface ChatInfoForCall {
  chatId: string;
  ownAddr: string;
  ownName: string;
  peers: {
    addr: string;
    name: string;
  }[];
  chatName: string;
  rtcConfig: RTCConfiguration;
}

export interface ContactsException extends web3n.RuntimeException {
  type: 'contacts';
  contactAlreadyExists?: true;
  invalidValue?: true;
  failASMailCheck?: true;
}
