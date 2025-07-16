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

import { defineStore } from 'pinia';
import { ChatIdObj, ChatMessageId } from '~/asmail-msgs.types';
import { ChatListItemView } from '~/chat.types';
import { IncomingCallCmdArg } from '~/chat-commands.types';
import { getChatName } from '@main/utils/chat-ui.helper';
import { chatService } from '@main/store/external-services';
import { includesAddress, toCanonicalAddress } from '@shared/address-utils';
import { computed, ref } from 'vue';
import { ChatStore, useChatStore } from './chat.store';
import { AddressCheckResult, ChatEvent, UpdateEvent } from '~/services.types';
import { areChatIdsEqual } from '@shared/chat-ids';
import { randomStr } from '@shared/randomStr';
import { SingleProc } from '@shared/processes/single';
import { useRouting } from '@main/composables/useRouting';
import { setTemplateIteratorKeyIn } from '@main/utils/template-iterator-keys';

export const useChatsStore = defineStore('chats', () => {

  const { getChatIdFromRoute, goToChatsRoute } = useRouting();

  const chatList = ref<ChatListItemView[]>([]);
  const newChatDialogFlag = ref(false);
  const incomingCalls = ref<IncomingCallCmdArg[]>([]);

  const chatListSortedByTime = computed(() => chatList.value
    .map(c => ({
      ...c,
      displayName: getChatName(c),
    }))
    .sort((a, b) => {
      const tA = a.lastMsg?.timestamp || a.createdAt;
      const tB = b.lastMsg?.timestamp || b.createdAt;
      return tB - tA;
    })
  );

  function getChatView(chatId: ChatIdObj): ChatListItemView|undefined {
    return chatList.value.find(cv => areChatIdsEqual(cv, chatId));
  }

  function clearIncomingCallsData() {
    incomingCalls.value = [];
  }

  let ownCAddr: string;
  let ownAddr: string;

  async function createNewOneToOneChat(
    name: string, peerAddr: string, ownName?: string
  ): Promise<ChatIdObj> {
    await ensureAllAddressesExist([ peerAddr ]);
    if (!ownName) {
      ownName = ownAddr.substring(0, ownAddr.indexOf('@'));
    }
    return await chatService.createOneToOneChat({ name, peerAddr, ownName });
  }

  async function createNewGroupChat(
    name: string, groupMembers: string[]
  ): Promise<ChatIdObj> {
    if (!includesAddress(groupMembers, ownAddr)) {
      groupMembers = groupMembers.concat(ownAddr);
    }
    await ensureAllAddressesExist(groupMembers.filter(
      member => (toCanonicalAddress(member) !== ownCAddr)
    ));
    return await chatService.createGroupChat({
      name,
      chatId: randomStr(20),
      members: groupMembers,
      admins: [ ownAddr ]
    });
  }

  async function ensureAllAddressesExist(members: string[]): Promise<void> {
    const checks = await Promise.all(members.map(async addr => {
      const {
        check, exc
      } = await chatService.checkAddressExistenceForASMail(addr).then(
        check => ({ check, exc: undefined }),
        exc => ({ check: undefined, exc })
      );
      return { addr, check, exc }
    }));
    const failedAddresses = checks.filter(({ check }) => (check !== 'found'));
    if (failedAddresses.length > 0) {
      throw makeChatCreationException(failedAddresses);
    }
  }

  async function acceptChatInvitation(
    { chatId, chatMessageId }: ChatMessageId, ownName?: string
  ): Promise<void> {
    try {
      if (!ownName) {
        ownName = ownAddr.substring(0, ownAddr.indexOf('@'));
      }
      return await chatService.acceptChatInvitation(
        chatId, chatMessageId, ownName
      );
    } catch (err) {
      console.error(`Accepting chat invite failed with`, err);
      throw err;
    }
  }

  async function refreshChatList() {
    const lst = await chatService.getChatList();
    for (const item of lst) {
      const initItem = chatList.value.find(c => (item.chatId === c.chatId));
      setTemplateIteratorKeyIn(item, initItem ?? item.chatId);
    }
    chatList.value = lst;
    resetRouteIfItPointsToRemovedChat();
  }

  function resetRouteIfItPointsToRemovedChat(): void {
    const chatInRoute = getChatIdFromRoute();
    if (chatInRoute) {
      const foundChat = chatList.value.find(
        c => (c.chatId === chatInRoute.chatId)
      );
      if (!foundChat) {
        goToChatsRoute();
      }
    }
  }

  function findIndexOfChatInCurrentList(chatId: ChatIdObj): number {
    return chatList.value.findIndex(
      c => areChatIdsEqual(c, chatId)
    );
  }

  const updatesQueue: UpdateEvent[] = [];
  const updatesProc = new SingleProc();

  async function processQueuedUpdateEvents(): Promise<void> {
    while (updatesQueue.length > 0) {
      const event = updatesQueue.pop()!;
      try {
        if (event.updatedEntityType === 'chat') {
          await absorbChatUpdateEvent(event);
        } else if (event.updatedEntityType === 'message') {
          await absorbMessageUpdateEvent(event);
        } else {
          console.log(`Unknown update event from ChatService:`, event);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  async function absorbChatUpdateEvent(event: ChatEvent): Promise<void> {
    if (event.event === 'updated') {
      const { chat } = event;
      const chatInd = findIndexOfChatInCurrentList(chat);
      if (chatInd < 0) {
        await refreshChatList();
      } else {
        setTemplateIteratorKeyIn(chat, chatList.value[chatInd]);
        chatList.value[chatInd] = chat;
      }
    } else if (event.event === 'added') {
      const { chat } = event;
      const chatInd = findIndexOfChatInCurrentList(chat);
      if (chatInd < 0) {
        setTemplateIteratorKeyIn(chat, chat.chatId);
        chatList.value.unshift(chat);
      } else {
        await refreshChatList();
      }
    } else if (event.event === 'removed') {
      const { chatId } = event;
      const chatInd = findIndexOfChatInCurrentList(chatId);
      if (chatInd >= 0) {
        chatList.value.splice(chatInd, 1);
      }
      resetRouteIfItPointsToRemovedChat();
    }
  }

  function setChatDialogFlag(value: boolean) {
    newChatDialogFlag.value = value;
  }

  function setIncomingCallsData(cmd: IncomingCallCmdArg) {
    incomingCalls.value.push(cmd);
  }

  let absorbMessageUpdateEvent: ChatStore['absorbMessageUpdateEvent'];
  let stopMessagesProcessing: (() => void)|undefined = undefined;

  async function initialize(userOwnAddr: string) {
    ownAddr = userOwnAddr;
    ownCAddr = toCanonicalAddress(ownAddr);
    const chatStore = useChatStore();
    chatStore.initialize(userOwnAddr);
    absorbMessageUpdateEvent = chatStore.absorbMessageUpdateEvent;
    stopMessagesProcessing = chatService.watch({
      next: updateEvent => {
        updatesQueue.push(updateEvent);
        if (!updatesProc.getP()) {
          updatesProc.start(processQueuedUpdateEvents);
        }
      },
      complete: () => console.log(`Observation of updates events from ChatService completed.`),
      error: err => console.error(`Error occured in observation of updates events from ChatService:`, err)
    });
    await refreshChatList();
  }

  function stopWatching() {
    stopMessagesProcessing?.();
  }

  return {
    chatListSortedByTime,

    getChatView,

    clearIncomingCallsData,
    setIncomingCallsData,

    createNewOneToOneChat,
    createNewGroupChat,
    acceptChatInvitation,

    refreshChatList,
    setChatDialogFlag,

    initialize,
    stopWatching
  };
});

export type ChatsStore = ReturnType<typeof useChatsStore>;

export interface ChatCreationException extends web3n.RuntimeException {
  type: 'chat-creation';
  failedAddresses: {
    addr: string;
    check?: AddressCheckResult;
    exc?: any;
  }[];
}

function makeChatCreationException(
  failedAddresses: ChatCreationException['failedAddresses']
): ChatCreationException {
  return {
    runtimeException: true,
    type: 'chat-creation',
    failedAddresses
  };
}
