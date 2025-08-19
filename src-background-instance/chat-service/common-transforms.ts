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

/* eslint-disable @typescript-eslint/no-unused-vars */

import { MsgDbEntry } from '../dataset/versions/v2/msgs-db.ts';
import { areAddressesEqual } from '../../shared-libs/address-utils.ts';
import type { ChatListItemView, ChatMessageView, RegularMsgView } from '../../types/chat.types.ts';
import type {
  ChatIdObj,
  ChatSystemMessageData,
  InvitationProcessMsgData,
  StoredInvitationParams,
} from '../../types/asmail-msgs.types.ts';
import type { ChatDbEntry, GroupChatDbEntry, OTOChatDbEntry } from '@bg/dataset/versions/v2/chats-db.ts';
import { ChatsData } from '@bg/dataset/index.ts';

function msgDbEntryToChatMessageView(data: MsgDbEntry): ChatMessageView {
  const {
    groupChatId,
    otoPeerCAddr,
    chatMessageId,
    isIncomingMsg,
    incomingMsgId,
    groupSender,
    body,
    attachments,
    chatMessageType,
    status,
    timestamp,
  } = data;

  const isGroupChat = !!groupChatId;

  return {
    chatId: { isGroupChat, chatId: isGroupChat ? groupChatId! : otoPeerCAddr! },
    chatMessageId,
    timestamp,
    isIncomingMsg,
    incomingMsgId: incomingMsgId || undefined,
    sender: isIncomingMsg ? groupSender || otoPeerCAddr! : '',
    chatMessageType,
    status: status || undefined,
    attachments: attachments || undefined,
    ...(chatMessageType === 'regular' && { body }),
    ...(chatMessageType === 'system' && body && { systemData: JSON.parse(body!) as ChatSystemMessageData }),
    ...(chatMessageType === 'invitation' && body && { inviteData: JSON.parse(body) as StoredInvitationParams }),
  } as ChatMessageView;
}

export function chatViewFromOTOChatDbEntry(
  otoChatDbEntry: OTOChatDbEntry,
  options?: unknown,
): ChatListItemView {
  const {
    peerCAddr,
    peerAddr,
    name,
    createdAt,
    lastUpdatedAt,
    status,
    lastMsg,
    unread = 0,
  } = otoChatDbEntry;

  return {
    isGroupChat: false,
    chatId: peerCAddr,
    peerAddr,
    name,
    createdAt,
    lastUpdatedAt,
    status,
    unread,
    lastMsg: lastMsg ? msgDbEntryToChatMessageView(lastMsg) : null,
  };
}

export function chatViewFromGroupChatDbEntry(
  groupChatDbEntry: GroupChatDbEntry,
  options?: unknown,
): ChatListItemView {
  const {
    chatId,
    admins,
    createdAt,
    lastUpdatedAt,
    members,
    name,
    status,
    lastMsg,
    unread = 0,
  } = groupChatDbEntry;

  return {
    isGroupChat: true,
    chatId,
    admins,
    createdAt,
    lastUpdatedAt,
    members,
    name,
    status,
    unread,
    lastMsg: lastMsg ? msgDbEntryToChatMessageView(lastMsg) : null,
  };
}

export function chatViewFromChatDbEntry(chat: GroupChatDbEntry | OTOChatDbEntry): ChatListItemView {
  return (chat as OTOChatDbEntry).peerCAddr
    ? chatViewFromOTOChatDbEntry(chat as OTOChatDbEntry)
    : chatViewFromGroupChatDbEntry(chat as GroupChatDbEntry);
}

export function msgDbEntryForIncomingSysMsg(
  sender: string,
  chatId: ChatIdObj,
  chatMessageId: string,
  timestamp: number,
  chatSystemData: ChatSystemMessageData,
): MsgDbEntry {
  return {
    isIncomingMsg: true,
    chatMessageId,
    chatMessageType: 'system',
    otoPeerCAddr: (chatId.isGroupChat ? null : chatId.chatId),
    groupChatId: (chatId.isGroupChat ? chatId.chatId : null),
    status: null,
    groupSender: (chatId.isGroupChat ? sender : null),
    timestamp,
    body: JSON.stringify(chatSystemData),
    attachments: null,
    history: null,
    incomingMsgId: null,
    reactions: null,
    relatedMessage: null,
  };
}

export function msgViewFromDbEntry(
  msgDbEntry: MsgDbEntry,
  relatedMessage: RegularMsgView['relatedMessage'],
  ownAddr: string,
): ChatMessageView {
  const {
    attachments,
    body,
    chatMessageId,
    chatMessageType,
    groupChatId,
    groupSender,
    incomingMsgId,
    isIncomingMsg,
    otoPeerCAddr,
    status,
    timestamp,
  } = msgDbEntry;

  const chatId: ChatIdObj = {
    isGroupChat: !!groupChatId,
    chatId: groupChatId ? groupChatId : otoPeerCAddr!,
  };
  const sender = chatId.isGroupChat
    ? groupSender!
    : isIncomingMsg ? otoPeerCAddr! : ownAddr;

  switch (chatMessageType) {
    case 'regular':
      return {
        chatId,
        chatMessageId,
        isIncomingMsg,
        incomingMsgId: incomingMsgId ?? undefined,
        chatMessageType,
        timestamp,
        sender,
        body: body ?? '',
        attachments: attachments ?? undefined,
        relatedMessage,
        status: status!,
      };

    case 'system': {
      let systemData: ChatSystemMessageData;

      try {
        systemData = JSON.parse(body!);

      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        systemData = {} as any;
      }

      return {
        chatId,
        chatMessageId,
        isIncomingMsg,
        chatMessageType,
        timestamp,
        sender,
        systemData,
      };
    }

    default: {
      let inviteData: InvitationProcessMsgData;
      try {
        inviteData = JSON.parse(body!);

      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inviteData = {} as any;
      }
      return {
        chatId,
        chatMessageId,
        isIncomingMsg,
        chatMessageType,
        timestamp,
        sender,
        inviteData,
      };
    }
  }
}

export function chatIdOfChat(chat: GroupChatDbEntry | OTOChatDbEntry): ChatIdObj {
  return (chat as OTOChatDbEntry).peerCAddr ?
    chatIdOfOTOChat(chat as OTOChatDbEntry) :
    chatIdOfGroupChat(chat as GroupChatDbEntry);
}

export function chatIdOfOTOChat({ peerCAddr }: OTOChatDbEntry): ChatIdObj {
  return {
    isGroupChat: false,
    chatId: peerCAddr,
  };
}

export function chatIdOfGroupChat({ chatId }: GroupChatDbEntry): ChatIdObj {
  return {
    isGroupChat: true,
    chatId,
  };
}

export function chatIdOfMsg(msg: MsgDbEntry): ChatIdObj {
  const { groupChatId, otoPeerCAddr } = msg;
  return {
    isGroupChat: !!groupChatId,
    chatId: (groupChatId ? groupChatId : otoPeerCAddr!),
  };
}

export function excludeAddrFrom(lst: string[], excludeAddr: string): string[] {
  return lst.filter(addr => !areAddressesEqual(addr, excludeAddr));
}

export function chatViewForGroupChat(chat: GroupChatDbEntry, data: ChatsData): ChatListItemView {
  return chatViewFromGroupChatDbEntry(chat);
}

export function chatViewForOTOChat(chat: OTOChatDbEntry, data: ChatsData): ChatListItemView {
  return chatViewFromOTOChatDbEntry(chat);
}

export function recipientsInChat(chat: ChatDbEntry, ownAddr: string): string[] {
  return chat.isGroupChat
    ? Object.keys(chat.members).filter(addr => !areAddressesEqual(addr, ownAddr))
    : [chat.peerAddr];
}

export function makeMsgDbEntry(
  chatMessageType: MsgDbEntry['chatMessageType'],
  chatMessageId: string,
  params: Partial<MsgDbEntry>,
): MsgDbEntry {
  return {
    isIncomingMsg: false,
    incomingMsgId: null,
    groupChatId: null,
    otoPeerCAddr: null,
    attachments: null,
    body: null,
    groupSender: null,
    history: null,
    reactions: null,
    relatedMessage: null,
    status: ((chatMessageType === 'regular') ?
        (params.isIncomingMsg ? 'unread' : 'sending') :
        null
    ),
    timestamp: 0,
    ...params,
    chatMessageType,
    chatMessageId,
  };
}
