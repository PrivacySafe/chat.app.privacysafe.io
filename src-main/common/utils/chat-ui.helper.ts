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
import { useI18n } from 'vue-i18n';
import get from 'lodash/get';
import { useContactsStore } from '@main/common/store/contacts.store';
import { useAppStore } from '@main/common/store/app.store';
import { AUTO_DELETE_MESSAGES_BY_ID } from '@shared/constants';
import {
  ChatListItemView,
  ChatSysMsgView,
  ChatInvitationMsgView,
  OneToOneChatParameters,
  SingleChatStatus,
  GroupChatStatus,
  CallMsgBodySysMsgData,
  WebRTCMsgBodySysMsgData,
  UpdatedChatSettingsSysMsgData,
} from '~/index';

export function getChatName(chat: ChatListItemView): string {
  const { name, isGroupChat } = chat;
  const { getContactName } = useContactsStore();

  return isGroupChat ? name || 'Untitled' : name ? name : getContactName(chat.peerAddr);
}

export function getTextForChatSystemMessage(
  message: ChatSysMsgView,
  isGroupChat: boolean,
  ownAddr?: string,
): string {
  const { t } = useI18n();
  const { getContactName } = useContactsStore();
  const appStore = useAppStore();

  const { sender, systemData, isIncomingMsg } = message;
  const { event } = systemData;

  switch (event) {
    case 'accept:invitation': {
      const acceptedSender = get(systemData, ['value', 'sender'], '');
      return t('chat.invitation.message.default.accepted', { name: acceptedSender || sender });
    }

    case 'update:chatName': {
      const text = t('chat.system_message.rename_chat');
      const msgSender = isIncomingMsg ? sender : appStore.user!;
      return `${text} ${getContactName(msgSender)}`;
    }

    case 'update:settings': {
      const { settings = {} } = (systemData as UpdatedChatSettingsSysMsgData).value;
      const autoDeleteMessageId = (settings?.autoDeleteMessages || '0') as '0' | '1' | '2' | '3' | '4' | '5';
      const timerValueText: string = t(AUTO_DELETE_MESSAGES_BY_ID[autoDeleteMessageId].label);

      switch (autoDeleteMessageId) {
        case '1':
        case '2':
        case '3':
        case '4':
          return !sender || sender === ownAddr
            ? t('messages.info_message.autodelete.set_you', { value: timerValueText })
            : t('messages.info_message.autodelete.set_user', {
                user: sender,
                value: timerValueText,
              });
        case '0':
        default:
          return !sender || sender === ownAddr
            ? t('messages.info_message.autodelete.unset_you')
            : t('messages.info_message.autodelete.unset_user', { user: sender });
      }
    }

    case 'member-left': {
      const memberWhoLeft = get(systemData, ['value', 'sender'], '');
      return t('chat.system_message.member_left', { member: memberWhoLeft || sender });
    }

    case 'member-removed': {
      const { chatDeleted } = systemData;
      return chatDeleted
        ? t('chat_deleted.chat.system.message', { admin: sender })
        : t('chat.system_message.you_are_removed', { admin: sender });
    }

    case 'update:members': {
      const {
        value: { membersAfterUpdate, membersToAdd, membersToDelete },
      } = systemData;

      if (Object.keys(membersToDelete).length > 0 && Object.keys(membersToDelete).includes(ownAddr!)) {
        return t('chat.system_message.remove_me', { admin: sender || '' });
      }

      if (Object.keys(membersToDelete).length > 0 && Object.keys(membersToAdd).length > 0) {
        return t('chat.system_message.add_and_remove_members', {
          admin: sender || ownAddr || '',
          membersToAdd: Object.keys(membersToAdd).join(', '),
          membersToDelete: Object.keys(membersToDelete).join(', '),
          participantsNum: `${Object.keys(membersAfterUpdate).length}`,
        });
      }

      if (Object.keys(membersToDelete).length > 0 && Object.keys(membersToAdd).length === 0) {
        return t('chat.system_message.remove_members', {
          admin: sender || ownAddr || '',
          membersToDelete: Object.keys(membersToDelete).join(', '),
          participantsNum: `${Object.keys(membersAfterUpdate).length}`,
        });
      }

      if (Object.keys(membersToDelete).length === 0 && Object.keys(membersToAdd).length > 0) {
        return t('chat.system_message.add_members', {
          admin: sender || ownAddr || '',
          membersToAdd: Object.keys(membersToAdd).join(', '),
          participantsNum: `${Object.keys(membersAfterUpdate).length}`,
        });
      }

      return '';
    }

    case 'update:admins': {
      const {
        value: { adminsToAdd = [], adminsToDelete = [] },
      } = systemData;

      if (adminsToDelete.length > 0 && adminsToAdd.length > 0) {
        return t('chat.system_message.add_and_remove_admins', {
          admin: sender || ownAddr || '',
          adminsToDelete: adminsToDelete.join(', '),
          adminsToAdd: adminsToAdd.join(', '),
        });
      }

      if (adminsToDelete.length > 0 && adminsToAdd.length === 0) {
        return t('chat.system_message.remove_admins', {
          admin: sender || ownAddr || '',
          adminsToDelete: adminsToDelete.join(', '),
        });
      }

      if (adminsToDelete.length === 0 && adminsToAdd.length > 0) {
        return t('chat.system_message.add_admins', {
          admin: sender || ownAddr || '',
          adminsToAdd: adminsToAdd.join(', '),
        });
      }

      return '';
    }

    case 'call': {
      const { sender, direction } = systemData.value as CallMsgBodySysMsgData['value'];
      return direction === 'incoming' ? t('va.text.incoming_call', { sender }) : t('va.text.outgoing_call');
    }

    case 'webrtc-call': {
      const { sender: byUser, subType } = systemData.value as WebRTCMsgBodySysMsgData['value'];
      if (isIncomingMsg) {
        return subType === 'outgoing-call-cancelled'
          ? t('va.text.missed_incoming_call', { sender: byUser })
          : isGroupChat
            ? t('va.text.incoming_call_not_accepted', { user: byUser })
            : t('va.text.outgoing_call_cancelled_by', { user: byUser });
      }

      return subType === 'outgoing-call-cancelled' ? '' : t('va.text.incoming_call_cancelled', { sender: byUser });
    }

    default:
      return '';
  }
}

export function getTextForChatInvitationMessage(
  message: ChatInvitationMsgView,
  chatStatus?: SingleChatStatus | GroupChatStatus,
): string {
  const { t } = useI18n();

  const { sender, inviteData, isIncomingMsg, groupSender } = message as ChatInvitationMsgView & {
    groupSender?: string;
  };

  switch (inviteData.type) {
    case 'oto-chat-invite': {
      if (isIncomingMsg) {
        const { neverContactedInitiator } = inviteData;
        return neverContactedInitiator
          ? chatStatus === 'invited'
            ? t('chat.invitation.message.oto.incoming_from_unknown', { sender })
            : t('chat.invitation.message.oto.accepted_from_unknown', { sender })
          : chatStatus === 'invited'
            ? t('chat.invitation.message.oto.incoming', { sender })
            : t('chat.invitation.message.oto.accepted', { sender });
      }

      return t('chat.invitation.message.oto.sent');
    }

    case 'group-chat-invite': {
      const appStore = useAppStore();
      const members = Object.keys(inviteData.members!)
        .filter(m => m !== appStore.user)
        .join(', ');
      if (isIncomingMsg) {
        const { neverContactedInitiator } = inviteData;
        return neverContactedInitiator
          ? chatStatus === 'invited'
            ? t('chat.invitation.message.group.incoming_from_unknown', {
                sender: sender || groupSender || '',
              })
            : t('chat.invitation.message.group.accepted_from_unknown', {
                sender: sender || groupSender || '',
              })
          : chatStatus === 'invited'
            ? t('chat.invitation.message.group.incoming', { sender: sender || groupSender || '' })
            : t('chat.invitation.message.group.accepted', {
                sender: sender || groupSender || '',
              });
      }

      return t('chat.invitation.message.group.sent', { members });
    }

    default: {
      const { groupChat, oneToOneChat } = inviteData;
      const { name } = oneToOneChat || ({} as OneToOneChatParameters);
      if (isIncomingMsg) {
        if (oneToOneChat) {
          return t('chat.invitation.message.default.accepted', { name });
        }

        if (groupChat) {
          return t('chat.invitation.message.default.accepted', { name: sender });
        }

        throw new Error(`This message should've been rejected`);
      }

      return t('chat.invitation.message.default.sent');
    }
  }
}

export function timeInSecondsToString(timeInSeconds: number): string {
  let remainder = timeInSeconds;
  const hours = remainder > 3600 ? `${Math.floor(remainder / 3600)}` : 0;
  remainder = remainder % 3600;
  const minutes = `${Math.floor(remainder / 60)}`;
  const seconds = `${Math.floor(remainder % 60)}`;
  const str = `${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
  return hours === 0 ? str : `${hours.padStart(2, '0')}:${str}`;
}
