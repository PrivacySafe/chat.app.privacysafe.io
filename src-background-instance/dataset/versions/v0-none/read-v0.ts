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

// @deno-types="../../../../shared-libs/sqlite-on-3nstorage/index.d.ts"
import { objectFromQueryExecResult, SQLiteOn3NStorage } from '../../../../shared-libs/sqlite-on-3nstorage/index.js';
import { ChatIdObj, ChatMessageId } from "../../../../types/asmail-msgs.types.ts";
import { ChatView, SingleChatView } from '../../../../types/chat.types.ts';
import { ChatDbEntry, ChatsDB, GroupChatDbEntry, OTOChatDbEntry, initializeV1chats } from '../v1/chats-db.ts';
import { MsgDbEntry, MsgsDBs, initializeV1msgs } from '../v1/msgs-db.ts';
import { makeDbRecordException } from '../../../utils/exceptions.ts';
import { areAddressesEqual, toCanonicalAddress } from '../../../../shared-libs/address-utils.ts';

type WritableFile = web3n.files.WritableFile;

interface ChatV0Record {
  chatId: string;
  name: string;
  members: string;  // JSON of string[]
  admins: string;  // JSON of string[]
  createdAt: number;
}

interface MsgV0Record {
  chatMessageId: string;
  msgId: string;
  messageType: 'incoming' | 'outgoing';
  chatMessageType: 'regular' | 'system';
  sender: string;
  body: string;
  attachments: string;  // JSON of attachments info
  initialMessageId: string | null;
  status: 'received' | 'sent' | null;
  timestamp: number;
  chatId: string;
}

function chatDbEntryFrom(rec: ChatV0Record, ownAddr: string): {
  groupChat?: GroupChatDbEntry, otoChat?: OTOChatDbEntry, initChatId: string
} {
  const { chatId, name, createdAt } = rec;
  const members = JSON.parse(rec.members) as string[];
  const admins = JSON.parse(rec.admins) as string[];
  if (members.length > 2) {
    return {
      initChatId: chatId,
      groupChat: {
        chatId,
        name,
        status: 'on',
        createdAt,
        lastUpdatedAt: createdAt,
        admins,
        members
      }
    };
  } else {
    const peerAddr = members.find(addr => !areAddressesEqual(addr, ownAddr))!;
    return {
      initChatId: chatId,
      otoChat: {
        createdAt,
        lastUpdatedAt: createdAt,
        name,
        status: 'on',
        peerAddr,
        peerCAddr: toCanonicalAddress(peerAddr)
      }
    };
  }
}

function msgDbEntryFrom(
  rec: MsgV0Record,
  groupChatId: MsgDbEntry['groupChatId'],
  otoPeerCAddr: MsgDbEntry['otoPeerCAddr']
): MsgDbEntry {
  const {
    body, attachments: attachStr, chatMessageId, msgId, sender,
    status, timestamp, messageType, chatMessageType, initialMessageId
  } = rec;
  const isIncomingMsg = (messageType === 'incoming');
  const attachments: MsgDbEntry['attachments'] = (
    ((chatMessageType === 'regular') && attachStr) ?
      JSON.parse(attachStr) : null
  );
  const incomingMsgId: MsgDbEntry['incomingMsgId'] = (
    (
      isIncomingMsg && attachments &&
      (attachments.length > 0) && !attachments[0].id
    ) ?  msgId : null
  );
  return {
    isIncomingMsg,
    incomingMsgId,
    body,
    attachments,
    chatMessageId,
    timestamp,
    chatMessageType,
    status: ((chatMessageType === 'regular') ?
      (isIncomingMsg ? 'read' : status) : null
    ),
    history: null,
    reactions: null,
    relatedMessage: (initialMessageId ? {
      replyTo: {
        chatMessageId: initialMessageId
      }
    } : null),
    groupChatId,
    groupSender: ((isIncomingMsg && groupChatId) ? sender : null),
    otoPeerCAddr
  };
}

export async function getVersionNoneData(
  chatsDbFile: WritableFile, ownAddr: string
): Promise<{
  groupChats: GroupChatDbEntry[];
  otoChats: OTOChatDbEntry[];
  msgRecords: MsgDbEntry[];
}> {
  const chats = new Map<string, {
    groupChat?: GroupChatDbEntry; otoChat?: OTOChatDbEntry;
  }>();
  const vNone = await SQLiteOn3NStorage.makeAndStart(chatsDbFile);
  const initChatRecs = objectFromQueryExecResult<ChatV0Record>(
    vNone.db.exec(`SELECT * FROM chats`)[0]
  );
  for (const initChat of initChatRecs) {
    try {
      const {
        initChatId, groupChat, otoChat
      } = chatDbEntryFrom(initChat, ownAddr);
      chats.set(initChatId, { groupChat, otoChat });
    } catch (err) {}
  }

  const initMsgRecs = objectFromQueryExecResult<MsgV0Record>(
    vNone.db.exec(`SELECT * FROM messages`)[0]
  );
  const msgRecords: MsgDbEntry[] = [];
  for (const initMsg of initMsgRecs) {
    const chat = chats.get(initMsg.chatId);
    if (!chat) {
      console.log(`skipped message from chat ${initMsg.chatId}`);
      continue;
    }
    try {
      const { groupChat, otoChat } = chat;
      const msg = msgDbEntryFrom(
        initMsg,
        (groupChat ? groupChat.chatId : null),
        (otoChat ? otoChat.peerCAddr : null)
      );
      msgRecords.push(msg);
    } catch (err) {
      console.error(err);
    }
  }

  const chatsArr = Array.from(chats.values());
  const groupChats = chatsArr.filter(c => !!c.groupChat).map(c => c.groupChat!);
  const otoChats: OTOChatDbEntry[] = [];
  for (const chat of chatsArr.filter(c => !!c.otoChat).map(c => c.otoChat!)) {
    if (otoChats.find(c => (c.peerCAddr === chat.peerCAddr))) {
      continue;
    } else {
      otoChats.push(chat);
    }
  }

  return { groupChats, otoChats, msgRecords };
}
