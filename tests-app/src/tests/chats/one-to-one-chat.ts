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

import { DbRecordException } from "@bg/utils/exceptions";
import { ChatStore, useChatStore } from "@main/store/chat.store";
import { ChatCreationException, ChatsStore, useChatsStore } from "@main/store/chats.store";
import { areAddressesEqual } from "@tests/lib-common/address-utils";
import { itCond } from "@tests/libs-for-tests/jasmine-utils";
import { TestSetupContainer } from "@tests/setups";
import { storeToRefs } from "pinia";
import { findOrCreateOneToOneChatWith, removeAllChats, waitEventFromChatService } from "../utils";
import { ChatAddedEvent, ChatRemovedEvent } from "~/services.types";
import { SingleChatView } from "~/chat.types";
import { sleep } from "@tests/lib-common/processes/sleep";
import { deepEqual } from "@tests/libs-for-tests/json-equal";

export function oneToOneChatRoomSpec() {

  let chatsStore: ChatsStore;
  let chatStore: ChatStore;
  let fstUserAddr: string;
  let sndUserAddr: string;
  let fstUserName: string;
  let sndUserName: string;

  beforeAll(async () => {
    ({
      fstUserAddr, sndUserAddr, sndUserName, fstUserName
    } = (window as any as TestSetupContainer).testSetup);
    chatsStore = useChatsStore();
    chatStore = useChatStore();
    await chatsStore.refreshChatList();
    await removeAllChats(chatsStore, chatStore);
  }, 15000);

  afterAll(async () => {
    await removeAllChats(chatsStore, chatStore);
    // XXX should may be send signal to other user(s) to clean up, if needed
  }, 15000);

  itCond(`creating chat room for existing user`, async () => {
    // creating chat
    const { createNewOneToOneChat } = chatsStore;
    const { chatListSortedByTime: chatList } = storeToRefs(chatsStore);
    
    const chatAddition = waitEventFromChatService('chat', 'added');
    const chatUpdated = waitEventFromChatService('chat', 'updated');
    const fstChatId = await createNewOneToOneChat(
      sndUserName, sndUserAddr, fstUserName
    );
    const { chat: chatInEvent } = (await chatAddition) as ChatAddedEvent;
    expect(fstChatId.isGroupChat).toBeFalse();
    expect(chatInEvent.name).toBe(sndUserName);
    expect((chatInEvent as SingleChatView).peerAddr).toBe(sndUserAddr);
    expect(chatInEvent.status).toBe('initiated');
    expect(chatList.value.find(c => (c.chatId === chatInEvent.chatId)))
    .withContext(`chat info was added`).toBeDefined();

    // try to create same chat
    await createNewOneToOneChat(
      sndUserName+' new name', sndUserAddr, fstUserName
    ).then(
      () => fail(`expected db exception on existing chat`),
      (exc: DbRecordException) => {
        expect(exc.chatAlreadyExists).toBeTrue();
      }
    );

    // try to create same chat, with differently formatted member's address
    const differentlyFormattedAddr = sndUserAddr.slice(0,3) + `   ` + sndUserAddr.slice(3);
    expect(areAddressesEqual(differentlyFormattedAddr, sndUserAddr)).toBeTrue();
    await createNewOneToOneChat(
      `Different ${sndUserName} format`, differentlyFormattedAddr, fstUserName
    ).then(
      () => fail(`expected db exception on existing chat`),
      (exc: DbRecordException) => {
        expect(exc.chatAlreadyExists).toBeTrue();
      }
    );

    const { chat: updatedChat } = (await chatUpdated) as ChatAddedEvent;
    expect(updatedChat.name).toBe(chatInEvent.name);
  }, 20000);

  itCond(`creating chat room for non-existing address fails existence check`, async () => {
    const { createNewOneToOneChat } = chatsStore;
    const nonexistingAddr = `non-existing user @example.com`;

    await createNewOneToOneChat(`Non Existing`, nonexistingAddr)
    .then(
      () => fail(`creation of chat for non-existing user should fail`),
      (exc: ChatCreationException) => {
        expect(exc.runtimeException).toBe(true);
        expect(exc.type).toBe('chat-creation');
      }
    );
  });

  itCond(`deleting non-existing chat fails existence check`, async () => {
    const { deleteChat } = chatStore;
    const nonexistingAddr = `non-existinguser@example.com`;

    await deleteChat({ isGroupChat: false, chatId: nonexistingAddr })
    .then(
      () => fail(`deleting non-existing chat should fail`),
      (exc: DbRecordException) => {
        expect(exc).toBeDefined()
      }
    );
  });

  itCond(`deleting chat`, async () => {
    const chatId = await findOrCreateOneToOneChatWith(
      sndUserName+` at ${Date.now()}`, sndUserAddr, chatsStore, fstUserAddr
    );
    const { setChatAndFetchMessages, deleteChat } = chatStore;
    await setChatAndFetchMessages(chatId);
    expect(chatStore.currentChat?.chatId)
    .withContext(`test setup`).toBe(chatId.chatId);

    const chatRemoval = waitEventFromChatService('chat', 'removed');
    await deleteChat(chatId);
    const { chatId: idOfRemoved } = (await chatRemoval) as ChatRemovedEvent;
    expect(deepEqual(idOfRemoved, chatId)).toBeTrue();

    await sleep(2000);  // give other side to process removals
  }, 10000);

}