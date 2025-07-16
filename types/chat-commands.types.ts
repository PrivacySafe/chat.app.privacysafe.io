/*
 Copyright (C) 2024 - 2025 3NSoft Inc.

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

import { ChatIdObj } from "./asmail-msgs.types";

export type MainWindowCommand = 'open-chat-with' | 'incoming-call';

export interface OpenChatCmdArg {
  peerAddress: string;
  chatId?: ChatIdObj;
}

export interface IncomingCallCmdArg {
  peerAddress: string;
  chatId: ChatIdObj;
}
