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
import { msgsDb } from './msgs-db.ts';
import { chatsDb } from './chats-db.ts';
import type { DB } from '../types/index.ts';

export async function dataset(): Promise<DB> {
  const fs = await w3n.storage!.getAppSyncedFS();
  const fsLocal = await w3n.storage!.getAppLocalFS();

  const msgsBdSrv = await msgsDb({ fs, fsLocal });
  const chatsBdSrv = await chatsDb({ fs, fsLocal, msgsBdSrv });

  return {
    addMessage: msgsBdSrv.addMessage,
    getMessage: msgsBdSrv.getMessage,
    getExpiredMessages: msgsBdSrv.getExpiredMessages,
    getMessagesByChat: msgsBdSrv.getMessagesByChat,
    getNotRegularMessagesByChat: msgsBdSrv.getNotRegularMessagesByChat,
    getMessagesWithSyncingSelfStatus: msgsBdSrv.getMessagesWithSyncingSelfStatus,
    getLatestIncomingMsgTimestamp: msgsBdSrv.getLatestIncomingMsgTimestamp,
    getLatestMsgInChat: msgsBdSrv.getLatestMsgInChat,
    getUnreadMsgsCountIn: msgsBdSrv.getUnreadMsgsCountIn,
    getRecentReactions: msgsBdSrv.getRecentReactions,
    deleteMessage: msgsBdSrv.deleteMessage,
    deleteMessagesInChat: msgsBdSrv.deleteMessagesInChat,
    updateMessageRecord: msgsBdSrv.updateMessageRecord,
    addOrphanedMessage: msgsBdSrv.addOrphanedMessage,
    getStuckMessageForTargetMessageId: msgsBdSrv.getStuckMessageForTargetMessageId,
    deleteOrphanedMessage: msgsBdSrv.deleteOrphanedMessage,
    collectGarbageInAuxiliaryDB: msgsBdSrv.collectGarbageInAuxiliaryDB,
    findChat: chatsBdSrv.findChat,
    addOneToOneChat: chatsBdSrv.addOneToOneChat,
    addGroupChat: chatsBdSrv.addGroupChat,
    updateOTOChatRecord: chatsBdSrv.updateOTOChatRecord,
    updateGroupChatRecord: chatsBdSrv.updateGroupChatRecord,
    getChatList: chatsBdSrv.getChatList,
    deleteChat: chatsBdSrv.deleteChat,
  };
}
