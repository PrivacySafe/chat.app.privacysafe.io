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
import { ChatListItemView, ChatMessageView, ChatView, MessageType } from '~/chat.types';
import { IncomingCallCmdArg } from '~/chat-commands.types';
import { getChatName } from '@main/utils/chat-ui.helper';
import { appChatsSrv, appDeliverySrv } from '@main/services/services-provider';
import { includesAddress, toCanonicalAddress } from '@shared/address-utils';
import { computed, ref } from 'vue';
import { toRO } from '@main/utils/readonly';
import { handleUpdateMessageStatus, startMessagesProcessing } from './chats/messages-processing';
import { SystemMessageHandlerParams } from '~/app.types';
import { ChatStore, useChatStore } from './chat.store';
import { AddressCheckResult } from '~/services.types';

export const useChatsStore = defineStore('chats', () => {

  const chatList = ref<Record<string, ChatListItemView>>({});
  const newChatDialogFlag = ref(false);
  const incomingCalls = ref<IncomingCallCmdArg[]>([]);

  const namedChatList = computed(() => Object.values(chatList.value)
    .map(c => ({
      ...c,
      displayName: getChatName(c),
    }))
    .sort((a, b) => {
      const tA = a.timestamp || a.createdAt;
      const tB = b.timestamp || b.createdAt;
      return tB - tA;
    })
  );

  function clearIncomingCallsData() {
    incomingCalls.value = [];
  }

  function getMessage(msgId: string) {
    return appDeliverySrv.getMessage(msgId);
  }

  function getChatsWith(member: string) {
    return Object.values(chatList.value)
    .filter(({ members }) => includesAddress(members, member))
    .map(({ chatId }) => chatId);
  }

  async function getChatMessage(
    { msgId, chatMessageId }: { msgId?: string, chatMessageId?: string },
  ): Promise<ChatMessageView<MessageType> | null> {
    if (chatMessageId) {
      return appChatsSrv.getMessage({ chatMsgId: chatMessageId });
    }
  
    if (msgId) {
      return appChatsSrv.getMessage({ msgId });
    }
  
    return null;
  }

  let ownCAddr: string;

  async function createChat(
    { chatId, members, admins, name = '' }: {
      chatId?: string, members: string[], admins: string[], name?: string
    }
  ): Promise<string> {
    await ensureAllAddressesExist(members.filter(
      member => (toCanonicalAddress(member) !== ownCAddr)
    ));
    let newChatId = '';
    try {
      newChatId = await appChatsSrv.createChat({
        chatId, members, admins, name
      });
      await fetchChatList();
    } catch (e) {
      console.error('CREATE CHAT ERROR: ', e);
    }
    return newChatId;
  }

  async function ensureAllAddressesExist(members: string[]): Promise<void> {
    const checks = await Promise.all(members.map(async addr => {
      const {
        check, exc
      } = await appDeliverySrv.checkAddressExistenceForASMail(addr).then(
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

  async function fetchChatList() {
    const chatLst = await appChatsSrv.getChatList();
    const unreadMessagesCount = await appChatsSrv.getChatsUnreadMessagesCount();
  
    chatList.value = chatLst.reduce((r, item) => {
      r[item.chatId] = {
        ...item,
        unread: unreadMessagesCount[item.chatId] || 0,
      };
      return r;
    }, {} as Record<string, ChatView & { unread: number } & ChatMessageView<MessageType>>);
  }

  function setChatDialogFlag(value: boolean) {
    newChatDialogFlag.value = value;
  }

  function setIncomingCallsData(cmd: IncomingCallCmdArg) {
    incomingCalls.value.push(cmd);
  }

  let stopMessagesProcessing: (() => void)|undefined = undefined;

  async function initialize(ownAddr: string) {
    ownCAddr = toCanonicalAddress(ownAddr);
    await fetchChatList();
    stopMessagesProcessing = await startMessagesProcessing();
  }

  function stopWatching() {
    stopMessagesProcessing?.();
  }

  let getWritableCurrentChatMessageView: ChatStore['getWritableCurrentChatMessageView']|undefined = undefined;;

  async function updateMessageStatus(
    { msgId, chatMessageId, value }: SystemMessageHandlerParams
  ): Promise<void> {
    if (!getWritableCurrentChatMessageView) {
      ({ getWritableCurrentChatMessageView } = useChatStore());
    }
    await handleUpdateMessageStatus(
      getWritableCurrentChatMessageView,
      { msgId, chatMessageId, value }
    );
  }

  return {
    chatList: toRO(chatList),

    namedChatList,

    clearIncomingCallsData,
    getMessage,
    getChatsWith,
    getChatMessage,
    createChat,
    fetchChatList,
    setChatDialogFlag,
    setIncomingCallsData,
    updateMessageStatus,

    initialize,
    stopWatching
  };
});

export type ChatsStore = ReturnType<typeof useChatsStore>;

export interface ChatCreationException extends web3n.RuntimeException {
  type: 'chat-creation'
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
