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

import { toCanonicalAddress } from "../../shared-libs/address-utils.ts";
import { WebRTCMsg, ChatInfoForCall, CallFromVideoGUI, VideoChatEvent, WebRTCOffBandMessage } from "../../types/index.ts";
import { WebRTCSignalingPeerChannel } from "./signalling-channels.ts";
import { VideoComponentInstance } from "./video-component-instance.ts";


export interface Peer {
  peerName: string;
  peerAddr: string;
  channel: WebRTCSignalingPeerChannel;
}

export class CallInChat {

  private readonly peers = new Map<string, Peer>();
  private guiInstance: VideoComponentInstance | undefined = undefined;
  private callStage: 'not-started' | 'calling' | 'done' = 'not-started';

  constructor(
    private readonly info: ChatInfoForCall,
    private readonly sinkGUIEvent: (event: VideoChatEvent) => void,
    private readonly detachFromParent: () => void
  ) {
    for (const { name: peerName, addr: peerAddr } of info.peers) {
      const channel = new WebRTCSignalingPeerChannel(
        this.info.ownAddr, this.info.chatId, peerAddr
      );
      this.peers.set(
        toCanonicalAddress(peerAddr),
        { peerName, peerAddr, channel }
      );
    }
  }

  hasPeer(addr: string): boolean {
    return this.peers.has(toCanonicalAddress(addr));
  }

  handleWebRTCSignalFrom(peer: string, webrtcMsg: WebRTCMsg): boolean {
    return this.channelTo(peer).handleIncomingSignal(webrtcMsg);
  }

  async startCall(): Promise<void> {
    if (this.callStage === 'done') {
      return;
    } else if (this.callStage === 'not-started') {
      this.callStage = 'calling';
    }
    if (this.guiInstance) {
      await this.guiInstance.focusWindow();
    } else {
      const {
        instance, startProc
      } = await VideoComponentInstance.makeAndStart(this.info, {
        next: this.onRequestCallFromVideoGUI.bind(this),
        complete: this.onGUIComplete.bind(this),
        error: this.onGUIError.bind(this)
      });
      this.guiInstance = instance;
      await startProc;
    }
  }

  async end(): Promise<void> {
    if (this.callStage === 'done') {
      return;
    } else if (this.callStage === 'calling') {
      for (const { channel } of this.peers.values()) {
        channel.sendMsgToPeer('disconnect', {});
        channel.detachGUI();
      }
    }
    this.callStage = 'done';
    this.detachFromParent();
  }

  private channelTo(peerAddr: string): WebRTCSignalingPeerChannel {
    return this.peers.get(toCanonicalAddress(peerAddr))!.channel;
  }

  private async onRequestCallFromVideoGUI(
    request: CallFromVideoGUI
  ): Promise<void> {
    if (this.callStage !== 'calling') {
      return;
    }
    const { type } = request;
    try {
      if (type === 'send-webrtc-signal') {
        const { peerAddr, data } = request;
        this.channelTo(peerAddr).sendMsgToPeer('signalling', data);
      } else if (type === 'start-channel') {
        const { peerAddr } = request;
        this.channelTo(peerAddr).attachGUI(
          this.guiInstance!.getListenerForChannelTo(peerAddr)
        );
      } else if (type === 'close-channel') {
        const { peerAddr } = request;
        this.channelTo(peerAddr).detachGUI();
      } else if (type === 'call-started-event') {
        this.sinkGUIEvent({
          type: 'call-started',
          chatId: this.info.chatId,
        });
      } else {
        throw `unknown event from video component`;
      }
    } catch (err) {
      await w3n.log(
        'error', `Error in handling ${type} request from video component`, err
      );
    }
  }

  private onGUIComplete(): void {
    this.sinkGUIEvent({
      type: 'call-ended',
      chatId: this.info.chatId,
    });
    this.end();
  }

  private onGUIError(err: web3n.rpc.RPCException): void {
    if (!err.connectionClosed) {
      w3n.log('error', `IPC to video call window threw an error`, err);
    }
    this.onGUIComplete();
  }

}
