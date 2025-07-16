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

import { randomStr } from "./randomStr.ts";
import { ChatMessageView } from "../types/chat.types.ts";
import { ChatIdObj } from "../types/asmail-msgs.types.ts";

export function chatIdToString({ isGroupChat, chatId }: ChatIdObj): string {
  return `${isGroupChat ? 'g' : 's'}/${chatId}`;
}

export function stringToChatId(idStr: string): ChatIdObj {
  if (idStr.startsWith('g/')) {
    return { isGroupChat: true, chatId: idStr.substring(6) };
  } else if (idStr.startsWith('s/')) {
    return { isGroupChat: false, chatId: idStr.substring(7) };
  } else {
    throw new Error(`String ${idStr} can't be parsed to ChatId object`);
  }
}

export function areChatIdsEqual(
  a: ChatIdObj|null|undefined, b: ChatIdObj
): boolean {
  return (a ?
    (a.isGroupChat === b.isGroupChat) && (a.chatId === b.chatId) :
    false
  );
}

export function generateChatMessageId(): Pick<
  ChatMessageView, 'timestamp' | 'chatMessageId'
> {
  const timestamp = Date.now();
  return {
    timestamp,
    chatMessageId: `${Math.floor(timestamp/(100*1000))}-${randomStr(8)}`
  }
}

export function generatOutgoingMsgId(): string {
  // pseudo-random from Math is cheaper, and is ok in local to device namespace
  return `${Date.now()}-${Math.floor(10000 * Math.random())}`;
}
