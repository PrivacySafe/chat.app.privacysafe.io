/*
 Copyright (C) 2024 3NSoft Inc.

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
import { MultiConnectionIPCWrap } from '@shared/ipc/ipc-service'
import { StreamsStore } from '@video/store/streams.store';
import { OffBandSignalingChannel } from './webrtc-peer-channel';
import type { VueEventBus } from '@v1nt1248/3nclient-lib/plugins';
import type {
  ChatInfoForCall,
  CallGUIEvent,
  VideoChatComponent,
  WebRTCMsg,
  WebRTCOffBandMessage,
} from '~/index';
import { PeerEvents } from '@video/services/events';
import { PeerChannelWithStreams } from './streaming-channel';
import { SingleProc, defer, makeSyncedFunc } from '@v1nt1248/3nclient-lib/utils';
import { toCanonicalAddress } from '@shared/address-utils';


export let videoChatSrv: VideoChat;

const vaChannelType = 'video/audio';

export class VideoChat {

  private ctrlObs: web3n.Observer<CallGUIEvent>|undefined = undefined;
  private chat: ChatInfoForCall|undefined = undefined;
  private readonly connectors = new PeerSignalsListeners();
  private store: StreamsStore|undefined = undefined;
  private eventBus: VueEventBus<PeerEvents>|undefined = undefined;

  private constructor() {
    Object.seal(this);
  }

  static async startService(): Promise<VideoChat> {
    if (videoChatSrv) {
      throw new Error(`Service singleton has already been initialized`);
    }
    videoChatSrv = new VideoChat();
    await videoChatSrv.startVideoChatComponentService();
    return videoChatSrv;
  }

  private startVideoChatComponentService(): Promise<void> {
    let chatDataInit = defer<void>();
    try {
      const srv: VideoChatComponent = {
        closeWindow: this.closeWindow.bind(this),
        async focusWindow(): Promise<void> {
          // this is a noop, cause call to GUI service focuses the window
        },
        startCallGUIForChat: async chat => {
          if (this.chat) {
            throw `Chat room is already set for this window`;
          }
          this.chat = chat;
          chatDataInit.resolve();
          chatDataInit = undefined as never;
        },
        watch: this.setControllerObs.bind(this),
        handleWebRTCSignal: this.handleIncomingWebRTCSignal.bind(this)
      }
      const srvWrap = new MultiConnectionIPCWrap('VideoChatComponent');
      srvWrap.exposeReqReplyMethods(srv, [
        'focusWindow', 'closeWindow', 'startCallGUIForChat',
        'handleWebRTCSignal'
      ]);
      srvWrap.exposeObservableMethods(srv, [
        'watch'
      ]);
      srvWrap.startIPC();
    } catch (err) {
      chatDataInit.reject(err);
    }
    return chatDataInit.promise;
  }

  private async handleIncomingWebRTCSignal(
    peerAddr: string, { channel, data }: WebRTCMsg
  ): Promise<void> {
    const listener = this.connectors.get(peerAddr, channel);
    if (!listener) {
      return;
    }
    if (Array.isArray(data)) {
      for (const datum of data) {
        await listener(datum);
      }
    } else {
      await listener(data);
    }
  }

  private setControllerObs(obs: web3n.Observer<CallGUIEvent>): () => void {
    if (this.ctrlObs) {
      throw `Observer from GUI controller is already set`;
    }
    this.ctrlObs = obs;
    window.addEventListener('beforeunload', () => this.ctrlObs?.complete?.())
    return () => this.closeWindow();
  }

  private async closeWindow(): Promise<void> {
    this.ctrlObs?.complete?.();
    w3n.closeSelf!();
  }

  attachToVue(
    store: StreamsStore, eventBus: VueEventBus<PeerEvents>
  ): void {
    if (this.store) {
      throw new Error(`Store has already been attached`);
    }
    this.store = store;
    this.eventBus = eventBus;
    const { chatName, ownName, ownAddr, peers, rtcConfig } = this.chat!;
    this.store.initialize(
      chatName, ownName, ownAddr, peers,
      peerAddr => PeerChannelWithStreams.makeWith(
        peerAddr, this.store!, this.eventBus!, rtcConfig,
        this.makeConnector(vaChannelType, peerAddr),
        fstIsPolite(ownAddr, peerAddr)
      )
    );
  }

  notifyBkgrndInstanceOnCallStart(): void {
    this.ctrlObs!.next!({
      type: 'call-started'
    });
  }

  private makeConnector(
    channel: string, peerAddr: string
  ): OffBandSignalingChannel {
    return {
      observeIncoming: obs => {
        this.connectors.addOnce(
          peerAddr, channel, makeSyncedFunc(new SingleProc, null, obs)
        );
        this.ctrlObs!.next!({
          type: 'start-channel', channel, peerAddr
        });
      },
      close: () => {
        this.connectors.delete(peerAddr, channel);
        this.ctrlObs!.next!({
          type: 'close-channel', channel, peerAddr
        });
      },
      send: data => this.ctrlObs!.next!({
        type: 'webrtc-signal', channel, peerAddr, data
      })
    }
  }

}


type SignalsListener = (data: WebRTCOffBandMessage) => Promise<void>;

function fstIsPolite(fstAddr: string, otherAddr: string): boolean {
  const fst = toCanonicalAddress(fstAddr)
  const other = toCanonicalAddress(otherAddr)
  if (fst < other) {
    return true;
  } else if (fst > other) {
    return false;
  } else {
    throw new Error(`Starting WebRTC call with self is not supported`);
  }
}

class PeerSignalsListeners {

  private readonly listeners = new Map<string, Map<string, SignalsListener>>()

  get(
    peerAddr: string, channel: string
  ): SignalsListener|undefined {
    const peerConnectors = this.listeners.get(toCanonicalAddress(peerAddr));
    return peerConnectors?.get(channel);
  }

  addOnce(peerAddr: string, channel: string, listener: SignalsListener): void {
    if (this.get(peerAddr, channel)) {
      throw new Error(`Listener is already set`);
    }
    const peerCanonAddr = toCanonicalAddress(peerAddr);
    let peerConnectors = this.listeners.get(peerCanonAddr);
    if (!peerConnectors) {
      peerConnectors = new Map();
      this.listeners.set(peerCanonAddr, peerConnectors);
    }
    peerConnectors.set(channel, listener);
  }

  delete(peerAddr: string, channel: string): void {
    const peerCanonAddr = toCanonicalAddress(peerAddr);
    const peerConnectors = this.listeners.get(peerCanonAddr);
    if (!peerConnectors) {
      return;
    }
    peerConnectors.delete(channel);
    if (peerConnectors.size === 0) {
      this.listeners.delete(peerCanonAddr);
    }
  }

}
