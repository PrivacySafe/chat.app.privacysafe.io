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
import { ChatIdObj, ChatMessageId } from "../../types/asmail-msgs.types.ts";
import type { ChatService } from './index.ts';
import { chatIdOfOTOChat, chatViewForGroupChat, chatViewForOTOChat, msgDbEntryForIncomingSysMsg } from './common-transforms.ts';
import { GroupChatDbEntry, OTOChatDbEntry } from '../dataset/versions/v2/chats-db.ts';
import { includesAddress } from '../../shared-libs/address-utils.ts';
import { UpdatedMsgBodySysMsgData } from '../../types/asmail-msgs.types.ts';

export class MsgEditing {

  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly ownAddr: string
  ) {}

  // handleUpdateOfMessageBody(
  //   sender: string, chatId: ChatId, chatMessageId: string, timestamp: number,
  //   {}: UpdatedMsgBodySysMsgData['value']
  // ): Promise<void> {
  
  //   // XXX
  
  //   throw new Error(`not implemented`);
  
  // }

}