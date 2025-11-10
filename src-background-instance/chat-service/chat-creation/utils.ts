/*
 Copyright (C) 2025 3NSoft Inc.

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
  InvitationProcessMsgData,
  StoredInvitationParams,
} from '../../../types/asmail-msgs.types.ts';
import { toCanonicalAddress } from '../../../shared-libs/address-utils.ts';

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

  if (inviteData.type === 'updated-members-invitation-data') {
    return inviteData.chatId;
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

export function chatIdFromGroupChatInvite({ groupChatId }: GroupChatParameters): ChatIdObj | undefined {
  return !groupChatId.includes('@')
    ? { isGroupChat: true, chatId: groupChatId }
    : undefined;
}

export function serializeInvitation(inviteParams: StoredInvitationParams): string {
  return JSON.stringify(inviteParams);
}

export function deserializeInvitation(msgBody: string): StoredInvitationParams {
  return JSON.parse(msgBody);
}
