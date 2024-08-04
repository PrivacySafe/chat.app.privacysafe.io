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

import { Router } from 'vue-router';
// @deno-types="./libs/ipc/ipc-service.d.ts"
import { MultiConnectionIPCWrap } from './libs/ipc/ipc-service.js'
import { useStreamsStore } from './stores.ts';
import { OffBandSignalingChannel, WebRTCPeer } from './webrtc-peer.ts';
import { toCanonicalAddress } from './libs/address-utils.ts';
import { SingleProc, makeSyncedFunc } from './libs/processes/single.ts';


export let videoChatSrv: VideoChat

const vaChannel = 'video/audio'

export class VideoChat {

  private ctrlObs: web3n.Observer<CallGUIEvent>|undefined = undefined;
  private chat: ChatInfoForCall|undefined = undefined;
  private readonly connectors = new PeerSignalsListeners()

  private constructor(
    private readonly router: Router
  ) {
    Object.seal(this);
  }

  static initializeService(router: Router) {
    if (videoChatSrv) {
      throw new Error(`Service singleton has already been initialized`)
    }
    videoChatSrv = new VideoChat(router);
    videoChatSrv.startVideoChatComponentService();
  }

  private startVideoChatComponentService(): void {
    const srv: VideoChatComponent = {
      closeWindow: this.closeWindow.bind(this),
      async focusWindow(): Promise<void> {
        // this is a noop, cause call to GUI service focuses the window
      },
      startCallGUIForChat: this.setChatInfo.bind(this),
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
  }

  private async handleIncomingWebRTCSignal(
    peerAddr: string, { channel, data }: WebRTCMsg
  ): Promise<void> {
    const listener = this.connectors.get(peerAddr, channel)
    if (!listener) {
      return
    }
    if (Array.isArray(data)) {
      for (const datum of data) {
        await listener(datum)
      }
    } else {
      await listener(data)
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

  private async setChatInfo(chat: ChatInfoForCall): Promise<void> {
    if (this.chat) {
      throw `Chat room is already set for this window`;
    }
    this.chat = chat;
    useStreamsStore().setChat(chat)
    await this.router.replace('va-setup')
  }

  async setVAChannelsForAllPeers(): Promise<void> {
    this.chat!.peers.forEach(({ addr: peerAddr }) => {
      this.setWebRTCPeerFor(peerAddr, vaChannel, this.chat!.rtcConfig)
    })
  }

  private setWebRTCPeerFor(
    peerAddr: string, channel: string, rtcConfig: RTCConfiguration
  ): void {
    const store = useStreamsStore()
    const peerStore = store.usePeerStore(peerAddr)
    peerStore.setWebRTCPeer(WebRTCPeer.makeWith(
      rtcConfig,
      this.makeConnector(channel, peerAddr),
      fstIsPolite(this.chat!.ownAddr, peerAddr)
    ))
  }

  notifyOnCallStart(): void {
    this.ctrlObs!.next!({
      type: 'call-started'
    })
  }

  private makeConnector(
    channel: string, peerAddr: string
  ): OffBandSignalingChannel {
    return {
      observeIncoming: obs => {
        this.connectors.addOnce(
          peerAddr, channel, makeSyncedFunc(new SingleProc, null, obs)
        )
        this.ctrlObs!.next!({
          type: 'start-channel', channel, peerAddr
        })
      },
      close: () => {
        this.connectors.delete(peerAddr, channel)
        this.ctrlObs!.next!({
          type: 'close-channel', channel, peerAddr
        })
      },
      send: (data) => this.ctrlObs!.next!({
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
    return true
  } else if (fst > other) {
    return false
  } else {
    throw new Error(`Starting WebRTC call with self is not supported`)
  }
}

class PeerSignalsListeners {

  private readonly listeners = new Map<string, Map<string, SignalsListener>>()

  get(
    peerAddr: string, channel: string
  ): SignalsListener|undefined {
    const peerConnectors = this.listeners.get(toCanonicalAddress(peerAddr))
    return peerConnectors?.get(channel)
  }

  addOnce(peerAddr: string, channel: string, listener: SignalsListener): void {
    if (this.get(peerAddr, channel)) {
      throw new Error(`Listener is already set`)
    }
    const peerCanonAddr = toCanonicalAddress(peerAddr)
    let peerConnectors = this.listeners.get(peerCanonAddr)
    if (!peerConnectors) {
      peerConnectors = new Map()
      this.listeners.set(peerCanonAddr, peerConnectors)
    }
    peerConnectors.set(channel, listener)
  }

  delete(peerAddr: string, channel: string): void {
    const peerCanonAddr = toCanonicalAddress(peerAddr)
    const peerConnectors = this.listeners.get(peerCanonAddr)
    if (!peerConnectors) {
      return
    }
    peerConnectors.delete(channel)
    if (peerConnectors.size === 0) {
      this.listeners.delete(peerCanonAddr)
    }
  }

}
