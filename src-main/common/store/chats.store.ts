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
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useRoute, useRouter } from 'vue-router';
import cloneDeep from 'lodash/cloneDeep';
import { useAppStore } from '@main/common/store/app.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import { useUiIncomingStore } from '@main/common/store/ui.incoming.store';
import type {
  ChatIdObj,
  ChatMessageId,
  ChatListItemView,
  IncomingCallCmdArg,
  AddressCheckResult,
  ChatEvent,
  ChatWebRTCCallEvent,
} from '~/index';
import { getChatName } from '@main/common/utils/chat-ui.helper';
import { chatService } from '@main/common/services/external-services';
import { areChatIdsEqual, generateChatMessageId } from '@shared/chat-ids';
import { randomStr } from '@shared/randomStr';

export type ChatsStore = ReturnType<typeof useChatsStore>;

export interface ChatCreationException extends web3n.RuntimeException {
  type: 'chat-creation';
  failedAddresses: {
    addr: string;
    check?: AddressCheckResult;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    exc?: any;
  }[];
}

export const useChatsStore = defineStore('chats', () => {
  const route = useRoute();
  const router = useRouter();

  const appStore = useAppStore();
  const messagesStore = useMessagesStore();
  const uiIncomingStore = useUiIncomingStore();

  const chatList = ref<ChatListItemView[]>([]);
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
    }),
  );

  function getChatView(chatId: ChatIdObj): ChatListItemView | undefined {
    return chatList.value.find(cv => areChatIdsEqual(cv, chatId));
  }

  async function refreshChatViewData(chatId: ChatIdObj) {
    const chatViewData = await chatService.getChat(chatId);

    if (chatViewData) {
      const ind = findIndexOfChatInCurrentList(chatViewData);
      if (ind >= 0) {
        const callStart = chatList.value[ind].callStart;
        const incomingCall = chatList.value[ind].incomingCall;

        chatList.value[ind] = {
          ...chatViewData,
          callStart,
          incomingCall,
        };
      }
    }
  }

  function clearIncomingCallsData() {
    incomingCalls.value = [];
  }

  async function createNewOneToOneChat(
    name: string,
    peerAddr: string,
    ownName?: string,
  ): Promise<ChatIdObj | undefined> {
    try {
      return await chatService.createOneToOneChat({ name, peerAddr, ownName });
    } catch (error: unknown) {
      // TODO Maybe it should show a notification about this.
      w3n.log('error', 'Error creating a one to one chat. ', error);
    }
  }

  async function createNewGroupChat(
    name: string,
    groupMembers: Record<string, { hasAccepted: boolean }>,
  ): Promise<ChatIdObj | undefined> {
    try {
      return await chatService.createGroupChat({
        name,
        chatId: randomStr(20),
        members: groupMembers,
      });
    } catch (error: unknown) {
      // TODO Maybe it should show a notification about this.
      w3n.log('error', 'Error creating a group chat. ', error);
    }
  }

  async function acceptChatInvitation({ chatId, chatMessageId }: ChatMessageId, ownName?: string): Promise<void> {
    try {
      if (!ownName) {
        ownName = appStore.user.substring(0, appStore.user.indexOf('@'));
      }
      return await chatService.acceptChatInvitation(chatId, chatMessageId, ownName);
    } catch (err) {
      console.error(`Accepting chat invite failed with`, err);
      throw err;
    }
  }

  async function refreshChatList() {
    chatList.value = await chatService.getChatList();
    resetRouteIfItPointsToRemovedChat();
  }

  function resetRouteIfItPointsToRemovedChat(): void {
    const { chatId } = route.params as { chatId: string };
    if (chatId) {
      const foundChat = chatList.value.find(c => (c.chatId === chatId));
      if (!foundChat) {
        router.push({ name: 'chats' });
      }
    }
  }

  function findIndexOfChatInCurrentList(chatId: ChatIdObj): number {
    return chatList.value.findIndex(
      c => areChatIdsEqual(c, chatId),
    );
  }

  async function updateChatItemInList(chatId: ChatIdObj, value: Partial<ChatListItemView>) {
    let chatInd = findIndexOfChatInCurrentList(chatId);
    if (chatInd < 0) {
      await refreshChatList();
      chatInd = findIndexOfChatInCurrentList(chatId);
      if (chatInd < 0) {
        console.error(`The chat with chatId ${chatId.chatId} does not exist`);
        return;
      }
    }

    const currentValue: ChatListItemView = cloneDeep(chatList.value[chatInd]);
    // @ts-expect-error
    chatList.value[chatInd] = {
      ...currentValue,
      ...value,
    };
  }

  async function handleBackgroundChatEvents(event: ChatEvent): Promise<void> {
    switch (event.event) {
      case 'updated': {
        const { chat } = event;
        const chatInd = findIndexOfChatInCurrentList(chat);
        if (chatInd < 0) {
          await refreshChatList();
        } else {
          const callStart = chatList.value[chatInd].callStart;
          const incomingCall = chatList.value[chatInd].incomingCall;

          chatList.value[chatInd] = {
            ...chat,
            callStart,
            incomingCall,
          };
        }
        break;
      }

      case 'added': {
        const { chat } = event;
        const chatInd = findIndexOfChatInCurrentList(chat);
        if (chatInd < 0) {
          chatList.value.unshift(chat);
        } else {
          await refreshChatList();
        }
        break;
      }

      case 'removed': {
        const { chatId } = event;
        const chatInd = findIndexOfChatInCurrentList(chatId);
        if (chatInd >= 0) {
          chatList.value.splice(chatInd, 1);
        }
        resetRouteIfItPointsToRemovedChat();
        break;
      }

      case 'webRTCCall': {
        const { value } = event as ChatWebRTCCallEvent;
        const { data } = value || {};
        const { chatId, sender, subType } = data || {};
        if (!chatId) {
          return;
        }

        const chatInd = findIndexOfChatInCurrentList(chatId);
        if (chatInd === -1) {
          return;
        }

        const chat = chatList.value[chatInd];
        const { isGroupChat, callStart, incomingCall } = chat;
        if (!callStart && !incomingCall) {
          return;
        }

        if (incomingCall && subType === 'outgoing-call-cancelled') {
          const { chatMessageId, timestamp } = generateChatMessageId();
          const systemMsg = await chatService.makeAndSaveMsgToDb(appStore.user, {
              chatMessageType: 'system',
              isIncomingMsg: true,
              groupChatId: isGroupChat ? chat.chatId : null,
              otoPeerCAddr: isGroupChat ? null : chat.chatId,
              groupSender: isGroupChat ? sender : null,
              chatMessageId,
              timestamp,
              body: JSON.stringify({
                event: 'webrtc-call',
                value: {
                  sender,
                  subType,
                  chatId,
                },
              }),
            },
          );
          await uiIncomingStore.dismissIncomingCall(chatId, true);
          await messagesStore.handleAddedMsg(systemMsg);
          return;
        }

        if (subType === 'incoming-call-cancelled') {
          const { chatMessageId, timestamp } = generateChatMessageId();
          const systemMsg = await chatService.makeAndSaveMsgToDb(
            appStore.user,
            {
              chatMessageType: 'system',
              isIncomingMsg: true,
              groupChatId: isGroupChat ? chat.chatId : null,
              otoPeerCAddr: isGroupChat ? null : chat.chatId,
              groupSender: isGroupChat ? sender : null,
              chatMessageId,
              timestamp,
              body: JSON.stringify({
                event: 'webrtc-call',
                value: {
                  sender,
                  subType,
                  chatId,
                },
              }),
            },
          );

          !isGroupChat && await uiIncomingStore.endCall(chatId);
          await messagesStore.handleAddedMsg(systemMsg);
        }

        break;
      }

      default:
        throw Error(`Unknown chat event: ${event.event}`);
    }
  }

  function setIncomingCallsData(cmd: IncomingCallCmdArg) {
    incomingCalls.value.push(cmd);
  }

  return {
    chatList,
    chatListSortedByTime,
    refreshChatList,
    findIndexOfChatInCurrentList,
    getChatView,
    refreshChatViewData,
    handleBackgroundChatEvents,
    createNewOneToOneChat,
    createNewGroupChat,
    acceptChatInvitation,
    updateChatItemInList,
    clearIncomingCallsData,
    setIncomingCallsData,
  };
});
