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

import { chatService } from "@main/store/external-services";
import { ChatStore } from "@main/store/chat.store";
import { ChatsStore } from "@main/store/chats.store";
import { includesAddress, toCanonicalAddress } from "@shared/address-utils";
import { sleep } from "@shared/processes/sleep";
import { storeToRefs } from "pinia";
import { ChatIdObj } from '~/asmail-msgs.types';
import { ChatEvent, ChatMessageEvent, ChatUpdatedEvent, UpdateEvent } from "~/services.types";

export async function findOrCreateOneToOneChatWith(
  name: string, addr: string, chatsStore: ChatsStore, thisUserName: string
): Promise<ChatIdObj> {
  const cAddr = toCanonicalAddress(addr);
  const chatsWithSndUser = chatsStore.chatListSortedByTime.filter(c => {
    if (c.isGroupChat) {
      return includesAddress(c.members, cAddr);
    } else {
      return (c.chatId === cAddr);
    }
  })
  if (chatsWithSndUser.length > 0) {
    const { isGroupChat, chatId } = chatsWithSndUser[0]
    return { isGroupChat, chatId };
  }

  const chatAcceptance = waitEventFromChatService(
    'chat', 'updated',
    ev => ((ev as ChatUpdatedEvent).chat.chatId === cAddr)
  );
  const chatId = await chatsStore.createNewOneToOneChat(
    name, addr, thisUserName
  );
  await chatAcceptance;
  return chatId;
}

export async function waitEventFromChatService(
  entity: 'chat', event: UpdateEvent['event'],
  filter?: (ev: ChatEvent) => boolean,
  sleepMillisAfterEvent?: number
): Promise<ChatEvent>;
export async function waitEventFromChatService(
  entity: 'message', event: UpdateEvent['event'],
  filter?: (ev: ChatMessageEvent) => boolean,
  sleepMillisAfterEvent?: number
): Promise<ChatMessageEvent>;
export async function waitEventFromChatService(
  entity: UpdateEvent['updatedEntityType'],
  event: UpdateEvent['event'],
  filter?: Function,
  sleepMillisAfterEvent = 20
): Promise<UpdateEvent> {
  const events = await waitForEventsFromChatService(entity, event, 1, filter);
  await sleep(sleepMillisAfterEvent);
  return events[0];
}

export function waitForEventsFromChatService(
  entity: 'chat', event: UpdateEvent['event'], count: number,
  filter?: (ev: ChatEvent) => boolean
): Promise<ChatEvent[]>;
export function waitForEventsFromChatService(
  entity: 'message', event: UpdateEvent['event'], count: number,
  filter?: (ev: ChatMessageEvent) => boolean
): Promise<ChatMessageEvent[]>;
export function waitForEventsFromChatService(
  entity: UpdateEvent['updatedEntityType'],
  event: UpdateEvent['event'],
  count: number,
  filter?: Function
): Promise<UpdateEvent[]>
export function waitForEventsFromChatService(
  entity: UpdateEvent['updatedEntityType'],
  event: UpdateEvent['event'],
  count: number,
  filter?: Function
): Promise<UpdateEvent[]> {
  if (!Number.isInteger(count) || (count < 1)) {
    throw new Error(`Event count must be an integer equal or greater than one`);
  }
  const events: UpdateEvent[] = [];
  return (new Promise((resolve, reject) => {
    const stop = chatService.watch({
      next: ev => {
        if ((ev.updatedEntityType === entity) && (ev.event === event)) {
          if (filter && !filter(ev) || (events.length >= count)) {
            return;
          }
          events.push(ev);
          if (events.length >= count) {
            resolve(events);
            stop();
          }
        }
      },
      error: reject,
      complete: () => reject(new Error(`Early completion of watching`))
    });
  }));
}

export async function removeAllChats(
  chatsStore: ChatsStore, chatStore: ChatStore
): Promise< void> {
  const { chatListSortedByTime } = storeToRefs(chatsStore);
  const { deleteChat, setChatAndFetchMessages } = chatStore;
  if (chatListSortedByTime.value.length === 0) {
    return;
  }
  for (const chat of chatListSortedByTime.value) {
    const { isGroupChat, chatId } = chat;
    const id = { isGroupChat, chatId };
    await setChatAndFetchMessages(id);
    await deleteChat(id);
  }
  await sleep(5000);  // give other side to process removals
}

export async function createGroupChatWith(
  name: string, chatsStore: ChatsStore, groupPeers: string[]
): Promise<ChatIdObj> {

  // XXX 

  const chatAcceptance = waitForEventsFromChatService(
    'chat', 'updated', 2,
    ev => ((ev as ChatUpdatedEvent).chat.chatId === chatId.chatId)
  );
  const chatId = await chatsStore.createNewGroupChat(name, groupPeers);
  await chatAcceptance;

  // XXX

  await sleep(5000);

  return chatId;
}
