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


export interface ChatMessageJsonBodyV1Base {
  v: 1;

  /**
   * groupChatId of a group chat. Missing id implies one-to-one chat.
   * Invitations don't have this field.
   */
  groupChatId?: string;

}

export interface ChatSystemMsgV1 extends ChatMessageJsonBodyV1Base {
  chatMessageType: 'system';
  chatSystemData: ChatSystemMessageData;

  /**
   * chatMessageId is a unique identifier within given chat.
   * Expected form is an epoch in 100's of seconds, dash, short random part,
   * e.g. `${Math.floor(Date.now()/(100*1000))}-${randomString}` yielding
   * something like 17469720-eAkJmPpW.
   * This value is expected to be present on those system action that need
   * to be displayed, and thus, kept in a database.
   */
  chatMessageId?: string;
}

export interface ChatRegularMsgV1 extends ChatMessageJsonBodyV1Base {
  chatMessageType: 'regular';

  /**
   * chatMessageId is a unique identifier within given chat. It is useful for
   * database and referencing messages.
   * Expected form is an epoch in 100's of seconds, dash, short random part,
   * e.g. `${Math.floor(Date.now()/(100*1000))}-${randomString}` yielding
   * something like 17469720-eAkJmPpW.
   */
  chatMessageId: string;

  relatedMessage?: RelatedMessage;
}

export interface ChatInvitationMsgV1 extends ChatMessageJsonBodyV1Base {
  chatMessageType: 'invitation';

  /**
   * For invitation chatMessageId is generated like for any other message.
   * When new member is added, chatMessageId in invitation should be the
   * same as chatMessageId in system message that added new member, providing
   * continuity of record.
   */
  chatMessageId: string;

  inviteData: InvitationProcessMsgData;
}

export type InvitationProcessMsgData =
  GroupChatParameters
  | OneToOneChatParameters
  | AcceptedInvitationReference;

export interface GroupChatParameters {
  type: 'group-chat-invite';
  groupChatId: string;
  name: string;
  members: string[];
  admins: string[];
}

/**
 * OneToOneChatParameters contains parameters of sending side, acting like a
 * contact card.
 */
export interface OneToOneChatParameters {
  type: 'oto-chat-invite';
  name: string;
}

export type StoredInvitationParams = AcceptedInvitationReference | (
  (GroupChatParameters | OneToOneChatParameters) & {
    neverContactedInitiator?: boolean;
  }
);

export interface AcceptedInvitationReference {
  type: 'invite-acceptance';

  /**
   * initiator is an address that has sent the original invitation.
   */
  initiator: string;

  /**
   * chatMessageId is same as in the original invitation.
   */
  chatMessageId: string;

  /**
   * groupChat is same as in the original invitation.
   */
  groupChat?: GroupChatParameters;

  /**
   * oneToOneChat contains contact parameters of invitation accepting side.
   */
  oneToOneChat?: OneToOneChatParameters;
}

export interface ChatWebRTCMsgV1 extends ChatMessageJsonBodyV1Base {
  chatMessageType: 'webrtc-call';
  webrtcMsg: WebRTCMsg;
}


export type ChatMessageJsonBodyV1 =
  ChatSystemMsgV1
  | ChatRegularMsgV1
  | ChatInvitationMsgV1
  | ChatWebRTCMsgV1;

export interface ChatMessageJsonBodyPreV {
  v?: undefined;
  chatId: string;
  chatName?: string;
  chatMessageType?: ChatMessageJsonBodyV1['chatMessageType'];
  chatMessageId: string;
  members: string[];
  admins: string[];
  initialMessageId?: string;
  chatSystemData?: ChatSystemMessageData;
  webrtcMsg?: WebRTCMsg;
}

export type ChatMessageJsonBody = ChatMessageJsonBodyV1 | ChatMessageJsonBodyPreV;

export type ChatMessageType = 'regular' | 'system' | 'invitation' | 'webrtc-call';

export interface RelatedMessage {
  replyTo?: {
    chatMessageId: string;
  };
  forwardingOf?: ChatMessageId;
}

/**
 * System message to tell to delete chat message.
 * value field contains chatMessageId of a message that should be deleted.
 */
export interface DeleteMessageSysMsgData {
  event: 'delete:message';
  value: {
    oneMessage?: ChatMessageId;
    allInChat?: ChatIdObj;
  };
}

export interface UpdateMembersSysMsgData {
  event: 'update:members';
  value: {
    membersToDelete: string[];
    membersToAdd: string[];
    membersAfterUpdate: string[];
  };
}

export interface UpdatedChatNameSysMsgData {
  event: 'update:chatName';
  value: {
    name: string;
  };
}

export interface MemberLeftSysMsgData {
  /**
   * Sender of this message has left a chat.
   */
  event: 'member-left';
}

export interface MemberRemovalSysMsgData {
  /**
   * Recipient of this message is removed from membership in a chat.
   */
  event: 'member-removed';
  chatDeleted?: true;
}

export interface UpdatedMsgStatusSysMsgData {
  event: 'update:status';
  value: {
    chatMessageId: string;
    status: 'received' | 'read';
  };
}

export interface UpdatedMsgReactionSysMsgData {
  event: 'update:reaction';
  value: {
    chatMessageId: string;
    reaction: string;
  };
}

export interface UpdatedMsgBodySysMsgData {
  event: 'update:body';
  value: {
    chatMessageId: string;
    body: string;
  };
}

export type ChatSystemMessageData =
  UpdateMembersSysMsgData
  | MemberRemovalSysMsgData
  | MemberLeftSysMsgData
  | DeleteMessageSysMsgData
  | UpdatedChatNameSysMsgData
  | UpdatedMsgStatusSysMsgData
  | UpdatedMsgReactionSysMsgData
  | UpdatedMsgBodySysMsgData;

export interface WebRTCMsg {

  // XXX should we have more explicit stages here?
  // XXX explicit start and explicit close on non-webrtc will be more reliable

  // - stage: start, can be already with candidate(s) in first signalling.
  //          What happens with collision of simultaneous start?
  // - stage: signalling - just pass data
  // - stage: disconnect - close and send all appropriate notifications

  /**
   * stage 
   */
  stage: 'start' | 'signalling' | 'disconnect';
  id: number;
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
  msgType: 'chat';
  jsonBody: ChatMessageJsonBody;
}

/**
 * ChatIdObj contains flag to indicate whether this is a group chat, or a
 * one-to-one chat.
 * In one-to-one chat, internal chatId field is peer's canonical address
 * (otoPeerCAddr).
 * In group chat, internal chatId field is a random string that should be
 * unique for all members. Ensuring of uniqueness needs longer id, and
 * potential renegotiation process.
 */
export interface ChatIdObj {

  isGroupChat: boolean;

  /**
   * chatId of a one-to-one chat is peer's canonical address (otoPeerCAddr).
   * chatId of a group chat is a random string that should be
   * unique for all members. Ensuring of uniqueness needs longer id, and
   * potential renegotiation process.
   */
  chatId: string;
}

export interface ChatMessageId {
  chatId: ChatIdObj;
  chatMessageId: string;
}
