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

// @deno-types="@shared/ipc/ipc-service.d.ts"
import { SingleProc, defer, makeSyncedFunc } from '@v1nt1248/3nclient-lib/utils';
import { MultiConnectionIPCWrap } from '@shared/ipc/ipc-service'
import type { StreamsStore } from '@video/common/store/streams.store.ts';
import type { VueEventBus } from '@v1nt1248/3nclient-lib/plugins';
import type {
  ChatInfoForCall,
  CallFromVideoGUI,
  VideoChatComponent,
  WebRTCMsg,
  WebRTCOffBandMessage,
} from '~/index.ts';
import type { OffBandSignalingChannel } from '@video/common/types';
import type { PeerEvents } from '@video/common/types/events';
import { PeerChannelWithStreams } from './streaming-channel';
import { toCanonicalAddress } from '@shared/address-utils';
import { fstIsPolite } from '@bg/utils/for-perfect-negotiation';

type SignalsListener = (data: WebRTCOffBandMessage) => Promise<void>;

export let videoChatSrv: VideoChat;

export class VideoChat {

  private ctrlObs: web3n.Observer<CallFromVideoGUI>|undefined = undefined;
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
        endCall: this.endCall.bind(this),
        async focusWindow(): Promise<void> {
          // this is a noop, cause call to GUI service focuses the window
        },
        startVideoCallComponentForChat: async chat => {
          if (this.chat) {
            throw `Chat room is already set for this window`;
          }
          this.chat = chat;
          chatDataInit.resolve();
          chatDataInit = undefined as never;
        },
        watchRequests: this.setControllerObs.bind(this),
        handleWebRTCSignal: this.handleIncomingWebRTCSignal.bind(this),
        notifyBkgrndInstanceOnCallStart: this.notifyBkgrndInstanceOnCallStart.bind(this),
      }
      const srvWrap = new MultiConnectionIPCWrap('VideoChatComponent');
      srvWrap.exposeReqReplyMethods(srv, [
        'startVideoCallComponentForChat',
        'focusWindow',
        'endCall',
        'handleWebRTCSignal'
      ]);
      srvWrap.exposeObservableMethods(srv, [
        'watchRequests'
      ]);
      srvWrap.startIPC();
    } catch (err) {
      chatDataInit.reject(err);
    }
    return chatDataInit.promise;
  }

  private async handleIncomingWebRTCSignal(peerAddr: string, { data }: WebRTCMsg): Promise<void> {
    const listener = this.connectors.get(peerAddr);
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

  private setControllerObs(obs: web3n.Observer<CallFromVideoGUI>): () => void {
    if (this.ctrlObs) {
      throw `Observer from GUI controller is already set`;
    }
    this.ctrlObs = obs;
    window.addEventListener('beforeunload', () => this.ctrlObs?.complete?.())
    return () => {
      this.ctrlObs?.complete?.();
      w3n.closeSelf!();
    };
  }

  private async endCall(): Promise<void> {
    await this.store?.endCall();
  }

  attachToVue(store: StreamsStore, eventBus: VueEventBus<PeerEvents>): void {
    if (this.store) {
      throw new Error(`Store has already been attached`);
    }
    this.store = store;
    this.eventBus = eventBus;
    const { chatName, ownName, ownAddr, peers, rtcConfig } = this.chat!;
    this.store.initialize(
      chatName,
      ownName,
      ownAddr,
      peers,
      peerAddr => PeerChannelWithStreams.makeWith(
        peerAddr, this.store!, this.eventBus!, rtcConfig,
        this.makeConnector(peerAddr),
        fstIsPolite(ownAddr, peerAddr)
      )
    );
  }

  notifyBkgrndInstanceOnCallStart(): void {
    this.ctrlObs!.next!({
      type: 'call-started-event'
    });
  }

  private makeConnector(peerAddr: string): OffBandSignalingChannel {
    return {
      observeIncoming: obs => {
        this.connectors.addOnce(
          peerAddr, makeSyncedFunc(new SingleProc, null, obs)
        );
        this.ctrlObs!.next!({
          type: 'start-channel', peerAddr
        });
      },
      close: () => {
        this.connectors.delete(peerAddr);
        this.ctrlObs!.next!({
          type: 'close-channel', peerAddr
        });
      },
      send: data => this.ctrlObs!.next!({
        type: 'send-webrtc-signal', peerAddr, data
      })
    }
  }
}

class PeerSignalsListeners {

  private readonly listeners = new Map<string, SignalsListener>()

  get(peerAddr: string): SignalsListener|undefined {
    return this.listeners.get(toCanonicalAddress(peerAddr));
  }

  addOnce(peerAddr: string, listener: SignalsListener): void {
    if (this.get(peerAddr)) {
      throw new Error(`Listener is already set`);
    }
    const peerCanonAddr = toCanonicalAddress(peerAddr);
    this.listeners.set(peerCanonAddr, listener);
  }

  delete(peerAddr: string): void {
    const peerCanonAddr = toCanonicalAddress(peerAddr);
    this.listeners.delete(peerCanonAddr);
  }
}
