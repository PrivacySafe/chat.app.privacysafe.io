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

import { sendingMsgsInOTOChatSpec } from './chats/sending-msgs-in-oto-chat.js';
import { oneToOneChatRoomSpec } from './chats/one-to-one-chat.js';
import { groupChatRoomSpec } from './chats/group-chat.js';
import { sendingMsgsInGroupChatSpec } from './chats/sending-msgs-in-group-chat.js';

describe(`chats and chat stores`, () => {

  describe(`one-to-one chat`, oneToOneChatRoomSpec);

  describe(`group chat`, groupChatRoomSpec);

  describe(`message sending in one-to-one chat`, sendingMsgsInOTOChatSpec);

  // describe(`message sending in group chat`, sendingMsgsInGroupChatSpec);

});