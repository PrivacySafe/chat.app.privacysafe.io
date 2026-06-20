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
  GroupChatParameters,
  UpdateAdminsSysMsgData,
  UpdateMembersSysMsgData,
} from '../../../../types/asmail-msgs.types.ts';
import type { ChatDbEntry, ChatSrvEmit, DB, GroupChatDbEntry } from '../../../types/index.ts';
import { includesAddress } from '../../../../shared-libs/address-utils.ts';
import { generateChatMessageId } from '../../../../shared-libs/chat-ids.ts';
import { makeDbRecordException } from '../../../utils/exceptions.ts';
import { sendChatInvitation, sendSystemMessage } from '../../../utils/send-chat-msg.ts';
import { chatIdOfChat, excludeAddrsFrom } from './_chats-related-methods.ts';
import { makeMsgDbEntry, msgDbEntryForIncomingSysMsg } from './_msgs-related-methods.ts';

export async function chatMembersUpdating({
  data,
  emit,
  ownAddr,
}: {
  data: DB;
  emit: ChatSrvEmit;
  ownAddr: string;
}) {
  function getChatAndCheck(
    chatId: ChatIdObj,
    changes: UpdateMembersSysMsgData['value'] | UpdateAdminsSysMsgData['value'],
  ): GroupChatDbEntry {
    const areMembersUpdateProcess = 'membersAfterUpdate' in changes;

    const { membersAfterUpdate, membersToAdd, membersToDelete } = changes as UpdateMembersSysMsgData['value'];
    const { adminsAfterUpdate, adminsToAdd, adminsToDelete } = changes as UpdateAdminsSysMsgData['value'];

    if (areMembersUpdateProcess && includesAddress(Object.keys(membersToDelete), ownAddr)) {
      throw `Update of group membership is not supposed to remove self`;
    }

    const chat = data.findChat(chatId);

    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    } else if (!chat.isGroupChat) {
      throw makeDbRecordException({ notGroupChat: true });
    } else if (!includesAddress(chat.admins, ownAddr)) {
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

      const expUpdatedMembers = excludeAddrsFrom(
        Object.keys(chat.members),
        ...Object.keys(membersToDelete),
      ).concat(...Object.keys(membersToAdd));

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

      const expUpdatedAdmins = excludeAddrsFrom(chat.admins, ...adminsToDelete).concat(adminsToAdd);
      if (expUpdatedAdmins.length !== adminsAfterUpdate.length) {
        throw `adminsAfterUpdate has invalid content`;
      }
    }

    return chat;
  }

  async function updateChatMembersAndAdminsIfNeeded(
    chat: GroupChatDbEntry,
    { membersAfterUpdate, membersToDelete }: UpdateMembersSysMsgData['value'],
  ): Promise<GroupChatDbEntry> {
    let updatedChat: GroupChatDbEntry | undefined;
    if (Object.keys(membersToDelete).find(m => includesAddress(chat.admins, m))) {
      const newAdmins = excludeAddrsFrom(chat.admins, ...Object.keys(membersToDelete));
      updatedChat = await data.updateGroupChatRecord(chat.chatId, {
        members: membersAfterUpdate,
        admins: newAdmins,
      });
    } else {
      updatedChat = await data.updateGroupChatRecord(chat.chatId, { members: membersAfterUpdate });
    }

    if (updatedChat) {
      return updatedChat;
    } else {
      throw makeDbRecordException({ chatNotFound: true });
    }
  }

  async function sendInvitesToNewMembers(
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
    await sendChatInvitation(chatId, newMembers, { chatMessageId, inviteData });
  }

  async function updateGroupMembers(chatId: ChatIdObj, changes: UpdateMembersSysMsgData['value']): Promise<void> {
    // some checks
    const chat = getChatAndCheck(chatId, changes);

    const { membersToAdd, membersToDelete } = changes;
    const { chatMessageId, timestamp } = generateChatMessageId();
    const unchangedPeers = excludeAddrsFrom(Object.keys(chat.members), ownAddr, ...Object.keys(membersToDelete));

    // update local record
    const updatedChat = await updateChatMembersAndAdminsIfNeeded(chat, changes);
    const updateData: UpdateMembersSysMsgData = {
      event: 'update:members',
      value: changes,
    };
    const msg = makeMsgDbEntry('system', chatMessageId, {
      groupChatId: chat.chatId,
      body: JSON.stringify(updateData),
      timestamp,
    });
    await data.addMessage(msg);
    emit.chat.updated(updatedChat);
    emit.message.added(msg);

    // send messages to peers that are not changed
    if (unchangedPeers.length > 1) {
      await sendSystemMessage({
        chatId,
        chatMessageId,
        recipients: unchangedPeers,
        chatSystemData: updateData,
      });
    }

    // send removal messages
    if (Object.keys(membersToDelete).length > 0) {
      await sendSystemMessage({
        chatId,
        chatMessageId,
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
      await sendInvitesToNewMembers(chatId, updatedChat, Object.keys(membersToAdd), chatMessageId);
    }
  }

  async function updateGroupAdmins(chatId: ChatIdObj, changes: UpdateAdminsSysMsgData['value']): Promise<void> {
    const chat = getChatAndCheck(chatId, changes);
    const { adminsAfterUpdate } = changes;
    const { chatMessageId, timestamp } = generateChatMessageId();
    const unchangedPeers = excludeAddrsFrom(Object.keys(chat.members), ownAddr);
    const updatedChat = await data.updateGroupChatRecord(chat.chatId, { admins: adminsAfterUpdate });

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
    await data.addMessage(msg);
    emit.message.added(msg);
    emit.chat.updated(updatedChat);

    if (unchangedPeers.length > 1) {
      await sendSystemMessage({
        chatId,
        chatMessageId,
        recipients: unchangedPeers,
        chatSystemData: updateData,
      });
    }
  }

  async function handleUpdateChatMembers(
    sender: string,
    chat: ChatDbEntry,
    chatMessageId: string,
    timestamp: number,
    value: UpdateMembersSysMsgData['value'],
  ): Promise<void> {
    if (!chat.isGroupChat || !includesAddress(chat.admins, sender)) {
      return;
    }

    const updatedChat = await updateChatMembersAndAdminsIfNeeded(chat, value);
    const msg = msgDbEntryForIncomingSysMsg(sender, chatIdOfChat(chat), chatMessageId, timestamp, {
      event: 'update:members',
      value,
    });

    await data.addMessage(msg);
    emit.message.added(msg);
    emit.chat.updated(updatedChat);
  }

  async function handleUpdateChatAdmins(
    sender: string,
    chat: ChatDbEntry,
    chatMessageId: string,
    timestamp: number,
    value: UpdateAdminsSysMsgData['value'],
  ): Promise<void> {
    if (!chat.isGroupChat || !includesAddress(chat.admins, sender)) {
      return;
    }

    const updatedChat = await data.updateGroupChatRecord(chat.chatId, { admins: value.adminsAfterUpdate });
    const msg = msgDbEntryForIncomingSysMsg(sender, chatIdOfChat(chat), chatMessageId, timestamp, {
      event: 'update:admins',
      value,
    });

    await data.addMessage(msg);
    emit.message.added(msg);
    emit.chat.updated(updatedChat);
  }

  return {
    updateGroupMembers,
    updateGroupAdmins,
    handleUpdateChatMembers,
    handleUpdateChatAdmins,
  };
}
