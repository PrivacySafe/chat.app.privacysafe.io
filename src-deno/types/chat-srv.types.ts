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
import type {
  ChatIdObj,
  ChatIncomingMessage,
  ChatMessageId,
  ChatSystemMsgV1,
  RelatedMessage,
  UpdateMembersSysMsgData,
  UpdateAdminsSysMsgData,
  ChatOutgoingMessage,
  WebRTCMsgBodySysMsgData,
} from '../../types/asmail-msgs.types.ts';
import type {
  GroupChatView,
  ChatListItemView,
  ChatMessageReaction,
  ChatMessageView,
  SingleChatView,
} from '../../types/chat.types.ts';
import type { AddressCheckResult, UpdateEvent } from '../../types/services.types.ts';
import type { ChatDbEntry, ChatSettings, GroupChatDbEntry, OTOChatDbEntry } from './chat-db.types.ts';
import type { MsgDbEntry } from './msgs-db.types.ts';

export interface SendingProgressInfo {
  id: string;
  progress: web3n.asmail.DeliveryProgress;
}

export interface ChatMessagesHandler {
  handleIncomingMsg: (msg: ChatIncomingMessage) => Promise<void>;
  handleSendingProgress: (info: SendingProgressInfo) => Promise<void>;
}

export interface ChatSrvEmit {
  chat: {
    added: (chat: GroupChatDbEntry | OTOChatDbEntry) => void;
    removed: (chatId: ChatIdObj) => void;
    updated: (chat: GroupChatDbEntry | OTOChatDbEntry | undefined) => void;
    allMsgsRemoved: (chatId: ChatIdObj) => void;
    webRTCCall: (msg: ChatIncomingMessage | ChatOutgoingMessage, value: WebRTCMsgBodySysMsgData['value']) => void;
  };
  message: {
    added: (msg: MsgDbEntry) => void;
    removed: (msgId: ChatMessageId) => void;
    removedMultiple: (chatMsgIds: ChatMessageId[]) => void;
    updated: (msg: MsgDbEntry | undefined) => void;
  };
}

export interface ChatSrv {
  getAppDeviceId(): string;

  makeChatMessagesHandler(): ChatMessagesHandler;

  /**
   * Creates new one-to-one chat. In case of an error it throws quite soon.
   * When local data allows chat creation, this returns id of created chat.
   * New chat object is pushed in event, observable via watch() method.
   */
  createOneToOneChat(params: Pick<SingleChatView, 'peerAddr' | 'name'> & { ownName?: string }): Promise<ChatIdObj>;

  /**
   * Accepts chat invitation.
   * @param chatId
   * @param chatMessageId
   * @param ownName is a name one wants to use in the chat
   */
  acceptChatInvitation(chatId: ChatIdObj, chatMessageId: string, ownName: string): Promise<void>;

  /**
   * Creates new group chat. In case of an error it throws quite soon.
   * When local data allows chat creation, this returns id of created chat.
   * New chat object is pushed in event, observable via watch() method.
   * @param value contains parameters of a group chat.
   */
  createGroupChat(value: Pick<GroupChatView, 'chatId' | 'members' | 'name'>): Promise<ChatIdObj>;

  getChatList(): Promise<ChatListItemView[]>;

  renameChat(chatId: ChatIdObj, newName: string): Promise<void>;

  chatSetUp(chatId: ChatIdObj, data: Partial<ChatSettings>): Promise<void>;

  deleteChat(chatId: ChatIdObj): Promise<void>;

  updateGroupMembers(chatId: ChatIdObj, changes: UpdateMembersSysMsgData['value']): Promise<void>;

  updateGroupAdmins(chatId: ChatIdObj, changes: UpdateAdminsSysMsgData['value']): Promise<void>;

  getChat(chatId: ChatIdObj): Promise<ChatListItemView | undefined>;

  findChatEntry(chatId: ChatIdObj, throwIfMissing?: boolean): ChatDbEntry | undefined;

  postProcessingForVideoChat(): {
    doAfterStartCall: ({
      chatId,
      direction,
      sender,
    }: {
      chatId: ChatIdObj;
      direction: 'incoming' | 'outgoing';
      sender?: string;
    }) => Promise<void>;
    doAfterEndCall: (chatId: ChatIdObj) => Promise<void>;
  };

  deleteMessagesInChat(chatId: ChatIdObj, deleteForEveryone: boolean): Promise<void>;

  deleteMessage(id: ChatMessageId, deleteForEveryone: boolean): Promise<void>;

  deleteMessages(chatMsgIds: ChatMessageId[], deleteForEveryone: boolean): Promise<void>;

  deleteExpiredMessages(now: number): Promise<void>;

  getLatestIncomingMsgTimestamp(): number | undefined;

  getMessage(id: ChatMessageId): Promise<ChatMessageView | undefined>;

  getMessagesByChat(chatId: ChatIdObj): Promise<ChatMessageView[]>;

  getRecentReactions(quantity: number): Promise<string[]>;

  sendRegularMessage({
    chatId,
    chatMessageId,
    text,
    files,
    relatedMessage,
  }: {
    chatId: ChatIdObj;
    chatMessageId?: string;
    text: string;
    files: (web3n.files.ReadonlyFile | web3n.files.ReadonlyFS)[] | undefined;
    relatedMessage: RelatedMessage | undefined;
  }): Promise<void>;

  cancelSendingMessage(deliveryId: string, chatMsgId: ChatMessageId): Promise<void>;

  markMessageAsReadNotifyingSender(chatMessageId: ChatMessageId): Promise<void>;

  checkAddressExistenceForASMail(addr: string): Promise<AddressCheckResult>;

  // XXX will this be needed? Or, will this turn to get attachments thing?
  getIncomingMessage(msgId: string): Promise<ChatIncomingMessage | undefined>;

  watch(obs: web3n.Observer<UpdateEvent>): () => void;

  updateEarlySentMessage({
    chatId,
    chatMessageId,
    updatedBody,
  }: {
    chatId: ChatIdObj;
    chatMessageId: string;
    updatedBody: string;
  }): Promise<ChatMessageView | undefined>;

  changeMessageReaction({
    chatId,
    chatMessageId,
    updatedReactions,
  }: {
    chatId: ChatIdObj;
    chatMessageId: string;
    updatedReactions: Record<string, ChatMessageReaction>;
  }): Promise<ChatMessageView | undefined>;

  sendSystemDeletableMessage({
    chatId,
    recipients,
    chatMessageId,
    chatSystemData,
  }: { chatId: ChatIdObj; recipients: string[] } & Pick<
    ChatSystemMsgV1,
    'chatMessageId' | 'chatSystemData'
  >): Promise<void>;

  makeAndSaveMsgToDb(ownAddr: string, msgData: Partial<MsgDbEntry>): Promise<ChatMessageView>;
}
