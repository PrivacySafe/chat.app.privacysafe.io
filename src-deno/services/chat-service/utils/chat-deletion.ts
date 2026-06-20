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
import type { ChatIdObj } from '../../../../types/asmail-msgs.types.ts';
import type { ChatSrvEmit, DB, FileStoreService } from '../../../types/index.ts';
import { includesAddress } from '../../../../shared-libs/address-utils.ts';
import { makeDbRecordException } from '../../../utils/exceptions.ts';
import { sendSysMsgsAboutRemovalFromChat } from '../../../utils/send-chat-msg.ts';
import { removeMsgDataNotInDB } from './_msgs-related-methods.ts';
import { recipientsInChat } from './_chats-related-methods.ts';

export async function chatDeletion({
  data,
  filesStore,
  emit,
  ownAddr,
}: {
  data: DB;
  emit: ChatSrvEmit;
  filesStore: FileStoreService;
  ownAddr: string;
}) {
  // Note that for everyone deletion of chat is effectively the same as removal
  // from chat. Hence, there is no handling of anything here.
  async function deleteChat(chatId: ChatIdObj): Promise<void> {
    const chat = data.findChat(chatId);

    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    if (
      chat.isGroupChat &&
      includesAddress(chat.admins, ownAddr) &&
      chat.admins.length === 1 &&
      Object.keys(chat.members).length > 1
    ) {
      throw makeDbRecordException({ chatWithMembers: true });
    }

    // do local changes and notifications
    const msgsDataToRm = await data.deleteChat(chatId);
    if (msgsDataToRm) {
      await removeMsgDataNotInDB(msgsDataToRm, filesStore);
    }
    emit.chat.removed(chatId);

    // notify peers
    const peersToNotify = recipientsInChat(chat, ownAddr);
    await sendSysMsgsAboutRemovalFromChat(chatId, peersToNotify, true);
  }

  return {
    deleteChat,
  };
}
