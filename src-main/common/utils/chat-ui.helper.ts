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
import get from 'lodash/get';
import { useContactsStore } from '@main/common/store/contacts.store.ts';
import { useAppStore } from '@main/common/store/app.store.ts';
import {
  ChatListItemView,
  ChatSysMsgView,
  ChatInvitationMsgView,
  OneToOneChatParameters,
  SingleChatStatus,
  GroupChatStatus, CallMsgBodySysMsgData,
} from '~/index.ts';

export function getChatName(chat: ChatListItemView): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { name, isGroupChat, chatId } = chat;
  const { getContactName } = useContactsStore();

  return isGroupChat
    ? name || 'Untitled'
    : name ? name : getContactName(chat.peerAddr);
}

export function getTextForChatSystemMessage(message: ChatSysMsgView, ownAddr?: string): string {
  const { sender, systemData, isIncomingMsg } = message;

  const { getContactName } = useContactsStore();
  const appStore = useAppStore();
  const { event } = systemData;

  switch (event) {
    case 'accept:invitation': {
      const acceptedSender = get(systemData, ['value', 'sender'], '');
      return appStore.$i18n.tr('chat.invitation.accepted', { name: acceptedSender || sender });
    }

    case 'update:chatName': {
      const text = appStore.$i18n.tr('rename.chat.system.message');
      const msgSender = isIncomingMsg ? sender : appStore.user!;
      return `${text} ${getContactName(msgSender)}`;
    }

    case 'member-left': {
      const memberWhoLeft = get(systemData, ['value', 'sender'], '');
      return appStore.$i18n.tr('member_left.chat.system.message', { member: memberWhoLeft || sender });
    }

    case 'member-removed': {
      const { chatDeleted } = systemData;
      return chatDeleted
        ? appStore.$i18n.tr('chat_deleted.chat.system.message', { admin: sender })
        : appStore.$i18n.tr('you_are_removed.chat.system.message', { admin: sender });
    }

    case 'update:members': {
      const { value: { membersAfterUpdate, membersToAdd, membersToDelete } } = systemData;

      if (Object.keys(membersToDelete).length > 0 && Object.keys(membersToDelete).includes(ownAddr!)) {
        return appStore.$i18n.tr('remove.me.system.message', { admin: sender || '' });
      }

      if (Object.keys(membersToDelete).length > 0 && Object.keys(membersToAdd).length > 0) {
        return appStore.$i18n.tr('add_and_remove.members.system.message', {
          admin: sender || ownAddr || '',
          membersToAdd: Object.keys(membersToAdd).join(', '),
          membersToDelete: Object.keys(membersToDelete).join(', '),
          participantsNum: `${Object.keys(membersAfterUpdate).length}`,
        });
      }

      if (Object.keys(membersToDelete).length > 0 && Object.keys(membersToAdd).length === 0) {
        return appStore.$i18n.tr('remove.members.system.message', {
          admin: sender || ownAddr || '',
          membersToDelete: Object.keys(membersToDelete).join(', '),
          participantsNum: `${Object.keys(membersAfterUpdate).length}`,
        });
      }

      if (Object.keys(membersToDelete).length === 0 && Object.keys(membersToAdd).length > 0) {
        return appStore.$i18n.tr('add.members.system.message', {
          admin: sender || ownAddr || '',
          membersToAdd: Object.keys(membersToAdd).join(', '),
          participantsNum: `${Object.keys(membersAfterUpdate).length}`,
        });
      }

      return '';
    }

    case 'update:admins': {
      const { value: { adminsToAdd = [], adminsToDelete = [] } } = systemData;

      if (adminsToDelete.length > 0 && adminsToAdd.length >0) {
        return appStore.$i18n.tr('add_and_remove.admins.system.message', {
          admin: sender || ownAddr || '',
          adminsToDelete: adminsToDelete.join(', '),
          adminsToAdd: adminsToAdd.join(', '),
        });
      }

      if (adminsToDelete.length > 0 && adminsToAdd.length === 0) {
        return appStore.$i18n.tr('remove.admins.system.message', {
          admin: sender || ownAddr || '',
          adminsToDelete: adminsToDelete.join(', '),
        });
      }

      if (adminsToDelete.length === 0 && adminsToAdd.length > 0) {
        return appStore.$i18n.tr('add.admins.system.message', {
          admin: sender || ownAddr || '',
          adminsToAdd: adminsToAdd.join(', '),
        });
      }

      return '';
    }

    case 'call': {
      const { sender, direction  } = systemData.value as CallMsgBodySysMsgData['value'];
      return direction === 'incoming'
        ? appStore.$i18n.tr('va.incoming.call', { sender })
        : appStore.$i18n.tr('va.outgoing.call');
    }

    default:
      return '';
  }
}

export function getTextForChatInvitationMessage(
  message: ChatInvitationMsgView,
  chatStatus?: SingleChatStatus | GroupChatStatus,
): string {
  const appStore = useAppStore();
  const {
    sender,
    inviteData,
    isIncomingMsg,
    groupSender,
  } = message as ChatInvitationMsgView & { groupSender?: string };

  switch (inviteData.type) {
    case 'oto-chat-invite': {
      if (isIncomingMsg) {
        const { neverContactedInitiator } = inviteData;
        return neverContactedInitiator
          ? chatStatus === 'invited'
            ? appStore.$i18n.tr('chat.oto.invitation.incoming-from-unknown', { sender })
            : appStore.$i18n.tr('chat.oto.accepted.invitation.incoming-from-unknown', { sender })
          : chatStatus === 'invited'
            ? appStore.$i18n.tr('chat.oto.invitation.incoming', { sender })
            : appStore.$i18n.tr('chat.oto.accepted.invitation.incoming', { sender });
      }

      return appStore.$i18n.tr('chat.oto.invitation.sent');
    }

    case 'group-chat-invite': {
      const appStore = useAppStore();
      const members = Object.keys(inviteData.members).filter(m => m !== appStore.user).join(', ');
      if (isIncomingMsg) {
        const { neverContactedInitiator } = inviteData;
        return neverContactedInitiator
          ? chatStatus === 'invited'
            ? appStore.$i18n.tr('chat.group.invitation.incoming-from-unknown', { sender: sender || groupSender || '' })
            : appStore.$i18n.tr('chat.group.accepted.invitation.incoming-from-unknown', { sender: sender || groupSender || '' })
          : chatStatus === 'invited'
            ? appStore.$i18n.tr('chat.group.invitation.incoming', { sender: sender || groupSender || '' })
            : appStore.$i18n.tr('chat.group.accepted.invitation.incoming', { sender: sender || groupSender || '' });
      }

      return appStore.$i18n.tr('chat.group.invitation.sent', { members });
    }

    default: {
      const { groupChat, oneToOneChat } = inviteData;
      const { name } = oneToOneChat || {} as OneToOneChatParameters;
      if (isIncomingMsg) {
        if (oneToOneChat) {
          return appStore.$i18n.tr('chat.invitation.accepted', { name });
        }

        if (groupChat) {
          return appStore.$i18n.tr('chat.invitation.accepted', { name: sender });
        }

        throw new Error(`This message should've been rejected`);
      }

      return appStore.$i18n.tr('chat.invitation.sent');
    }
  }
}
