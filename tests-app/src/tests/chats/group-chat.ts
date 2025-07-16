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

import { fitCond, itCond } from "@tests/libs-for-tests/jasmine-utils";
import { ChatCreationException, ChatsStore, useChatsStore } from "@main/store/chats.store";
import { TestSetupContainer } from "@tests/setups";
import { ChatException, ChatStore, useChatStore } from "@main/store/chat.store";
import { removeAllChats, waitEventFromChatService } from "../utils";
import { ChatAddedEvent, ChatUpdatedEvent } from "~/services.types";
import { areChatIdsEqual } from "@shared/chat-ids";
import { GroupChatView } from "~/chat.types";
import { includesAddress } from "@shared/address-utils";

export function groupChatRoomSpec() {

  let chatsStore: ChatsStore;
  let chatStore: ChatStore;
  let fstUserAddr: string;
  let sndUserAddr: string;
  let thirdUserAddr: string;
  let fstUserName: string;
  let sndUserName: string;
  let thirdUserName: string;

  beforeAll(async () => {
    ({
      fstUserAddr, sndUserAddr, sndUserName, fstUserName,
      thirdUserAddr, thirdUserName
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

  itCond(`creating chat room for non-existing address fails existence check`, async () => {
    const { createNewGroupChat } = chatsStore;
    const nonexistingAddr = `non-existing user @example.com`;
    await createNewGroupChat(`Non Existing`, [ nonexistingAddr ])
    .then(
      () => fail(`creation of chat for non-existing user should fail`),
      (exc: ChatCreationException) => {
        expect(exc.runtimeException).toBeTrue();
        expect(exc.type).toBe('chat-creation');
      }
    );
  });

  itCond(`new chat may have zero peers intially, updating them later`, async () => {
    // chat creation
    const { createNewGroupChat } = chatsStore;

    const chatAddition = waitEventFromChatService('chat', 'added');
    const chatName = ` ${Date.now()}`;
    const chatObjId = await createNewGroupChat(chatName, []);
    expect(chatObjId.isGroupChat).toBeTrue();
    expect(typeof chatObjId.chatId).toBe('string');
    let chatInEvent = ((await chatAddition) as ChatAddedEvent).chat;
    if (!chatInEvent.isGroupChat) {
      fail(`Expected group chat object`);
      return;
    }
    expect(areChatIdsEqual(chatInEvent, chatObjId)).toBeTrue();
    expect(chatInEvent.name).toBe(chatName);
    expect(chatInEvent.members.length).toBe(1);
    expect(includesAddress(chatInEvent.members, fstUserAddr));

    // adding users afterwards
    const { updateGroupMembers, setChatAndFetchMessages } = chatStore;
    await setChatAndFetchMessages(chatInEvent);

    // update can't exclude self
    await updateGroupMembers(chatInEvent.chatId, [
      sndUserAddr, thirdUserAddr
    ])
    .then(
      () => fail(`method to update members can't remove user itself`),
      err => {
        expect(err).toBeDefined();
        console.error(err);
      }
    );

    // try to add non-existing peer
    const nonexistingAddr = `non-existing user @example.com`;
    await updateGroupMembers(chatInEvent.chatId, [
      fstUserAddr, nonexistingAddr
    ])
    .then(
      () => fail(`adding non-existing address should fail`),
      (exc: ChatException) => {
        expect(exc.runtimeException).toBeTrue();
        expect(exc.failedAddresses).toBeTruthy();
        if (exc.failedAddresses) {
          expect(exc.failedAddresses[0].addr).toBe(nonexistingAddr);
        }
      }
    );

    // adding peers
    let chatUpdate = waitEventFromChatService('chat', 'updated');
    let membersToSet = [
      fstUserAddr, sndUserAddr, thirdUserAddr
    ];
    await updateGroupMembers(chatInEvent.chatId, membersToSet);
    chatInEvent = ((await chatUpdate) as ChatUpdatedEvent).chat;
    if (!chatInEvent.isGroupChat) {
      fail(`Expected group chat object`);
      return;
    }
    expect(chatInEvent.members.length).toBe(3);
    for (let addr of membersToSet) {
      expect(includesAddress(chatInEvent.members, addr)).toBeTrue();
    }

  }, 15000);

}
