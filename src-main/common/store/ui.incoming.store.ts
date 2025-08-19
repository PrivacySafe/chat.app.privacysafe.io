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
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { Sound } from '@shared/sounds.ts';
import { videoOpenerSrv } from '@main/common/services/external-services';
import { useChatsStore } from '@main/common/store/chats.store';
import { ChatIdObj } from '~/asmail-msgs.types';

export const useUiIncomingStore = defineStore('ui-incoming', () => {
  const { updateChatItemInList } = useChatsStore();

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
    await updateChatItemInList(chatObjId, { incomingCall: undefined });
    stopRinging();
    videoOpenerSrv.joinOrDismissCallInRoom(chatObjId, true, sender);
  }

  async function dismissIncomingCall(chatObjId: ChatIdObj) {
    await updateChatItemInList(chatObjId, { incomingCall: undefined });
    stopRinging();
    await videoOpenerSrv.joinOrDismissCallInRoom(chatObjId, false);
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
