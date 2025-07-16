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

// @deno-types="../../shared-libs/sqlite-on-3nstorage/index.d.ts"
import { SQLiteOn3NStorage } from '../../shared-libs/sqlite-on-3nstorage/index.js';
import { ChatIdObj, ChatMessageId } from "../../types/asmail-msgs.types.ts";
import { ChatDbEntry, ChatsDB, GroupChatDbEntry, OTOChatDbEntry, initializeV1chats } from './versions/v1/chats-db.ts';
import { MsgDbEntry, MsgsDBs, RefsToMsgsDataNoInDB, initializeV1msgs } from './versions/v1/msgs-db.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';
import { getVersionNoneData } from './versions/v0-none/read-v0.ts';

export class ChatsData {

  constructor(
    private readonly chats: ChatsDB,
    private readonly msgs: MsgsDBs
  ) {}

  static async makeAndStart(ownAddr: string): Promise<ChatsData> {
    const { chats, msgs } = await initChatDbFromFile(ownAddr);
    return new ChatsData(chats, msgs);
  }

  findChat(chatId: ChatIdObj): ChatDbEntry|undefined {
    return this.chats.findChat(chatId);
  }

  async addGroupChat(
    chat: Omit<GroupChatDbEntry, 'createdAt' | 'lastUpdatedAt'>
  ): Promise<GroupChatDbEntry> {
    ensureAllAdminsAreInMembers(chat.admins, chat.members);
    const chatId = this.chats.addGroupChat(chat);
    await this.chats.saveLocally();
    return chatId;
  }

  async addOneToOneChat(
    params: Pick<OTOChatDbEntry, 'peerAddr' | 'name' | 'status'>
  ): Promise<OTOChatDbEntry> {
    const chat = this.chats.addOneToOneChat(params);
    await this.chats.saveLocally();
    return chat;
  }

  async updateGroupChatRecord(
    chatId: string, toUpdate: Partial<GroupChatDbEntry>
  ): Promise<GroupChatDbEntry|undefined> {
    const dbUpdated = this.chats.updateGroupChat(chatId, toUpdate);
    if (dbUpdated) {
      await this.chats.saveLocally();
      return this.chats.getGroupChat(chatId);
    }
  }

  async updateOTOChatRecord(
    peerCAddr: string, toUpdate: Partial<OTOChatDbEntry>
  ): Promise<OTOChatDbEntry|undefined> {
    const dbUpdated = this.chats.updateOTOChat(peerCAddr, toUpdate);
    if (dbUpdated) {
      await this.chats.saveLocally();
      return this.chats.getOTOChat(peerCAddr);
    }
  }

  getChatList(): ChatDbEntry[] {
    const otoChats = (this.chats.getOTOChatsList() as ChatDbEntry[]).map(c => {
      c.isGroupChat = false;
      return c;
    });
    const groupChats = (this.chats.getGroupChatsList() as ChatDbEntry[])
    .map(c => {
      c.isGroupChat = true;
      return c;
    });
    return [ ...otoChats, ...groupChats ];
  }

  async deleteChat(
    chatId: ChatIdObj
  ): ReturnType<ChatsData['deleteMessagesInChat']> {
    if (chatId.isGroupChat) {
      await this.deleteGroupChat(chatId.chatId);
    } else {
      await this.deleteOTOChat(chatId.chatId);
    }
    return await this.deleteMessagesInChat(chatId);
  }

  private async deleteGroupChat(chatId: string): Promise<void> {
    const dbUpdated = this.chats.deleteGroupChat(chatId);
    if (dbUpdated) {
      await this.chats.saveLocally();
    }
  }

  private async deleteOTOChat(peerCAddr: string): Promise<void> {
    const dbUpdated = this.chats.deleteOTOChat(peerCAddr);
    if (dbUpdated) {
      await this.chats.saveLocally();
    }
  }

  async deleteMessagesInChat(
    { isGroupChat, chatId }: ChatIdObj
  ): Promise<RefsToMsgsDataNoInDB|undefined> {
    const dataNotInDB = await (isGroupChat?
      this.msgs.msgsInInboxAndOutgoingAttachmentsInGroupChat(chatId) :
      this.msgs.msgsInInboxAndOutgoingAttachmentsInOTOChat(chatId)
    );
    const dbUpdated = await (isGroupChat?
      this.msgs.deleteMessagesInGroupChat(chatId) :
      this.msgs.deleteMessagesInOneToOneChat(chatId)
    );
    if (dbUpdated) {
      await this.msgs.saveLocally();
      return dataNotInDB;
    }
  }

  async addMessage(msg: MsgDbEntry): Promise<void> {
    await this.msgs.addMessage(msg);
    await this.msgs.saveLocally();
  }

  getMessage(chatMessageId: ChatMessageId) {
    return this.msgs.getMessage(chatMessageId);
  }

  async deleteMessage(chatMessageId: ChatMessageId): Promise<void> {
    const dbUpdated = await this.msgs.deleteMessage(chatMessageId);
    if (dbUpdated) {
      await this.msgs.saveLocally();
    }
  }

  getMessagesByChat({ isGroupChat, chatId }: ChatIdObj) {
    return (isGroupChat ?
      this.msgs.getMessagesInGroupChat(chatId) :
      this.msgs.getMessagesInOneToOneChat(chatId)
    );
  }

  getLatestIncomingMsgTimestamp(): number|undefined {
    return this.msgs.getLatestIncomingMsgTimestamp();
  }

  getUnreadMsgsCountIn(chatId: ChatIdObj): number {
    return this.msgs.getUnreadMsgsCountIn(chatId);
  }

  async updateMessageRecord(
    chatMessageId: ChatMessageId, toUpdate: Partial<MsgDbEntry>
  ): Promise<MsgDbEntry|undefined> {
    const dbUpdated = await this.msgs.updateMessageRecord(
      chatMessageId, toUpdate
    );
    if (dbUpdated) {
      await this.msgs.saveLocally();
      return await this.msgs.getMessage(chatMessageId);
    }
  }

}

function ensureAllAdminsAreInMembers(
  admins: string[], members: string[]
): void {
  for (const addr of admins) {
    if (!members.includes(addr)) {
      throw makeDbRecordException({
        invalidChatInsertData: true,
        message: `At least one of chat admins entries is not present precisely in chat members array`
      });
    }
  }
}

type WritableFS = web3n.files.WritableFS;
type WritableFile = web3n.files.WritableFile;

const CHATS_DB_FNAME = 'chats-db';
const MSGS_DBS_DIR_NAME = 'msgs-dbs';
const MSGS_DB_FNAME_PREFIX = 'msgs-db_';
const DATASET_META_ATTR = 'chat-dataset';

function msgDbFNameFor(fstTS: number): string {
  return `${MSGS_DB_FNAME_PREFIX}${fstTS}`;
}

interface DbFileMeta {
  datasetVersion: number;
  db: 'chats' | 'msgs';
}

async function initChatDbFromFile(ownAddr: string): Promise<{
  chats: ChatsDB; msgs: MsgsDBs;
}> {
  const fs = await w3n.storage!.getAppSyncedFS();
  const chatsFile = await fs.writableFile(CHATS_DB_FNAME);
  const msgsFolder = await fs.writableSubRoot(MSGS_DBS_DIR_NAME);
  if (chatsFile.isNew) {
    return await initNewDbsIn(chatsFile, msgsFolder);
  } else {
    const info: DbFileMeta|undefined = await chatsFile.getXAttr(
      DATASET_META_ATTR
    );
    if (!info) {
      const {
        groupChats, otoChats, msgRecords
      } = await getVersionNoneData(chatsFile, ownAddr)
      .catch(async err => {
        await w3n.log('error', `Fail to read database file that should have version 0 of a dataset`);
        return { groupChats: [], otoChats: [], msgRecords: [] };
      });
      await fs.deleteFile(CHATS_DB_FNAME);
      const { chats, msgs } = await initNewDbsIn(
        await fs.writableFile(CHATS_DB_FNAME), msgsFolder
      );
      await chats.absorbChatRecords(groupChats, otoChats);
      await msgs.absorbMsgRecords(msgRecords);
      await w3n.log('info', `Transformed ${groupChats.length} group chats, ${otoChats.length} one-to-one chats and ${msgRecords.length} messages from dataset version 0 to version 1.`);
      return { chats, msgs };
    } else if (info.datasetVersion === 1) {
      const chats = await existingDbIn(chatsFile);
      const msgs = await existingDbIn(
        await msgsFolder.writableFile(msgDbFNameFor(0))
      );
      return {
        chats: new ChatsDB(chats),
        msgs: new MsgsDBs(msgs)
      };
    } else if (info.datasetVersion > 1) {
      throw new Error(`Chat db data version ${info.datasetVersion} is greater than 1. Newer app version should be run.`);
    } else {

      // XXX

      throw new Error(
        `${DATASET_META_ATTR} xattribute on chats db file is messed up.
        Is any fix attempt even feasible?
        Should data just be archived, labeled as corrupted, and fresh everything added?
        And we may want to have some explicitly articulated approach to archives in chat app's dataset.`
      );
    }
  }
}

async function initNewDbsIn(
  chatsFile: WritableFile, msgsFolder: WritableFS
): Promise<{ chats: ChatsDB; msgs: MsgsDBs; }> {
  const chats = await initNewDbIn('chats', chatsFile);
  const msgs = await initNewDbIn(
    'msgs', await msgsFolder.writableFile(msgDbFNameFor(0))
  );
  return {
    chats: new ChatsDB(chats),
    msgs: new MsgsDBs(msgs)
  };
}

async function initNewDbIn(
  type: DbFileMeta['db'], file: WritableFile
): Promise<SQLiteOn3NStorage> {
  const sqlite = await SQLiteOn3NStorage.makeAndStart(file);
  if (type === 'msgs') {
    initializeV1msgs(sqlite.db);
  } else if (type === 'chats') {
    initializeV1chats(sqlite.db);
  } else {
    throw new Error(`Unknown db type ${type}`);
  }
  await sqlite.saveToFile({ skipUpload: true });
  const info: DbFileMeta = {
    datasetVersion: 1,
    db: type
  };
  await file.updateXAttrs({ set: { [DATASET_META_ATTR]: info } });
  return sqlite;
}

async function existingDbIn(file: WritableFile): Promise<SQLiteOn3NStorage> {
  return  await SQLiteOn3NStorage.makeAndStart(file);
}