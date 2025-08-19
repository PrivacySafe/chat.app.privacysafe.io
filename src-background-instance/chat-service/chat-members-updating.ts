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
import type { ChatIdObj, GroupChatParameters, UpdateAdminsSysMsgData } from '../../types/asmail-msgs.types.ts';
import type { ChatService } from './index.ts';
import { chatIdOfChat, makeMsgDbEntry, msgDbEntryForIncomingSysMsg } from './common-transforms.ts';
import type { ChatDbEntry, GroupChatDbEntry } from '../dataset/versions/v2/chats-db.ts';
import { includesAddress } from '../../shared-libs/address-utils.ts';
import { UpdateMembersSysMsgData } from '../../types/asmail-msgs.types.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';
import { sendChatInvitation, sendSystemMessage } from '../utils/send-chat-msg.ts';
import { generateChatMessageId } from '../../shared-libs/chat-ids.ts';

export class ChatMembersUpdating {

  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly ownAddr: string,
  ) {
  }

  async updateGroupMembers(
    chatId: ChatIdObj,
    changes: UpdateMembersSysMsgData['value'],
  ): Promise<void> {
    // some checks
    const chat = this.getChatAndCheck(chatId, changes);

    const { membersToAdd, membersToDelete } = changes;
    const { chatMessageId, timestamp } = generateChatMessageId();
    const unchangedPeers = excludeAddrFrom(
      Object.keys(chat.members),
      this.ownAddr,
      ...Object.keys(membersToDelete),
    );

    // update local record
    const updatedChat = await this.updateChatMembersAndAdminsIfNeeded(chat, changes);
    const updateData: UpdateMembersSysMsgData = {
      event: 'update:members',
      value: changes,
    };
    const msg = makeMsgDbEntry('system', chatMessageId, {
      groupChatId: chat.chatId,
      body: JSON.stringify(updateData),
      timestamp,
    });
    await this.data.addMessage(msg);
    this.emit.chat.updated(updatedChat);
    this.emit.message.added(msg);

    // send messages to peers that are not changed
    if (unchangedPeers.length > 1) {
      await sendSystemMessage({
        chatId, chatMessageId,
        recipients: unchangedPeers,
        chatSystemData: updateData,
      });
    }

    // send removal messages
    if (Object.keys(membersToDelete).length > 0) {
      await sendSystemMessage({
        chatId, chatMessageId,
        recipients: Object.keys(membersToDelete),
        chatSystemData: {
          event: 'update:members',
          value: {
            membersToDelete: changes.membersToDelete,
            membersToAdd: {},
            membersAfterUpdate: changes.membersAfterUpdate,
          },
        },
      });
    }

    // send invitations to new members
    if (Object.keys(membersToAdd).length > 0) {
      await this.sendInvitesToNewMembers(
        chatId,
        updatedChat,
        Object.keys(membersToAdd),
        chatMessageId,
      );
    }
  }

  async updateGroupAdmins(
    chatId: ChatIdObj,
    changes: UpdateAdminsSysMsgData['value'],
  ): Promise<void> {
    const chat = this.getChatAndCheck(chatId, changes);
    const { adminsAfterUpdate } = changes;
    const { chatMessageId, timestamp } = generateChatMessageId();
    const unchangedPeers = excludeAddrFrom(Object.keys(chat.members), this.ownAddr);
    const updatedChat = await this.data.updateGroupChatRecord(
      chat.chatId,
      { admins: adminsAfterUpdate },
    );

    if (!updatedChat) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    const updateData: UpdateAdminsSysMsgData = {
      event: 'update:admins',
      value: changes,
    };
    const msg = makeMsgDbEntry('system', chatMessageId, {
      groupChatId: chat.chatId,
      body: JSON.stringify(updateData),
      timestamp,
    });
    await this.data.addMessage(msg);
    await this.emit.message.added(msg);
    this.emit.chat.updated(updatedChat);

    if (unchangedPeers.length > 1) {
      await sendSystemMessage({
        chatId, chatMessageId,
        recipients: unchangedPeers,
        chatSystemData: updateData,
      });
    }
  }

  private getChatAndCheck(
    chatId: ChatIdObj,
    changes: UpdateMembersSysMsgData['value'] | UpdateAdminsSysMsgData['value'],
  ): GroupChatDbEntry {
    const areMembersUpdateProcess = 'membersAfterUpdate' in changes;

    const { membersAfterUpdate, membersToAdd, membersToDelete } = changes as UpdateMembersSysMsgData['value'];
    const { adminsAfterUpdate, adminsToAdd, adminsToDelete } = changes as UpdateAdminsSysMsgData['value'];

    if (areMembersUpdateProcess && includesAddress(Object.keys(membersToDelete), this.ownAddr)) {
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

    if (areMembersUpdateProcess) {
      for (const address of Object.keys(membersToAdd)) {
        if (includesAddress(Object.keys(chat.members), address)) {
          throw makeDbRecordException({ address, alreadyChatMember: true });
        }
      }

      for (const address of Object.keys(membersToDelete)) {
        if (!includesAddress(Object.keys(chat.members), address)) {
          throw makeDbRecordException({ address, notChatMember: true });
        }
      }

      const expUpdatedMembers = excludeAddrFrom(Object.keys(chat.members), ...Object.keys(membersToDelete))
        .concat(...Object.keys(membersToAdd));

      if (expUpdatedMembers.length !== Object.keys(membersAfterUpdate).length) {
        throw `membersAfterUpdate has invalid content`;
      }
    } else {
      for (const addr of adminsToAdd) {
        if (includesAddress(chat.admins, addr)) {
          throw makeDbRecordException({ address: addr, alreadyChatMember: true });
        }
      }

      for (const addr of adminsToDelete) {
        if (!includesAddress(chat.admins, addr)) {
          throw makeDbRecordException({ address: addr, notChatMember: true });
        }
      }

      const expUpdatedAdmins = excludeAddrFrom(chat.admins, ...adminsToDelete).concat(adminsToAdd);
      if (expUpdatedAdmins.length !== adminsAfterUpdate.length) {
        throw `adminsAfterUpdate has invalid content`;
      }
    }

    return chat;
  }

  private async updateChatMembersAndAdminsIfNeeded(
    chat: GroupChatDbEntry,
    { membersAfterUpdate, membersToDelete }: UpdateMembersSysMsgData['value'],
  ): Promise<GroupChatDbEntry> {
    let updatedChat: GroupChatDbEntry | undefined;
    if (Object.keys(membersToDelete).find(m => includesAddress(chat.admins, m))) {
      const newAdmins = excludeAddrFrom(chat.admins, ...Object.keys(membersToDelete));
      updatedChat = await this.data.updateGroupChatRecord(
        chat.chatId,
        { members: membersAfterUpdate, admins: newAdmins },
      );
    } else {
      updatedChat = await this.data.updateGroupChatRecord(
        chat.chatId,
        { members: membersAfterUpdate },
      );
    }

    if (updatedChat) {
      return updatedChat;
    } else {
      throw makeDbRecordException({ chatNotFound: true });
    }
  }

  private async sendInvitesToNewMembers(
    chatId: ChatIdObj,
    chat: GroupChatDbEntry,
    newMembers: string[],
    chatMessageId: string,
  ): Promise<void> {
    const inviteData: GroupChatParameters = {
      type: 'group-chat-invite',
      name: chat.name,
      groupChatId: chat.chatId,
      admins: chat.admins,
      members: chat.members,
    };
    await sendChatInvitation(
      chatId,
      newMembers,
      { chatMessageId, inviteData },
    );
  }

  async handleUpdateChatMembers(
    sender: string,
    chat: ChatDbEntry,
    chatMessageId: string,
    timestamp: number,
    value: UpdateMembersSysMsgData['value'],
  ): Promise<void> {
    if (!chat.isGroupChat || !includesAddress(chat.admins, sender)) {
      return;
    }

    const updatedChat = await this.updateChatMembersAndAdminsIfNeeded(chat, value);
    const msg = msgDbEntryForIncomingSysMsg(
      sender,
      chatIdOfChat(chat),
      chatMessageId,
      timestamp,
      { event: 'update:members', value },
    );

    await this.data.addMessage(msg);
    await this.emit.message.added(msg);
    this.emit.chat.updated(updatedChat);
  }

  async handleUpdateChatAdmins(
    sender: string,
    chat: ChatDbEntry,
    chatMessageId: string,
    timestamp: number,
    value: UpdateAdminsSysMsgData['value'],
  ): Promise<void> {
    if (!chat.isGroupChat || !includesAddress(chat.admins, sender)) {
      return;
    }

    const updatedChat = await this.data.updateGroupChatRecord(
      chat.chatId,
      { admins: value.adminsAfterUpdate },
    );
    const msg = msgDbEntryForIncomingSysMsg(
      sender,
      chatIdOfChat(chat),
      chatMessageId,
      timestamp,
      { event: 'update:admins', value },
    );

    await this.data.addMessage(msg);
    await this.emit.message.added(msg);
    this.emit.chat.updated(updatedChat);
  }
}

function excludeAddrFrom(addrLst: string[], ...exclAddrs: string[]): string[] {
  return addrLst.filter(a => !includesAddress(exclAddrs, a));
}
