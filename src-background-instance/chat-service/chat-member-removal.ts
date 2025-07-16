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
import type { ChatService } from './index.ts';
import { chatIdOfChat } from './common-transforms.ts';
import { ChatDbEntry } from '../dataset/versions/v1/chats-db.ts';
import { includesAddress } from '../../shared-libs/address-utils.ts';
import { ChatIdObj, ChatMessageId } from "../../types/asmail-msgs.types.ts";
import { removeMsgDataNotInDB } from './msg-deletion.ts';

export class ChatMemberRemoval {

  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly filesStore: ChatService['filesStore'],
    private readonly ownAddr: string,
    private readonly removeMessageFromInbox:
      ChatService['removeMessageFromInbox']
  ) {}

  // Note 1: There is no action towards others here, as user is being removed.
  // 
  // Note 2: Deletion of chat by admin is also an effective removal, as whole
  //         chat is gone, indicated by flag in system message.

  async handleMemberRemovedChat(
    sender: string, chat: ChatDbEntry, chatDeleted: boolean|undefined
  ): Promise<void> {
    // check request
    if (chat.isGroupChat) {
      if (!includesAddress(chat.admins, sender)) {
        return;
      }
    }

    // do local changes
    const chatId = chatIdOfChat(chat);
    await this.data.deleteMessagesInChat(chatId);
    const msgsDataToRm = await this.data.deleteChat(chatId);
    if (msgsDataToRm) {
      removeMsgDataNotInDB(
        msgsDataToRm, this.removeMessageFromInbox, this.filesStore
      );
    }
    this.emit.chat.removed(chatId);
  }

}