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

import { MsgDbEntry } from '../dataset/versions/v1/msgs-db.ts';
import { areAddressesEqual } from '../../shared-libs/address-utils.ts';
import { ChatListItemView, ChatMessageView, RegularMsgView } from '../../types/chat.types.ts';
import { ChatIdObj, ChatSystemMessageData, InvitationProcessMsgData } from "../../types/asmail-msgs.types.ts";
import { ChatDbEntry, GroupChatDbEntry, OTOChatDbEntry } from '@bg/dataset/versions/v1/chats-db.ts';
import { ChatsData } from '@bg/dataset/index.ts';

export function chatViewFromOTOChatDbEntry(
  {
    peerCAddr, peerAddr, name, createdAt, lastUpdatedAt, status
  }: OTOChatDbEntry,
  { unread, lastMsg }: {
    unread: number;
    lastMsg?: ChatMessageView;
  }
): ChatListItemView {
  return {
    isGroupChat: false,
    chatId: peerCAddr,
    peerAddr, name, createdAt, lastUpdatedAt, status,
    unread, lastMsg
  };
}

export function chatViewFromGroupChatDbEntry(
  {
    chatId, admins, createdAt, lastUpdatedAt, members, name, status
  }: GroupChatDbEntry,
  { unread, lastMsg }: {
    unread: number;
    lastMsg?: ChatMessageView;
  }
): ChatListItemView {
  return {
    isGroupChat: true,
    chatId, admins, createdAt, lastUpdatedAt, members, name, status,
    unread, lastMsg
  };
}

export function chatViewFromChatDbEntry(
  chat: GroupChatDbEntry|OTOChatDbEntry
): ChatListItemView {
  if ((chat as OTOChatDbEntry).peerCAddr) {
    return chatViewFromOTOChatDbEntry(chat as OTOChatDbEntry, { unread: 0 });
  } else {
    return chatViewFromGroupChatDbEntry(
      chat as GroupChatDbEntry, { unread: 0 }
    );
  }
}

export function msgDbEntryForIncomingSysMsg(
  sender: string, chatId: ChatIdObj, chatMessageId: string, timestamp: number,
  chatSystemData: ChatSystemMessageData
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
    relatedMessage: null
  };
}

export function msgViewFromDbEntry({
    attachments, body, chatMessageId, chatMessageType, groupChatId, groupSender,
    history, incomingMsgId, isIncomingMsg, otoPeerCAddr, reactions, status, timestamp
  }: MsgDbEntry,
  relatedMessage: RegularMsgView['relatedMessage'],
  ownAddr: string
): ChatMessageView {
  const chatId: ChatIdObj = {
    isGroupChat: !!groupChatId,
    chatId: (groupChatId ? groupChatId : otoPeerCAddr!)
  };
  const sender = (chatId.isGroupChat ?
    groupSender :
    (isIncomingMsg ? otoPeerCAddr : ownAddr)
  )!;
  if (chatMessageType === 'regular') {
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
      status: status!
    };
  } else if (chatMessageType === 'system') {
    let systemData: ChatSystemMessageData;
    try {
      systemData = JSON.parse(body!);
    } catch (_) {
      systemData = {} as any;
    }
    return {
      chatId,
      chatMessageId,
      isIncomingMsg,
      chatMessageType,
      timestamp,
      sender,
      systemData
    };
  } else {
    let inviteData: InvitationProcessMsgData;
    try {
      inviteData = JSON.parse(body!);
    } catch (_) {
      inviteData = {} as any;
    }
    return {
      chatId,
      chatMessageId,
      isIncomingMsg,
      chatMessageType,
      timestamp,
      sender,
      inviteData
    };
  }
}

export function chatIdOfChat(chat: GroupChatDbEntry|OTOChatDbEntry): ChatIdObj {
  return (((chat as OTOChatDbEntry).peerCAddr) ?
    chatIdOfOTOChat(chat as OTOChatDbEntry) :
    chatIdOfGroupChat(chat as GroupChatDbEntry)
  );
}

export function chatIdOfOTOChat({ peerCAddr }: OTOChatDbEntry): ChatIdObj {
  return {
    isGroupChat: false,
    chatId: peerCAddr
  };
}

export function chatIdOfGroupChat({ chatId }: GroupChatDbEntry): ChatIdObj {
  return {
    isGroupChat: true,
    chatId
  };
}

export function chatIdOfMsg(msg: MsgDbEntry): ChatIdObj {
  const { groupChatId, otoPeerCAddr } = msg;
  return {
    isGroupChat: !!groupChatId,
    chatId: (groupChatId ? groupChatId : otoPeerCAddr!)
  };
}

export function excludeAddrFrom(lst: string[], excludeAddr: string): string[] {
  return lst.filter(addr => !areAddressesEqual(addr, excludeAddr));
}

export function chatViewForGroupChat(
  chat: GroupChatDbEntry, data: ChatsData
): ChatListItemView {
  return chatViewFromGroupChatDbEntry(chat, {
    unread: data.getUnreadMsgsCountIn(chatIdOfGroupChat(chat)),
    lastMsg: undefined
  });
}

export function chatViewForOTOChat(
  chat: OTOChatDbEntry, data: ChatsData
): ChatListItemView {
  return chatViewFromOTOChatDbEntry(chat, {
    unread: data.getUnreadMsgsCountIn(chatIdOfOTOChat(chat)),
    lastMsg: undefined
  });
}

export function recipientsInChat(chat: ChatDbEntry, ownAddr: string): string[] {
  return (chat.isGroupChat ?
    chat.members.filter(addr => !areAddressesEqual(addr, ownAddr)) :
    [ chat.peerAddr ]
  );
}

export function makeMsgDbEntry(
  chatMessageType: MsgDbEntry['chatMessageType'],
  chatMessageId: string,
  params: Partial<MsgDbEntry>
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
    chatMessageId
  };
}
