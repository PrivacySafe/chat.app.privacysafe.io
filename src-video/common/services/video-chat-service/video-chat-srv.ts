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
// @deno-types="@shared/ipc/ipc-service.d.ts"
import { shallowRef } from 'vue';
import { makeSyncedFunc, SingleProc } from '@v1nt1248/3nclient-lib/utils';
import { fstIsPolite } from '@bg/utils/for-perfect-negotiation';
import { useAppStore } from '@video/common/store/app.store';
import { useStreamsStore } from '@video/common/store/streams.store';
import { toCanonicalAddress } from '@shared/address-utils';
import { PeerChannelWithStreams } from '../streaming-channel';
import type {
  CallFromVideoGUI,
  ChatInfoForCall,
  VideoChatComponent,
  WebRTCMsg,
  WebRTCOffBandMessage,
} from '~/index';
import type { OffBandSignalingChannel } from '@video/common/types';

type SignalsListener = (data: WebRTCOffBandMessage) => Promise<void>;

export function useVideoChatSrv(): VideoChatComponent {
  const appStore = useAppStore();
  const streamsStore = useStreamsStore();

  /* peer signal listeners */
  const listeners = new Map<string, SignalsListener>();

  function getListener(peerAddr: string): SignalsListener | undefined {
    return listeners.get(toCanonicalAddress(peerAddr));
  }

  function addListenerOnce(peerAddr: string, listener: SignalsListener) {
    if (getListener(peerAddr)) {
      throw new Error(`Listener is already set`);
    }

    const peerCanonAddr = toCanonicalAddress(peerAddr);
    listeners.set(peerCanonAddr, listener);
  }

  function deleteListener(peerAddr: string) {
    const peerCanonAddr = toCanonicalAddress(peerAddr);
    listeners.delete(peerCanonAddr);
  }

  /* video chat service methods */
  const ctrlObs = shallowRef<web3n.Observer<CallFromVideoGUI> | undefined>(undefined);
  const chat = shallowRef<ChatInfoForCall | undefined>(undefined);

  async function startVideoCallComponentForChat(value: ChatInfoForCall): Promise<void> {
    console.log('# startVideoCallComponentForChat => ', value);

    if (chat.value) {
      throw `Chat room is already set for this window`;
    }

    chat.value = value;
    passInitialDataToStreamsStore();
  }

  async function focusWindow(): Promise<void> {
    // TODO this method is probably not needed because calling the GUI service focuses the window
  }

  async function endCall() {
    return await streamsStore.endCall();
  }

  async function handleWebRTCSignal(peerAddr: string, msg: WebRTCMsg): Promise<void> {
    const { data } = msg;
    const listener = getListener(peerAddr);
    if (!listener) {
      return;
    }

    if (Array.isArray(data)) {
      for (const datum of data) {
        await listener(datum);
      }
      return;
    }

    await listener(data);
  }

  function notifyBkgrndInstanceOnCallStart() {
    console.log('# VIDEO_CHAT_SRV notifyBkgrndInstanceOnCallStart # ', ctrlObs.value);
    ctrlObs.value?.next!({ type: 'call-started-event' });
  }

  function watchRequests(obs: web3n.Observer<CallFromVideoGUI>): () => void {
    if (ctrlObs.value) {
      throw `Observer from GUI controller is already set`;
    }

    ctrlObs.value = obs;
    window.addEventListener('beforeunload', () => ctrlObs.value?.complete!());

    return () => {
      ctrlObs.value?.complete?.();
      w3n.closeSelf();
    };
  }

  function makeConnector(peerAddr: string): OffBandSignalingChannel {
    return {
      observeIncoming: obs => {
        addListenerOnce(peerAddr, makeSyncedFunc(new SingleProc, null, obs));
        ctrlObs.value?.next!({ type: 'start-channel', peerAddr });
      },
      close: () => {
        deleteListener(peerAddr);
        ctrlObs.value?.next!({ type: 'close-channel', peerAddr });
      },
      send: data => {
        ctrlObs.value?.next!({ type: 'send-webrtc-signal', peerAddr, data });
      },
    };
  }

  function passInitialDataToStreamsStore() {
    console.log('<- passInitialDataToStreamsStore ->');
    streamsStore.initialize(
      chat.value!.chatName,
      chat.value!.ownName,
      chat.value!.ownAddr,
      chat.value!.peers,
      peerAddr => PeerChannelWithStreams.makeWith(
        peerAddr,
        streamsStore,
        appStore.$emitter,
        chat.value!.rtcConfig,
        makeConnector(peerAddr),
        fstIsPolite(chat.value!.ownAddr, peerAddr),
      ),
    );
  }

  return {
    endCall,
    focusWindow,
    startVideoCallComponentForChat,
    handleWebRTCSignal,
    watchRequests,
    notifyBkgrndInstanceOnCallStart,
  };
}
