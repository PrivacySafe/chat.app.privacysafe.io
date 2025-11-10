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

import type { ChatsData } from '../../dataset';
import type { GroupChatStatus, GroupChatView, SingleChatView } from '../../../types/chat.types.ts';
import type {
  ChatIdObj,
  ChatMessageId,
  AcceptedInvitationReference,
  ChatIncomingMessage,
  ChatInvitationMsgV1,
  GroupChatParameters,
  OneToOneChatParameters, UpdatedMembersInvitationData,
} from '../../../types/asmail-msgs.types.ts';
import type { ChatService } from '../index.ts';
import {
  chatIdOfGroupChat,
  chatIdOfOTOChat,
  excludeAddrFrom,
  makeMsgDbEntry,
} from '../common-transforms.ts';
import { sendChatInvitation } from '../../utils/send-chat-msg.ts';
import { makeDbRecordException } from '../../utils/exceptions.ts';
import { generateChatMessageId } from '../../../shared-libs/chat-ids.ts';
import { includesAddress } from '../../../shared-libs/address-utils.ts';
import { GroupChatDbEntry, OTOChatDbEntry } from '../../dataset/versions/v2/chats-db.ts';
import type { MsgDbEntry } from '../../dataset/versions/v2/msgs-db.ts';
import { LOGO_ICON_AS_ARRAY } from '../../../src-main/common/constants/files.ts';
import { AppSettings } from '../../utils/app-settings.ts';
import type { OpenChatCmdArg } from '~/chat-commands.types.ts';
import { inviteChatId, serializeInvitation } from './utils.ts';

export class ChatCreation {
  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly i18n: AppSettings,
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
        autoDeleteMessages: '1',
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
        autoDeleteMessages: '1',
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

  private async showSystemNotification(
    { sender, chatId }: { sender: string; chatId: ChatIdObj },
  ) {
    const icon = Uint8Array.from(LOGO_ICON_AS_ARRAY);
    const notificationTitle = await this.i18n.$tr('app.notification.invite', { sender });
    await w3n.shell?.userNotifications?.addNotification({
      icon,
      title: notificationTitle,
      cmd: {
        cmd: 'open-chat-with',
        params: [{
          chatId,
          peerAddress: sender,
        } as OpenChatCmdArg],
      },
    });
  }

  private async createDisplayableSystemMessage(
    { chatId, sender }: { chatId: ChatIdObj; sender: string },
  ) {
    const { chatMessageId: newChatMsgId, timestamp } = generateChatMessageId();
    const msg: MsgDbEntry = {
      groupChatId: chatId.isGroupChat ? chatId.chatId : null,
      otoPeerCAddr: chatId.isGroupChat ? null : chatId.chatId,
      chatMessageId: newChatMsgId,
      isIncomingMsg: false,
      incomingMsgId: null,
      groupSender: chatId.isGroupChat ? sender : null,
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

  /* Creating a new chat based on an invitation message (entry point) */
  async handleChatInvitation(msg: ChatIncomingMessage): Promise<void> {
    const { sender, jsonBody, deliveryTS, establishedSenderKeyChain } = msg;
    const neverContactedInitiator = !establishedSenderKeyChain;
    const { chatMessageId, inviteData } = jsonBody as ChatInvitationMsgV1;

    if (inviteData.type === 'invite-acceptance') {
      return await this.handleInvitationAcceptance(sender, inviteData, msg);
    }

    if (inviteData.type === 'updated-members-invitation-data') {
      return await this.handleUpdateMembersInvitationData(sender, inviteData.chatId, inviteData.members, msg)
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
          includesAddress(Object.keys(members!), this.ownAddr)
          && includesAddress(Object.keys(members!), sender)
          && includesAddress(admins!, sender)
        ) {
          await this.handleGroupChatInvitation(
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

  /* Creating a new one-to-one chat based on an invitation message */
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
        autoDeleteMessages: '1',
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
      removeAfter: 0,
      settings: null,
    });

    await this.data.addMessage(msg);
    this.emit.message.added(msg);
    await this.showSystemNotification({ sender, chatId: { isGroupChat: false, chatId: chat.peerCAddr } });
  }

  /* Creating a new group chat based on an invitation message */
  private async handleGroupChatInvitation(
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
      members: inviteParams.members!,
      admins: inviteParams.admins!,
      settings: {
        autoDeleteMessages: '1',
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
      removeAfter: 0,
      settings: null,
    });

    await this.data.addMessage(msg);
    this.emit.message.added(msg);
    await this.showSystemNotification({ sender, chatId: { isGroupChat: true, chatId: chat.chatId } });
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
      return;
    }

    if (oneToOneChat) {
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

    await this.createDisplayableSystemMessage({ chatId, sender });
  }

  async handleUpdateMembersInvitationData(
    sender: string,
    chatId: ChatIdObj,
    acceptedMembers: string[],
    incomingMessage: ChatIncomingMessage,
  ): Promise<void> {
    const chat = this.data.findChat(chatId);
    if (!chat) {
      await this.removeMessageFromInbox(
        incomingMessage.msgId,
        `Incoming chat invitation acceptance message ${incomingMessage.msgId} is for unknown chat. Removing it from inbox.`,
      );
    }

    const { members, admins } = chat as GroupChatDbEntry;
    if (!admins.includes(sender)) {
      return;
    }

    const newAcceptedMembers = Object.keys(members).reduce((res, addr) => {
      const { hasAccepted } = members[addr];
      if (!hasAccepted && acceptedMembers.includes(addr)) {
        res.push(addr);
      }
      return res;
    }, [] as string[]);

    if (newAcceptedMembers.length === 0) {
      return;
    }

    const updatedChatMembers = { ...members };

    for (const acceptedMember of newAcceptedMembers) {
      if (acceptedMember !== this.ownAddr) {
        await this.createDisplayableSystemMessage({ chatId, sender: acceptedMember });
      }

      updatedChatMembers[acceptedMember] = { hasAccepted: true };
    }

    const updatedChat = await this.data.updateGroupChatRecord(chatId.chatId, {
      members: updatedChatMembers,
      ...(acceptedMembers.includes(this.ownAddr) && { status: 'on' }),
    });

    updatedChat && this.emit.chat.updated(updatedChat);

    await this.removeMessageFromInbox(incomingMessage.msgId);
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

    const msg = await this.data.getMessage(id);

    if (msg && (msg.status !== 'read')) {
      const updatedMsg = await this.data.updateMessageRecord(id, {
        status: 'read',
      });

      updatedMsg && this.emit.message.updated(updatedMsg);
    }

    const chatInitiator = ((incomingMessage.jsonBody as ChatInvitationMsgV1)
      .inviteData as AcceptedInvitationReference)?.initiator;

    const updatedChatMembers = { ...chat.members };
    msg && (updatedChatMembers[incomingMessage.sender] = { hasAccepted: true });

    const areAllMembersAccepted = !Object.values(updatedChatMembers).some(data => !data.hasAccepted);

    let status: GroupChatStatus | undefined;
    if (
      areAllMembersAccepted
      || (!areAllMembersAccepted && chatInitiator !== this.ownAddr && updatedChatMembers[this.ownAddr].hasAccepted)
    ) {
      status = 'on';
    } else {
      status = chatInitiator === this.ownAddr ? 'partially-on' : chat.status;
    }

    const updatedChat = await this.data.updateGroupChatRecord(chat.chatId, {
      members: updatedChatMembers,
      status,
    });

    updatedChat && this.emit.chat.updated(updatedChat);

    await this.removeMessageFromInbox(incomingMessage.msgId);

    const updateMembersData: UpdatedMembersInvitationData = {
      type: 'updated-members-invitation-data',
      chatId,
      members: Object.keys(updatedChatMembers).reduce((res, addr) => {
        const { hasAccepted } = updatedChatMembers[addr];
        if (hasAccepted) {
          res.push(addr);
        }

        return res;
      }, [] as string[]),
    };

    await sendChatInvitation(
      chatId,
      Object.keys(updatedChatMembers).reduce((res, addr) => {
        if (addr !== this.ownAddr) {
          res.push(addr);
        }
        return res;
      }, [] as string[]),
      { chatMessageId, inviteData: updateMembersData },
    );
  }

  async acceptChatInvitation(chatId: ChatIdObj, chatMessageId: string, ownName: string): Promise<void> {
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

    if (msg.status !== 'read') {
      const updatedMsg = await this.data.updateMessageRecord(id, {
        status: 'read',
      });

      this.emit.message.updated(updatedMsg);
    }

    if (chatId.isGroupChat) {
      const updatedChat = await this.data.updateGroupChatRecord(chatId.chatId, { status: 'accepted' });
      this.emit.chat.updated(updatedChat);

      const inviteData: AcceptedInvitationReference = {
        type: 'invite-acceptance',
        chatMessageId,
        initiator: msg.groupSender!,
        groupChat: {
          type: 'group-chat-invite',
          groupChatId: (chat as GroupChatDbEntry).chatId,
          addr: this.ownAddr,
          name: ownName,
        },
      };
      await sendChatInvitation(
        chatId,
        [msg.groupSender!],
        { chatMessageId, inviteData },
      );

      return;
    }

    const updatedChat = await this.data.updateOTOChatRecord(chatId.chatId, { status: 'on' });
    this.emit.chat.updated(updatedChat);

    const inviteData: AcceptedInvitationReference = {
      type: 'invite-acceptance',
      chatMessageId,
      initiator: msg.groupSender!,
      oneToOneChat: {
        type: 'oto-chat-invite',
        name: ownName,
      },
    };
    await sendChatInvitation(
      chatId,
      [(chat as OTOChatDbEntry).peerAddr],
      { chatMessageId, inviteData },
    );
  }
}
