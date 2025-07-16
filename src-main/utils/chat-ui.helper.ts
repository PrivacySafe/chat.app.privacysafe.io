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

import { useContactsStore } from '@main/store/contacts.store';
import { useAppStore } from '../store/app.store';
import type { ChatListItemView, ChatSysMsgView, ChatInvitationMsgView } from '~/index';

export function getChatName(chat: ChatListItemView): string {
  const { name, isGroupChat, chatId } = chat;
  const { getContactName } = useContactsStore();
  if (isGroupChat) {
    return name || 'Untitled';
  } else {
    return (name ? name : getContactName(chat.peerAddr));
  }
}

export function getTextForChatSystemMessage(
  message: ChatSysMsgView
): string {

  // XXX should we separate system info field, keeping body for content

  const { sender, systemData } = message;

  const { getContactName } = useContactsStore();
  const appStore = useAppStore();
  const { event } = systemData;

  if (event === 'update:chatName') {
    const text = appStore.$i18n.tr('rename.chat.system.message');
    return sender
      ? `${text} ${getContactName(sender)}`
      : text;
  }

  if (event === 'member-left') {
    return appStore.$i18n.tr("member_left.chat.system.message", { member: sender });
  }

  if (event === 'member-removed') {
    const { chatDeleted } = systemData;
    if (chatDeleted) {
      return appStore.$i18n.tr(
        "chat_deleted.chat.system.message", { admin: sender }
      );
    } else {
      return appStore.$i18n.tr(
        "you_are_removed.chat.system.message", { admin: sender }
      );
    }
  }

  if ((event === 'update:members')) {
    const { value: {
      membersAfterUpdate, membersToAdd, membersToDelete
    } } = systemData;
    if (membersToDelete.length > 0) {
      if (membersToAdd.length > 0) {
        return appStore.$i18n.tr(
          "add_and_remove.members.system.message", {
            admin: sender,
            membersToAdd: membersToAdd.join(', '),
            membersToDelete: membersToDelete.join(', '),
            particiantsNum: `${membersAfterUpdate.length}`
          }
        );
      } else {
        return appStore.$i18n.tr(
          "remove.members.system.message", {
            admin: sender,
            membersToDelete: membersToDelete.join(', '),
            particiantsNum: `${membersAfterUpdate.length}`
          }
        );
      }
    } else {
      if (membersToAdd.length > 0) {
        return appStore.$i18n.tr(
          "add.members.system.message", {
            admin: sender,
            membersToAdd: membersToAdd.join(', '),
            particiantsNum: `${membersAfterUpdate.length}`
          }
        );
      }
    }
  }
  event

  return ' ';
}


export function getTextForChatInvitationMessage(
  message: ChatInvitationMsgView
): string {
  const { sender, inviteData, isIncomingMsg } = message;
  const appStore = useAppStore();
  if (inviteData.type === 'oto-chat-invite') {
    if (isIncomingMsg) {
      const { name, neverContactedInitiator } = inviteData;
      if (neverContactedInitiator) {
        return appStore.$i18n.tr(
          'chat.oto.invitation.incoming-from-unknown', { name, sender }
        );
      } else {
        return appStore.$i18n.tr(
          'chat.oto.invitation.incoming', { name, sender }
        );
      }
    }else {
      return appStore.$i18n.tr('chat.oto.invitation.sent');
    }
  } else if (inviteData.type === 'group-chat-invite') {
    const members = inviteData.members.join(', ');
    if (isIncomingMsg) {
      const { name, neverContactedInitiator } = inviteData;
      if (neverContactedInitiator) {
        return appStore.$i18n.tr('chat.group.invitation.incoming-from-unknown', {
          name, sender, members
        });
      } else {
        return appStore.$i18n.tr('chat.group.invitation.incoming', {
          name, sender, members
        });
      }
    }else {
      return appStore.$i18n.tr('chat.group.invitation.sent', { members });
    }
  } else {
    console.log(inviteData);
    const { groupChat, oneToOneChat } = inviteData;
    if (isIncomingMsg) {
      if (oneToOneChat) {
        const { name } = oneToOneChat;
        return appStore.$i18n.tr('chat.invitation.accepted', { name });
      } else if (groupChat) {
        return appStore.$i18n.tr('chat.invitation.accepted', { name: sender });
      } else {
        throw new Error(`This message should've been rejected`);
      }
    } else {
      return appStore.$i18n.tr('chat.invitation.sent');
    }
  }
}
