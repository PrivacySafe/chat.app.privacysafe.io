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

import { ChatsData } from '../dataset/index.ts';
import { ChatIdObj } from '../../types/asmail-msgs.types.ts';
import type { ChatService } from './index.ts';
import { recipientsInChat } from './common-transforms.ts';
import { includesAddress } from '../../shared-libs/address-utils.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';
import { sendSysMsgsAboutRemovalFromChat } from '../utils/send-chat-msg.ts';
import { removeMsgDataNotInDB } from './msg-deletion.ts';

export class ChatDeletion {
  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly filesStore: ChatService['filesStore'],
    private readonly ownAddr: string,
    private readonly removeMessageFromInbox:
    ChatService['removeMessageFromInbox'],
  ) {
  }

  // Note that for everyone deletion of chat is effectively the same as removal
  // from chat. Hence, there is no handling of anything here.

  async deleteChat(chatId: ChatIdObj): Promise<void> {
    // check request
    const chat = this.data.findChat(chatId);

    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    if (
      chat.isGroupChat
      && includesAddress(chat.admins, this.ownAddr)
      && chat.admins.length === 1
      && Object.keys(chat.members).length > 1
    ) {
      throw makeDbRecordException({ chatWithMembers: true });
    }

    // do local changes and notifications
    const msgsDataToRm = await this.data.deleteChat(chatId);
    if (msgsDataToRm) {
      removeMsgDataNotInDB(msgsDataToRm, this.removeMessageFromInbox, this.filesStore);
    }
    this.emit.chat.removed(chatId);

    // notify peers
    const peersToNotify = recipientsInChat(chat, this.ownAddr);
    await sendSysMsgsAboutRemovalFromChat(chatId, peersToNotify, true);
  }
}
