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
import { defineStore } from 'pinia';
import cloneDeep from 'lodash/cloneDeep';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { Sound } from '@shared/sounds';
import { chatService, videoOpenerSrv } from '@main/common/services/external-services';
import { useAppStore } from '@main/common/store/app.store';
import { useChatsStore } from '@main/common/store/chats.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import { generateChatMessageId } from '@shared/chat-ids';
import type { ChatIdObj } from '~/asmail-msgs.types';


export const useUiIncomingStore = defineStore('ui-incoming', () => {
  const appStore = useAppStore();
  const chatsStore = useChatsStore();
  const messagesStore = useMessagesStore();

  let ring: Nullable<Sound> = null;

  async function startRinging() {
    const ringFileUrl = new URL('@main/common/assets/sounds/ring_tone.mp3', import.meta.url).href;
    ring = await Sound.from(ringFileUrl);
    ring.playInLoop();
  }

  function stopRinging() {
    if (ring) {
      ring.stop();
      ring = null;
    }
  }

  async function toggleRinging(flag: boolean) {
    if (flag) {
      await startRinging();
    } else {
      stopRinging();
    }
  }

  async function joinIncomingCall(chatObjId: ChatIdObj, sender: string) {
    await chatsStore.updateChatItemInList(chatObjId, { incomingCall: undefined });
    stopRinging();
    videoOpenerSrv.joinOrDismissCallInRoom(chatObjId, true, sender);
  }

  async function dismissIncomingCall(chatObjId: ChatIdObj, withoutMakeSystemMsg: boolean) {
    const chat = chatsStore.getChatView(chatObjId);
    if (!chat) {
      return;
    }

    const currentIncomingCall = cloneDeep(chat.incomingCall);
    if (!currentIncomingCall?.peerAddress) {
      return;
    }

    await chatsStore.updateChatItemInList(chatObjId, { incomingCall: undefined });
    stopRinging();
    await videoOpenerSrv.joinOrDismissCallInRoom(chatObjId, false);

    const recipients: string[] = [];
    if (chat.isGroupChat) {
      for (const member of Object.keys(chat.members)) {
        if (member !== appStore.user) {
          recipients.push(member);
        }
      }
    } else {
      recipients.push(currentIncomingCall.peerAddress);
    }

    if (withoutMakeSystemMsg) {
      return;
    }

    const { chatMessageId, timestamp } = generateChatMessageId();
    await chatService.sendSystemDeletableMessage({
      chatId: chatObjId,
      recipients,
      chatMessageId,
      chatSystemData: {
        event: 'webrtc-call',
        value: {
          subType: 'incoming-call-cancelled',
          sender: appStore.user,
          chatId: chatObjId,
        },
      },
    });

    const systemMsg = await chatService.makeAndSaveMsgToDb(appStore.user, {
      chatMessageType: 'system',
      isIncomingMsg: false,
      groupChatId: chat.isGroupChat ? chat.chatId : null,
      otoPeerCAddr: chat.isGroupChat ? null : chat.chatId,
      groupSender: chat.isGroupChat ? appStore.user : null,
      chatMessageId,
      timestamp,
      body: JSON.stringify({
        event: 'webrtc-call',
        value: {
          subType: 'incoming-call-cancelled',
          sender: currentIncomingCall.peerAddress,
        },
      }),
    });
    await messagesStore.handleAddedMsg(systemMsg);
  }

  async function startCall(chatObjId: ChatIdObj): Promise<void> {
    await videoOpenerSrv.startVideoCallForChatRoom(chatObjId);
  }

  async function endCall(chatObjId: ChatIdObj) {
    videoOpenerSrv.endVideoCallInChatRoom(chatObjId);
  }

  return {
    startRinging,
    stopRinging,
    toggleRinging,
    joinIncomingCall,
    dismissIncomingCall,
    startCall,
    endCall,
  };
});
