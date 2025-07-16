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

import type { ChatWithIncomingCall, ChatRoute, ChatsRoute, ChatWithFwdMsgRef } from "@main/router";
import { useRoute, useRouter } from "vue-router";
import { ChatIdObj, ChatMessageId } from "~/asmail-msgs.types";

export function useRouting(router = useRouter(), route = useRoute()) {

  function goToChatRoute(chatIdObj: ChatIdObj, opts?: {
    forwardedMsg?: ChatMessageId
    callingPeer?: string;
  }) {
    const r: ChatRoute = {
      name: 'chat',
      params: {
        chatType: (chatIdObj.isGroupChat ? 'g' : 's'),
        chatId: chatIdObj.chatId
      }
    };
    if (opts?.forwardedMsg) {
      const { chatId: fwdChat, chatMessageId: fwdMsgId } = opts.forwardedMsg;
      (r as ChatWithFwdMsgRef).query = {
        fwdMsg: 'yes',
        fwdMsgChatType: (fwdChat.isGroupChat ? 'g' : 's'),
        fwdMsgChatId: fwdChat.chatId,
        fwdMsgId
      };
    } else if (opts?.callingPeer) {
      (r as ChatWithIncomingCall).query = {
        call: 'yes',
        peerAddress: opts.callingPeer
      };
    }
    return router.push(r);
  }

  function goToChatsRoute(opts?: { createNew?: boolean; }) {
    const r: ChatsRoute = {
      name: 'chats'
    };
    if (opts?.createNew) {
      r.query = {
        createNewChat: 'yes'
      };
    }
    return router.push(r);
  }

  function getChatIdFromRoute(
    params?: ChatRoute['params']
  ): ChatIdObj|undefined {
    const { chatType, chatId } = params ?? route.params as ChatRoute['params'];
    if (!chatType || !chatId) {
      return;
    }
    const chatIdObj: ChatIdObj = {
      isGroupChat: (chatType === 'g'),
      chatId
    };
    return chatIdObj;
  }

  function getIncomingCallParamsFromRoute(
    route: ChatWithIncomingCall
  ): { chatId: ChatIdObj, peerAddress: string } | undefined {
    if (route.query.call !== 'yes') {
      return;
    }
    return {
      chatId: getChatIdFromRoute(route.params)!,
      peerAddress: route.query.peerAddress
    };
  }

  function getForwardedMsgIdFromRoute(
    query?: ChatWithFwdMsgRef['query']
  ): ChatMessageId|undefined {
    const {
      fwdMsg, fwdMsgChatId: chatId, fwdMsgChatType, fwdMsgId: chatMessageId
    } = query ?? route.query as ChatWithFwdMsgRef['query'];
    if (!fwdMsg) {
      return;
    }
    const msgId: ChatMessageId = {
      chatId: {
        isGroupChat: (fwdMsgChatType === 'g'),
        chatId
      },
      chatMessageId
    };
    return msgId;
  }

  function hasCreateNewChatFlagInRoute(query?: ChatsRoute['query']): boolean {
    const {
      createNewChat
    } = query ?? route.query as NonNullable<ChatsRoute['query']>;
    return (createNewChat === 'yes');
  }

  return {
    getChatIdFromRoute,
    getForwardedMsgIdFromRoute,
    hasCreateNewChatFlagInRoute,
    getIncomingCallParamsFromRoute,

    goToChatsRoute,
    goToChatRoute
  };
}