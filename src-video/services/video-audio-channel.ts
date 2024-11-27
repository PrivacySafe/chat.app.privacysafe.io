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

import { StreamsStore } from 'src-video/store/streams';
import type { VueEventBus } from '@v1nt1248/3nclient-lib/plugins';
import type { VideoAudioEvents } from './events';
import { OffBandSignalingChannel, WebRTCPeerChannel } from './webrtc-peer-channel';

export class VideoAudioChannel extends WebRTCPeerChannel {

  private constructor(
    private readonly peerAddr: string,
    private readonly store: StreamsStore,
    private readonly eventBus: VueEventBus<VideoAudioEvents>,
    rtcConfig: RTCConfiguration, offBandComm: OffBandSignalingChannel,
    isPolite: boolean,
  ) {
    super(rtcConfig, offBandComm, isPolite);
    Object.seal(this);
  }

  public static makeWith(
    peerAddr: string,
    store: StreamsStore, eventBus: VueEventBus<VideoAudioEvents>,
    rtcConfig: RTCConfiguration, offBandComm: OffBandSignalingChannel,
    isPolite: boolean,
  ): VideoAudioChannel {
    const peer = new VideoAudioChannel(
      peerAddr, store, eventBus, rtcConfig, offBandComm, isPolite,
    );
    return peer;
  }

  sendMediaStream(stream: MediaStream, initialMessage?: string): void {
    for (const track of stream.getTracks()) {
      this.conn.addTrack(track, stream);
    }

    this.setDataChannel(initialMessage);
  }

  sendMessageViaDataChannel(message: string): void {
    if (this.dataChannel?.readyState !== 'open') {
      return;
    }

    this.dataChannel?.send(message);
  }

  protected onConnTrack(ev: RTCTrackEvent) {
    const { track, streams } = ev;
    track.onunmute = () => {
      const peer = this.store.getPeer(this.peerAddr);
      // this assumes that both tracks arrive in the same stream which is
      // attached once
      if (!peer.vaStream) {
        peer.vaStream = streams[0];
        this.eventBus.emit('va:stream-connected', {
          peerAddr: this.peerAddr,
        });
      }
    };
  }

  protected onDisconnected(): void {
    const peer = this.store.getPeer(this.peerAddr);
    peer.vaStream = null;
    this.eventBus.emit('va:disconnected', {
      peerAddr: this.peerAddr,
    });
    super.onDisconnected();
  }

  protected onDataChannelMessage(ev: { data: string }) {
    const value = JSON.parse(ev.data) as VideoAudioEvents['va:peer-ui-state'];
    this.eventBus.emit('va:peer-ui-state', value);
  }
}
