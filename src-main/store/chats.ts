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
import { Nullable } from '@v1nt1248/3nclient-lib';
import { IncomingCallCmdArg } from '~/chat-commands.types';
import { getChatName } from '@main/helpers/chat-ui.helper';
import { appChatsSrvProxy, appDeliverySrvProxy } from '@main/services/services-provider';

export interface ChatsStoreState {
  chatList: Record<string, ChatListItemView>;
  currentChatId: Nullable<string>;
  currentChatMessages: ChatMessageView<MessageType>[];
  newChatDialogFlag: boolean;
  incomingCalls: IncomingCallCmdArg[];
}

export const useChatsStore = defineStore('chats', {

  state: () => ({
    chatList: {},
    currentChatId: null,
    currentChatMessages: [],
    newChatDialogFlag: false,
    incomingCalls: [],
  } as ChatsStoreState),

  getters: {
  
    currentChat: state => {
        if (state.currentChatId) {
          const chat = state.chatList[state.currentChatId];
          return (chat ? chat : null);
        }
        return null;
    },

    namedChatList: state => {
      return Object.values(state.chatList)
      .map(c => ({
        ...c,
        displayName: getChatName(c),
      }))
      .sort((a, b) => {
        const tA = a.timestamp || a.createdAt;
        const tB = b.timestamp || b.createdAt;
        return tB - tA;
      });
    },

  },

  actions: {

    clearIncomingCallsData() {
      this.incomingCalls = [];
    },

    getMessage(msgId: string) {
      return appDeliverySrvProxy.getMessage(msgId);
    },

    async getChatMessage(
      { msgId, chatMessageId }: { msgId?: string, chatMessageId?: string },
    ): Promise<ChatMessageView<MessageType> | null> {
      if (chatMessageId) {
        return appChatsSrvProxy.getMessage({ chatMsgId: chatMessageId });
      }
    
      if (msgId) {
        return appChatsSrvProxy.getMessage({ msgId });
      }
    
      return null;
    },

    async fetchChat(chatId: string | null) {
      await this.fetchChatList();
      if (!chatId) {
        this.currentChatId = null;
        this.currentChatMessages = [];
      } else {
        this.currentChatId = chatId;
        this.currentChatMessages = (this.currentChat ?
          await appChatsSrvProxy.getMessagesByChat(chatId) :
          []
        );
      }
    },

    async fetchChatList() {
      const res = await appChatsSrvProxy.getChatList();
      const unreadMessagesCount = await appChatsSrvProxy.getChatsUnreadMessagesCount();
    
      this.chatList = res.reduce((r, item) => {
        r[item.chatId] = {
          ...item,
          unread: unreadMessagesCount[item.chatId] || 0,
        };
        return r;
      }, {} as Record<string, ChatView & { unread: number } & ChatMessageView<MessageType>>);
    },

    setChatDialogFlag(value: boolean) {
      this.newChatDialogFlag = value;
    },

    setIncomingCallsData(cmd: IncomingCallCmdArg) {
      this.incomingCalls.push(cmd);
    },

  }

});

export type ChatsStore = ReturnType<typeof useChatsStore>;
