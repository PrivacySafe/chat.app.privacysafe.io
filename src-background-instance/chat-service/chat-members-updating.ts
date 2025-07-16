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

import { ChatsData } from '../dataset/index.ts';
import { ChatIdObj, ChatMessageId, GroupChatParameters } from "../../types/asmail-msgs.types.ts";
import type { ChatService } from './index.ts';
import { chatIdOfChat, chatIdOfOTOChat, chatViewForGroupChat, chatViewForOTOChat, makeMsgDbEntry, msgDbEntryForIncomingSysMsg } from './common-transforms.ts';
import { ChatDbEntry, GroupChatDbEntry, OTOChatDbEntry } from '../dataset/versions/v1/chats-db.ts';
import { areAddressesEqual, includesAddress } from '../../shared-libs/address-utils.ts';
import { UpdateMembersSysMsgData, UpdatedChatNameSysMsgData } from '../../types/asmail-msgs.types.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';
import { sendChatInvitation, sendSysMsgsAboutRemovalFromChat, sendSystemMessage } from '../utils/send-chat-msg.ts';
import { generateChatMessageId } from '../../shared-libs/chat-ids.ts';

export class ChatMembersUpdating {

  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly ownAddr: string
  ) {}

  async updateGroupMembers(
    chatId: ChatIdObj, changes: UpdateMembersSysMsgData['value']
  ): Promise<void> {
    // some checks
    const chat = this.getChatAndCheck(chatId, changes);

    const { membersAfterUpdate, membersToAdd, membersToDelete } = changes;
    const { chatMessageId, timestamp } = generateChatMessageId();
    const unchangedPeers = excludeAddrFrom(
      chat.members, this.ownAddr, ...membersToDelete
    );

    // update local record
    const updatedChat = await this.updateChatMembersAndAdminsIfNeeded(
      chat, changes
    );
    const updateData: UpdateMembersSysMsgData = {
      event: 'update:members',
      value: changes
    };
    const msg = makeMsgDbEntry('system', chatMessageId, {
      groupChatId: chat.chatId,
      body: JSON.stringify(updateData),
      timestamp
    });
    await this.data.addMessage(msg);
    this.emit.chat.updated(updatedChat);

    // send messages to peers that are not changed
    if (unchangedPeers.length > 1) {
      await sendSystemMessage({
        chatId, chatMessageId,
        recipients: unchangedPeers,
        chatSystemData: updateData
      });
    }

    // send removal messages
    if (membersToDelete.length > 0) {
      await sendSysMsgsAboutRemovalFromChat(chatId, membersToDelete);
    }

    // send invitations to new members
    if (membersToAdd.length > 0) {
      await this.sendInvitesToNewMembers(
        chatId, updatedChat, membersToAdd, chatMessageId
      );
    }

  }

  private getChatAndCheck(
    chatId: ChatIdObj, changes: UpdateMembersSysMsgData['value']
  ): GroupChatDbEntry {
    const { membersAfterUpdate, membersToAdd, membersToDelete } = changes;
    if (includesAddress(membersToDelete, this.ownAddr)) {
      throw `Update of group membership is not supposed to remove self`;
    }
    const chat = this.data.findChat(chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    } else if (!chat.isGroupChat) {
      throw makeDbRecordException({ notGroupChat: true });
    } else if (!includesAddress(chat.admins, this.ownAddr)) {
      throw makeDbRecordException({ notAdmin: true });
    }
    for (const address of membersToAdd) {
      if (includesAddress(chat.members, address)) {
        throw makeDbRecordException({ address, alreadyChatMember: true });
      }
    }
    for (const address of membersToDelete) {
      if (!includesAddress(chat.members, address)) {
        throw makeDbRecordException({ address, notChatMember: true });
      }
    }
    const expUpdatedMembers = excludeAddrFrom(chat.members, ...membersToDelete)
    .concat(...membersToAdd);
    if (expUpdatedMembers.length !== membersAfterUpdate.length) {
      throw `membersAfterUpdate has invalid content`;
    }
    return chat;
  }

  private async updateChatMembersAndAdminsIfNeeded(
    chat: GroupChatDbEntry,
    { membersAfterUpdate, membersToDelete }: UpdateMembersSysMsgData['value']
  ): Promise<GroupChatDbEntry> {
    let updatedChat: GroupChatDbEntry|undefined;
    if (membersToDelete.find(m => includesAddress(chat.admins, m))) {
      const newAdmins = excludeAddrFrom(chat.admins, ...membersToDelete);
      updatedChat = await this.data.updateGroupChatRecord(chat.chatId, {
        members: membersAfterUpdate, admins: newAdmins
      });
    } else {
      updatedChat = await this.data.updateGroupChatRecord(chat.chatId, {
        members: membersAfterUpdate
      });
    }
    if (updatedChat) {
      return updatedChat;
    } else {
      throw makeDbRecordException({ chatNotFound: true });
    }
  }

  private async sendInvitesToNewMembers(
    chatId: ChatIdObj,  chat: GroupChatDbEntry, newMembers: string[], chatMessageId: string
  ): Promise<void> {
    const inviteData: GroupChatParameters = {
      type: 'group-chat-invite',
      name: chat.name,
      groupChatId: chat.chatId,
      admins: chat.admins,
      members: chat.members
    };
    await sendChatInvitation(chatId, newMembers, {
      chatMessageId, inviteData
    });
  }

  async handleUpdateChatMembers(
    sender: string, chat: ChatDbEntry, chatMessageId: string, timestamp: number,
    value: UpdateMembersSysMsgData['value']
  ): Promise<void> {
    if (!chat.isGroupChat || !includesAddress(chat.admins, sender)) {
      return;
    }

    const updatedChat = await this.updateChatMembersAndAdminsIfNeeded(
      chat, value
    );
    const msg = msgDbEntryForIncomingSysMsg(
      sender, chatIdOfChat(chat), chatMessageId, timestamp,
      { event: 'update:members', value }
    );
    await this.data.addMessage(msg);
    this.emit.chat.updated(updatedChat);
  }

}

function excludeAddrFrom(addrLst: string[], ...exclAddrs: string[]): string[] {
  return addrLst.filter(a => !includesAddress(exclAddrs, a));
}
