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

import type {
  ChatIdObj,
  ChatMessageId,
  ChatIncomingMessage,
  RelatedMessage,
  UpdateMembersSysMsgData,
  WebRTCMsg,
  WebRTCOffBandMessage,
  UpdateAdminsSysMsgData,
  WebRTCMsgBodySysMsgData,
  ChatOutgoingMessage,
  ChatSystemMsgV1,
} from './asmail-msgs.types';
import type {
  ChatMessageView,
  ChatListItemView,
  SingleChatView,
  GroupChatView, ChatMessageReaction,
} from './chat.types';
import type { MsgDbEntry } from '@bg/dataset/versions/v2/msgs-db.ts';
import { SendingProgressInfo } from '@bg/chat-service';
import type { ChatSettings } from '@bg/dataset/versions/v2/chats-db.ts';

/**
 * This app's service.
 * It is a singleton in "background instance" component.
 * This service manages data state of chats app.
 */
export interface ChatServiceIPC {

  /**
   * Creates new one-to-one chat. In case of an error it throws quite soon.
   * When local data allows chat creation, this returns id of created chat.
   * New chat object is pushed in event, observable via watch() method.
   * @param value contains chat parameters and this user's own name, which peer
   * can use as a name of this one-to-one chat.
   */
  createOneToOneChat(
    value: Pick<SingleChatView, 'peerAddr' | 'name'> & { ownName?: string },
  ): Promise<ChatIdObj>;

  /**
   * Accepts chat invitation.
   * @param chatId
   * @param chatMessageId
   * @param ownName is a name one wants to use in the chat
   */
  acceptChatInvitation(
    chatId: ChatIdObj, chatMessageId: string, ownName: string,
  ): Promise<void>;

  /**
   * Creates new group chat. In case of an error it throws quite soon.
   * When local data allows chat creation, this returns id of created chat.
   * New chat object is pushed in event, observable via watch() method.
   * @param value contains parameters of a group chat.
   */
  createGroupChat(
    value: Pick<GroupChatView, 'chatId' | 'members' | 'name'>,
  ): Promise<ChatIdObj>;

  getChatList(): Promise<ChatListItemView[]>;

  renameChat(chatId: ChatIdObj, newName: string): Promise<void>;

  chatSetUp(chatId: ChatIdObj, data: Partial<ChatSettings>): Promise<void>;

  deleteChat(chatId: ChatIdObj): Promise<void>;

  updateGroupMembers(chatId: ChatIdObj, changes: UpdateMembersSysMsgData['value']): Promise<void>;

  updateGroupAdmins(chatId: ChatIdObj, changes: UpdateAdminsSysMsgData['value']): Promise<void>;

  getChat(chatId: ChatIdObj): Promise<ChatListItemView | undefined>;

  postProcessingForVideoChat(): {
    doAfterStartCall: (
      { chatId, direction, sender }:
      { chatId: ChatIdObj; direction: 'incoming' | 'outgoing'; sender?: string },
    ) => Promise<void>;
    doAfterEndCall: (chatId: ChatIdObj) => Promise<void>;
  };

  deleteMessagesInChat(
    chatId: ChatIdObj, deleteForEveryone: boolean,
  ): Promise<void>;

  deleteMessage(id: ChatMessageId, deleteForEveryone: boolean): Promise<void>;

  deleteMessages(chatMsgIds: ChatMessageId[], deleteForEveryone: boolean): Promise<void>;

  deleteExpiredMessages(now: number): Promise<void>;

  getMessage(id: ChatMessageId): Promise<ChatMessageView | undefined>;

  getMessagesByChat(chatId: ChatIdObj): Promise<ChatMessageView[]>;

  getRecentReactions(quantity: number): Promise<string[]>;

  sendRegularMessage(
    { chatId, chatMessageId, text, files, relatedMessage }: {
      chatId: ChatIdObj,
      chatMessageId?: string,
      text: string,
      files: (web3n.files.ReadonlyFile | web3n.files.ReadonlyFS)[] | undefined,
      relatedMessage: RelatedMessage | undefined,
    }): Promise<void>;

  cancelSendingMessage(deliveryId: string, chatMsgId: ChatMessageId): Promise<void>;

  markMessageAsReadNotifyingSender(chatMessageId: ChatMessageId): Promise<void>;

  checkAddressExistenceForASMail(addr: string): Promise<AddressCheckResult>;

  // XXX will this be needed? Or, will this turn to get attachments thing?
  getIncomingMessage(msgId: string): Promise<ChatIncomingMessage | undefined>;

  watch(obs: web3n.Observer<UpdateEvent>): () => void;

  updateEarlySentMessage(
    { chatId, chatMessageId, updatedBody }:
    { chatId: ChatIdObj; chatMessageId: string; updatedBody: string },
  ): Promise<ChatMessageView | undefined>;

  changeMessageReaction(
    { chatId, chatMessageId, updatedReactions }:
    { chatId: ChatIdObj; chatMessageId: string; updatedReactions: Record<string, ChatMessageReaction> },
  ): Promise<ChatMessageView | undefined>;

  sendSystemDeletableMessage(
    { chatId, recipients, chatMessageId, chatSystemData }:
      { chatId: ChatIdObj; recipients: string[] } & Pick<ChatSystemMsgV1, 'chatMessageId' | 'chatSystemData'>,
  ): Promise<void>;

  makeAndSaveMsgToDb(ownAddr: string, msgData: Partial<MsgDbEntry>): Promise<ChatMessageView>;
}

export interface ChatEventBase {
  updatedEntityType: 'chat';
}

export interface ChatUpdatedEvent extends ChatEventBase {
  event: 'updated';
  chat: ChatListItemView;
}

export interface ChatRemovedEvent extends ChatEventBase {
  event: 'removed';
  chatId: ChatIdObj;
}

export interface AllChatMessagesRemovedEvent extends ChatEventBase {
  event: 'messages-removed';
  chatId: ChatIdObj;
}

export interface ChatAddedEvent extends ChatEventBase {
  event: 'added';
  chat: ChatListItemView;
}

export interface ChatWebRTCCallEvent extends ChatEventBase {
  event: 'webRTCCall';
  value: {
    msg: ChatIncomingMessage | ChatOutgoingMessage;
    data: WebRTCMsgBodySysMsgData['value'];
  };
}

export type ChatEvent =
  ChatAddedEvent
  | ChatUpdatedEvent
  | ChatRemovedEvent
  | AllChatMessagesRemovedEvent
  | ChatWebRTCCallEvent;

export interface ChatMessageEventBase {
  updatedEntityType: 'message';
}

export interface ChatMessageAddedEvent extends ChatMessageEventBase {
  event: 'added';
  msg: ChatMessageView;
}

export interface ChatMessageUpdatedEvent extends ChatMessageEventBase {
  event: 'updated';
  msg: ChatMessageView;
}

export interface ChatMessageRemovedEvent extends ChatMessageEventBase {
  event: 'removed';
  msgId: ChatMessageId;
}

export interface ChatMessageRemovedMultipleEvent extends ChatMessageEventBase {
  event: 'removed-multiple';
  chatMsgIds: ChatMessageId[];
}

export interface ChatMessageSendingProgressEvent extends ChatMessageEventBase {
  event: 'sending-progress';
  data: SendingProgressInfo;
}

export type ChatMessageEvent =
  ChatMessageAddedEvent
  | ChatMessageUpdatedEvent
  | ChatMessageRemovedEvent
  | ChatMessageRemovedMultipleEvent
  | ChatMessageSendingProgressEvent;

export type UpdateEvent = ChatEvent | ChatMessageEvent;

export type AddressCheckResult =
  'found'
  | 'found-but-access-restricted'
  | 'not-present-at-domain'
  | 'no-service-for-domain'
  | 'not-valid-public-key';

export interface FileLinkStoreService {
  saveFile(data: ArrayBuffer, fileName?: string): Promise<string>;

  saveLink(entity: web3n.files.ReadonlyFile | web3n.files.ReadonlyFS): Promise<string>;

  getLink(entityId: string): Promise<web3n.files.SymLink | null | undefined>;

  getFile(entityId: string): Promise<web3n.files.File | web3n.files.FS | null | undefined>;

  deleteLink(entityId: string): Promise<void>;
}

/**
 * This app's service.
 * It is a singleton in "background instance" component.
 * This service manages video chat windows: opens them, keeps track of them,
 * passes signals to them, etc.
 */
export interface VideoGUIOpener {
  startVideoCallForChatRoom(chatId: ChatIdObj): Promise<void>;

  endVideoCallInChatRoom(chatId: ChatIdObj): Promise<void>;

  joinOrDismissCallInRoom(chatId: ChatIdObj, join: boolean, sender?: string): Promise<void>;

  watchVideoChats(obs: web3n.Observer<VideoChatEvent>): () => void;
}

export interface VideoChatEvent {
  type: 'gui-closed' | 'gui-opened' | 'call-started' | 'call-ended' | 'close-channel';
  chatId: ChatIdObj;
  peerAddr?: string;
}

/**
 * This app's service.
 * VideoChatComponent service exposes control of video component to background.
 * Methods are used by background to control video component, while watching
 * method is used to consume from video side both call requests and events.
 */
export interface VideoChatComponent {
  /**
   * This service call
   * @param chat
   */
  startVideoCallComponentForChat(chat: ChatInfoForCall): Promise<void>;

  focusWindow(): Promise<void>;

  endCall(): Promise<void>;

  /**
   * Absorbs WebRTC signalling messages that come to this particular video
   * component instance.
   * @param peerAddr identifies from which peer this message is from
   * @param msg message itself
   */
  handleWebRTCSignal(peerAddr: string, msg: WebRTCMsg): Promise<void>;

  /**
   * This absorbs different requests from video to gui component, reusing
   * single service connection.
   * @param obs for requests and events from video component to background
   */
  watchRequests(obs: web3n.Observer<CallFromVideoGUI>): () => void;

  notifyBkgrndInstanceOnCallStart(): void;

  sendSystemWebRTCMsg(
    { chatId, recipients, chatMessageId, chatSystemData }:
    { chatId: ChatIdObj; recipients: string[]; chatMessageId?: string; chatSystemData: WebRTCMsgBodySysMsgData },
  ): Promise<void>;
}

export type CallFromVideoGUI = StartChannelRequest
  | CloseChannelRequest
  | SendWebRTCSignalRequest
  | CallStartedEvent;

export interface SendWebRTCSignalRequest {
  type: 'send-webrtc-signal';
  peerAddr: string;
  data: WebRTCOffBandMessage;
}

export interface StartChannelRequest {
  type: 'start-channel';
  peerAddr: string;
}

export interface CloseChannelRequest {
  type: 'close-channel';
  peerAddr: string;
}

export interface CallStartedEvent {
  type: 'call-started-event';
}

export interface ChatInfoForCall {
  chatId: ChatIdObj;
  ownAddr: string;
  ownName: string;
  peers: {
    addr: string;
    name: string;
  }[];
  chatName: string;
  rtcConfig: RTCConfiguration;
}
