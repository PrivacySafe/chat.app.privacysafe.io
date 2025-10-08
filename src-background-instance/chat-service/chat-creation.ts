/*
 Copyright (C) 2020 - 2025 3NSoft Inc.

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

import type { ChatsData } from '../dataset/index.ts';
import type { GroupChatStatus, GroupChatView, SingleChatView } from '../../types/chat.types.ts';
import type { ChatIdObj, ChatMessageId, InvitationProcessMsgData } from '../../types/asmail-msgs.types.ts';
import type { ChatService } from './index.ts';
import {
  chatIdOfGroupChat,
  chatIdOfOTOChat,
  excludeAddrFrom,
  makeMsgDbEntry,
  recipientsInChat,
} from './common-transforms.ts';
import { sendChatInvitation } from '../utils/send-chat-msg.ts';
import type {
  AcceptedInvitationReference,
  ChatIncomingMessage,
  ChatInvitationMsgV1,
  GroupChatParameters,
  OneToOneChatParameters,
  StoredInvitationParams,
} from '../../types/asmail-msgs.types.ts';
import { generateChatMessageId } from '../../shared-libs/chat-ids.ts';
import { GroupChatDbEntry, OTOChatDbEntry } from '../dataset/versions/v2/chats-db.ts';
import { includesAddress, toCanonicalAddress } from '../../shared-libs/address-utils.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';
import type { MsgDbEntry } from '@bg/dataset/versions/v2/msgs-db.ts';

export class ChatCreation {
  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly ownAddr: string,
    private readonly removeMessageFromInbox:
    ChatService['removeMessageFromInbox'],
  ) {
  }

  async createOneToOneChat(
    { peerAddr, name, ownName }: Pick<SingleChatView, 'peerAddr' | 'name'> & { ownName: string },
  ): Promise<ChatIdObj> {
    // create chat db record
    const chat = await this.data.addOneToOneChat({
      peerAddr,
      name,
      settings: {
        autoDeleteMessages: '0',
      },
      status: 'initiated',
    });
    this.emit.chat.added(chat);

    // send invitations, recoding it locally as well
    const { chatMessageId, timestamp } = generateChatMessageId();
    const inviteData: OneToOneChatParameters = {
      type: 'oto-chat-invite',
      name: ownName,
    };
    const msg = makeMsgDbEntry('invitation', chatMessageId, {
      otoPeerCAddr: chat.peerCAddr,
      body: JSON.stringify(inviteData),
      timestamp,
    });

    await this.data.addMessage(msg);
    this.emit.message.added(msg);

    const chatId = chatIdOfOTOChat(chat);
    await sendChatInvitation(chatId, [peerAddr], {
      chatMessageId, inviteData,
    });

    return chatId;
  }

  async createGroupChat(
    { chatId: groupChatId, name, members, admins }: Pick<GroupChatView, 'chatId' | 'members' | 'admins' | 'name'>,
  ): Promise<ChatIdObj> {
    // some checks
    if (!includesAddress(Object.keys(members), this.ownAddr) || !includesAddress(admins, this.ownAddr)) {
      throw new Error(`Own address is not among of both members and admins`);
    }

    // create chat db record
    const chat = await this.data.addGroupChat({
      chatId: groupChatId,
      name,
      members,
      admins,
      settings: {
        autoDeleteMessages: '0',
      },
      status: 'initiated',
    });
    this.emit.chat.added(chat);
    const chatId = chatIdOfGroupChat(chat);

    // send invitations, recoding it locally as well
    const recipients = excludeAddrFrom(Object.keys(chat.members), this.ownAddr);
    if (recipients.length > 0) {
      const { chatMessageId, timestamp } = generateChatMessageId();
      const inviteData: GroupChatParameters = {
        type: 'group-chat-invite',
        groupChatId, name, members, admins,
      };

      const msg = makeMsgDbEntry('invitation', chatMessageId, {
        groupChatId: chat.chatId,
        body: JSON.stringify(inviteData),
        timestamp,
      });
      await this.data.addMessage(msg);

      this.emit.message.added(msg);

      await sendChatInvitation(
        chatId,
        recipients,
        { chatMessageId, inviteData },
      );
    }

    return chatId;
  }

  async handleChatInvitation(msg: ChatIncomingMessage): Promise<void> {
    const { sender, jsonBody, deliveryTS, establishedSenderKeyChain } = msg;
    const neverContactedInitiator = !establishedSenderKeyChain;
    const { chatMessageId, inviteData } = jsonBody as ChatInvitationMsgV1;

    if (inviteData.type === 'invite-acceptance') {
      return await this.handleInvitationAcceptance(sender, inviteData, msg);
    }

    const chatId = inviteChatId(sender, inviteData);

    if (!chatId) {
      return this.handleMaformedInvitation(msg.msgId);
    }

    if (this.data.findChat(chatId)) {
      return this.removeMessageFromInbox(
        msg.msgId,
        `Incoming chat invitation message ${msg.msgId} is for existing chat. Removing it from inbox.`,
      );
    }

    switch (inviteData.type) {
      case 'oto-chat-invite': {
        await this.handleOTOChatInvitation(
          sender,
          chatMessageId,
          inviteData,
          msg.msgId,
          deliveryTS,
          neverContactedInitiator,
        );
        return this.removeMessageFromInbox(msg.msgId);
      }

      case 'group-chat-invite': {
        const { members, admins } = inviteData;
        if (
          includesAddress(Object.keys(members), this.ownAddr)
          && includesAddress(Object.keys(members), sender)
          && includesAddress(admins, sender)
        ) {
          await this.handleGroupChatInvitiation(
            sender,
            chatMessageId,
            inviteData,
            msg.msgId,
            deliveryTS,
            neverContactedInitiator,
          );
          return this.removeMessageFromInbox(msg.msgId);
        }

        return this.handleMaformedInvitation(msg.msgId);
      }

      default:
        return this.handleMaformedInvitation(msg.msgId);
    }
  }

  private async handleOTOChatInvitation(
    sender: string,
    chatMessageId: string,
    inviteParams: OneToOneChatParameters,
    incomingMsgId: string,
    deliveryTS: number,
    neverContactedInitiator: boolean,
  ): Promise<void> {
    // create chat db record
    const chat = await this.data.addOneToOneChat({
      peerAddr: sender,
      name: inviteParams.name,
      settings: {
        autoDeleteMessages: '0',
      },
      status: 'invited',
    });
    this.emit.chat.added(chat);

    // record locally invitation message
    const msg = makeMsgDbEntry('invitation', chatMessageId, {
      isIncomingMsg: true,
      incomingMsgId,
      otoPeerCAddr: chat.peerCAddr,
      body: serializeInvitation({
        ...inviteParams,
        neverContactedInitiator,
      }),
      status: 'unread',
      timestamp: deliveryTS,
    });

    await this.data.addMessage(msg);
    this.emit.message.added(msg);
  }

  private async handleGroupChatInvitiation(
    sender: string,
    chatMessageId: string,
    inviteParams: GroupChatParameters,
    incomingMsgId: string,
    deliveryTS: number,
    neverContactedInitiator: boolean,
  ): Promise<void> {
    // create chat db record
    const chat = await this.data.addGroupChat({
      chatId: inviteParams.groupChatId,
      name: inviteParams.name,
      members: inviteParams.members,
      admins: inviteParams.admins,
      settings: {
        autoDeleteMessages: '0',
      },
      status: 'invited',
    });

    this.emit.chat.added(chat);

    // record locally invitation message
    const msg = makeMsgDbEntry('invitation', chatMessageId, {
      isIncomingMsg: true,
      incomingMsgId,
      groupSender: sender,
      groupChatId: inviteParams.groupChatId,
      body: serializeInvitation({
        ...inviteParams,
        neverContactedInitiator,
      }),
      status: 'unread',
      timestamp: deliveryTS,
    });

    await this.data.addMessage(msg);
    this.emit.message.added(msg);
  }

  private async handleMaformedInvitation(msgId: string): Promise<void> {
    return await this.removeMessageFromInbox(
      msgId, `Incoming chat invitation message ${msgId} is malformed. Removing it from inbox.`,
    );
  }

  async handleInvitationAcceptance(
    sender: string,
    acceptedInvitation: AcceptedInvitationReference,
    message: ChatIncomingMessage,
  ): Promise<void> {
    const { groupChat, oneToOneChat, chatMessageId } = acceptedInvitation;
    const chatId = inviteChatId(sender, acceptedInvitation);

    if (!chatId) {
      return await this.removeMessageFromInbox(
        message.msgId,
        `Incoming chat invitation acceptance message ${message.msgId} is malformed. Removing it from inbox.`,
      );
    }

    const chat = this.data.findChat(chatId);
    if (!chat) {
      await this.removeMessageFromInbox(
        message.msgId,
        `Incoming chat invitation acceptance message ${message.msgId} is for unknown chat. Removing it from inbox.`,
      );
    } else if (oneToOneChat) {
      await this.handleOTOChatInvitationAcceptance(
        chat as OTOChatDbEntry,
        chatMessageId,
        oneToOneChat,
        message.msgId,
      );
    } else if (groupChat) {
      await this.handleGroupChatInvitationAcceptance(
        chat as GroupChatDbEntry,
        chatMessageId,
        acceptedInvitation!,
        message,
      );
    }

    const { chatMessageId: newChatMsgId, timestamp } = generateChatMessageId();
    const msg: MsgDbEntry = {
      groupChatId: groupChat ? chatId.chatId : null,
      otoPeerCAddr: oneToOneChat ? chatId.chatId : null,
      chatMessageId: newChatMsgId,
      isIncomingMsg: false,
      incomingMsgId: null,
      groupSender: groupChat ? sender : null,
      body: JSON.stringify({
        event: 'accept:invitation',
        value: { sender },
      }),
      attachments: null,
      chatMessageType: 'system',
      relatedMessage: null,
      status: null,
      timestamp,
      history: null,
      reactions: null,
      settings: null,
      removeAfter: 0,
    };

    await this.data.addMessage(msg);
    this.emit.message.added(msg);
  }

  private async handleOTOChatInvitationAcceptance(
    chat: OTOChatDbEntry,
    chatMessageId: string,
    chatParams: OneToOneChatParameters,
    msgId: string,
  ): Promise<void> {
    const chatId = chatIdOfOTOChat(chat);
    const id: ChatMessageId = { chatId, chatMessageId };

    // update chat db record
    if (chat.status !== 'on') {
      const updatedChat = await this.data.updateOTOChatRecord(chat.peerCAddr, {
        name: chatParams.name,
        status: 'on',
      });

      updatedChat && this.emit.chat.updated(updatedChat);
    }

    // update messages db record
    const msg = await this.data.getMessage(id);
    if (msg && (msg.status !== 'read')) {
      // XXX add in history of this message an update of name with acceptance?
      const updatedMsg = await this.data.updateMessageRecord(id, {
        status: 'read',
      });

      updatedMsg && this.emit.message.updated(updatedMsg);
    }

    await this.removeMessageFromInbox(msgId);
  }

  private async handleGroupChatInvitationAcceptance(
    chat: GroupChatDbEntry,
    chatMessageId: string,
    acceptedInvitation: AcceptedInvitationReference,
    incomingMessage: ChatIncomingMessage,
  ): Promise<void> {
    const chatId = chatIdOfGroupChat(chat);
    const id: ChatMessageId = { chatId, chatMessageId };

    // update chat db record
    // XXX this should be changed to checking who of members replied, recording
    //     history, etc., and changes to chat should reflect this.
    const msg = await this.data.getMessage(id);

    if (msg && (msg.status !== 'read')) {
      const updatedMsg = await this.data.updateMessageRecord(id, {
        status: 'read',
      });

      updatedMsg && this.emit.message.updated(updatedMsg);
    }

    // update chat db record
    // XXX this should be changed to be in accordance with changes' history
    const chatInitiator = ((incomingMessage.jsonBody as ChatInvitationMsgV1)
      .inviteData as AcceptedInvitationReference)?.initiator;
    const me = await w3n.mail!.getUserId();

    const updatedChatMembers = { ...chat.members };
    msg && (updatedChatMembers[incomingMessage.sender] = { hasAccepted: true });

    const areAllMembersAccepted = !Object.values(updatedChatMembers).some(data => !data.hasAccepted);

    let status: GroupChatStatus | undefined;
    if (
      areAllMembersAccepted
      || (!areAllMembersAccepted && chatInitiator !== me && updatedChatMembers[me].hasAccepted)
    ) {
      status = 'on';
    } else {
      status = chatInitiator === me ? 'partially-on' : chat.status;
    }

    const updatedChat = await this.data.updateGroupChatRecord(chat.chatId, {
      members: updatedChatMembers,
      status,
    });

    updatedChat && this.emit.chat.updated(updatedChat);

    await this.removeMessageFromInbox(incomingMessage.msgId);
  }

  async acceptChatInvitation(chatId: ChatIdObj, chatMessageId: string, ownName: string): Promise<void> {
    // check
    const chat = this.data.findChat(chatId);
    const id: ChatMessageId = { chatId, chatMessageId };
    const msg = await this.data.getMessage(id);

    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    } else if (!msg) {
      throw makeDbRecordException({ invitationNotFound: true });
    } else if (chat.status !== 'invited') {
      return;
    }

    let updatedChat: OTOChatDbEntry | GroupChatDbEntry | undefined;
    if (chatId.isGroupChat) {
      const me = await w3n.mail?.getUserId();
      const chatMembers = { ...(chat as GroupChatDbEntry).members };
      chatMembers[me!] = { hasAccepted: true };

      updatedChat = await this.data.updateGroupChatRecord(chatId.chatId, { members: chatMembers, status: 'on' });
    } else {
      updatedChat = await this.data.updateOTOChatRecord(chatId.chatId, { status: 'on' });
    }

    this.emit.chat.updated(updatedChat);

    if (msg.status !== 'read') {
      const updatedMsg = await this.data.updateMessageRecord(id, {
        status: 'read',
      });

      this.emit.message.updated(updatedMsg);
    }

    // notify peers
    const recipients = recipientsInChat(chat, this.ownAddr);
    const inviteData: AcceptedInvitationReference = {
      type: 'invite-acceptance',
      chatMessageId,
      initiator: msg.groupSender!,
    };

    if (chat.isGroupChat) {
      const groupChatInvite = deserializeInvitation(msg.body!) as GroupChatParameters & {
        neverContactedInitiator?: boolean;
      };
      delete groupChatInvite['neverContactedInitiator'];
      inviteData.groupChat = groupChatInvite;
    } else {
      inviteData.oneToOneChat = {
        type: 'oto-chat-invite',
        name: ownName,
      };
    }

    await sendChatInvitation(
      chatId,
      recipients,
      { chatMessageId, inviteData },
    );
  }
}

export function inviteChatId(sender: string, inviteData: InvitationProcessMsgData): ChatIdObj | undefined {
  if (inviteData.type === 'group-chat-invite') {
    return chatIdFromGroupChatInvite(inviteData);
  }

  if (inviteData.type === 'oto-chat-invite') {
    return {
      isGroupChat: false,
      chatId: toCanonicalAddress(sender),
    };
  }

  const { groupChat, oneToOneChat } = inviteData;
  if (oneToOneChat) {
    return {
      isGroupChat: false,
      chatId: toCanonicalAddress(sender),
    };
  } else if (groupChat) {
    return chatIdFromGroupChatInvite(groupChat);
  }
}

function chatIdFromGroupChatInvite({ groupChatId }: GroupChatParameters): ChatIdObj | undefined {
  return !groupChatId.includes('@')
    ? { isGroupChat: true, chatId: groupChatId }
    : undefined;
}

function serializeInvitation(inviteParams: StoredInvitationParams): string {
  return JSON.stringify(inviteParams);
}

function deserializeInvitation(msgBody: string): StoredInvitationParams {
  return JSON.parse(msgBody);
}
