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

import { Peer, StreamType, StreamsStore } from 'src-video/store/streams.store';
import type { VueEventBus } from '@v1nt1248/3nclient-lib/plugins';
import type { PeerEvents } from './events';
import { OffBandSignalingChannel, WebRTCPeerChannel } from './webrtc-peer-channel';
import { sleep } from '@v1nt1248/3nclient-lib/utils';

interface InfoMsg {
  type: 'info',
  msg: any;
}

interface StreamInfoMsg {
  type: 'stream',
  streamId: string;
  streamType: StreamType;
}

interface StreamStateMsg {
  type: 'stream-state',
  streamId: string;
  audio: boolean;
  video: boolean;
}

interface StreamRemovedMsg {
  type: 'stream-removed',
  streamId: string;
}

interface DisconnectMsg {
  type: 'disconnect';
}

type Msg = InfoMsg | DisconnectMsg |
StreamInfoMsg | StreamStateMsg | StreamRemovedMsg;

interface StreamWithInfo {
  type: StreamType;
  stream: MediaStream;
  tracks: string[];
}

export class PeerChannelWithStreams extends WebRTCPeerChannel {

  private readonly partials: Record<
    string, Partial<StreamWithInfo & { streamId: string; }>
  > = {};
  private readonly ownTrackSenders = new Map<string, RTCRtpSender>();

  private constructor(
    private readonly peerAddr: string,
    private readonly store: StreamsStore,
    private readonly eventBus: VueEventBus<PeerEvents>,
    rtcConfig: RTCConfiguration, offBandComm: OffBandSignalingChannel,
    isPolite: boolean,
  ) {
    super(rtcConfig, offBandComm, isPolite);
    Object.seal(this);
  }

  public static makeWith(
    peerAddr: string,
    store: StreamsStore, eventBus: VueEventBus<PeerEvents>,
    rtcConfig: RTCConfiguration, offBandComm: OffBandSignalingChannel,
    isPolite: boolean,
  ): PeerChannelWithStreams {
    const peer = new PeerChannelWithStreams(
      peerAddr, store, eventBus, rtcConfig, offBandComm, isPolite
    );
    return peer;
  }

  private get peerStore(): Peer {
    return this.store.getPeer(this.peerAddr);
  }

  protected onConnectionTrack(ev: RTCTrackEvent): void {
    const { track, streams: [ stream ] } = ev;
    this.absorbStreamTrack(stream, track.id);
    track.onunmute = () => {
      this.store.syncUIWithPeerTracksState(this.peerAddr);
    };
    track.onmute = () => {
      this.store.syncUIWithPeerTracksState(this.peerAddr);
    };
    // handler for ended, but mute is called on track removal (?)
    track.onended = () => {
      this.store.removePeerStreamTrack(this.peerAddr, stream.id, track.id);
      this.store.syncUIWithPeerTracksState(this.peerAddr);
    };
  }

  protected onWebRTCConnectionDisconnected(): void {
    this.peerStore.webRTCConnected = false;
  }

  protected onWebRTCConnected(): void {
    this.peerStore.webRTCConnected = true;
    this.eventBus.emit('peer:connected', {
      peerAddr: this.peerAddr
    });
  }

  sendUserMediaStream(stream: MediaStream): void {
    this.sendStreamInfo(stream.id, 'camera+mic');
    this.sendStream(stream);
  }

  sendScreenMediaStream(type: 'window'|'screen', stream: MediaStream): void {
    this.sendStreamInfo(stream.id, type);
    this.sendStream(stream);
  }

  private sendStream(stream: MediaStream): void {
    for (const track of stream.getTracks()) {
      const sender = this.conn.addTrack(track, stream);
      this.ownTrackSenders.set(track.id, sender);
    }
  }

  private sendStreamInfo(streamId: string, streamType: StreamType): void {
    const json: StreamInfoMsg = { type: 'stream', streamId, streamType };
    this.dataChannel?.send(JSON.stringify(json));
  }

  signalOwnStreamState(streamId: string, audio: boolean, video: boolean): void {
    const json: StreamStateMsg = {
      type: 'stream-state',
      streamId, audio, video
    };
    this.dataChannel?.send(JSON.stringify(json));
  }

  private signalStreamRemoval(streamId: string): void {
    const json: StreamRemovedMsg = {
      type: 'stream-removed',
      streamId
    };
    this.dataChannel?.send(JSON.stringify(json));
  }

  stopSendingStream(stream: MediaStream): void {
    this.signalStreamRemoval(stream.id);
    for (const track of stream.getTracks()) {
      const sender = this.ownTrackSenders.get(track.id);
      if (sender) {
        this.ownTrackSenders.delete(track.id);
        this.conn.removeTrack(sender);
      }
    }
  }

  sendInfoMsg<T>(msg: T): void {
    const json: InfoMsg = {
      type: 'info', msg
    };
    this.dataChannel?.send(JSON.stringify(json));
  }

  protected onDataChannelMessage(ev: { data: string; }): void {
    try {
      const json: Msg = JSON.parse(ev.data);
      if (json.type === 'info') {
        this.emitPeerInfoMsgEvent(json.msg);
      } else if (json.type === 'stream') {
        this.absorbStreamInfo(json);
      } else if (json.type === 'stream-state') {
        this.absorbStreamStateEvent(json);
      } else if (json.type === 'stream-removed') {
        this.absorbStreamRemovalEvent(json.streamId);
      } else if (json.type === 'disconnect') {
        this.absorbPeerDisconnectEvent();
      } else {
        console.error(
          `Unknown type in data channel message:`, (json as any).type
        );
      }
    } catch (err) {
      console.error(`Captured error in handling data channel message`, err);
    }
  }

  private emitPeerInfoMsgEvent(msg: any): void {
    this.eventBus.emit('peer:info-msg', {
      peerAddr: this.peerAddr,
      msg
    });
  }

  private absorbStreamInfo({ streamType, streamId }: StreamInfoMsg): void {
    const partial = this.partials[streamId];
    if (partial?.stream) {
      this.placePeerStreamIntoStore({
        type: streamType,
        stream: partial.stream,
        tracks: partial.tracks!
      });
      delete this.partials[streamId];
    } else {
      this.partials[streamId] = {
        streamId, type: streamType, tracks: []
      };
    }
  }

  private placePeerStreamIntoStore({
    stream, tracks, type
  }: StreamWithInfo): void {
    for (const trackId of tracks) {
      this.store.addPeerStreamTrack(this.peerAddr, type, stream, trackId);
    }
    this.store.syncUIWithPeerTracksState(this.peerAddr);
    this.eventBus.emit('stream:added', {
      peerAddr: this.peerAddr,
      streamId: stream.id,
      streamType: type
    });
  }

  private absorbStreamTrack(stream: MediaStream, trackId: string): void {
    const partial = this.partials[stream.id];
    if (partial) {
      if (partial.type) {
        this.placePeerStreamIntoStore({
          type: partial.type,
          stream,
          tracks: [ trackId ]
        });
        delete this.partials[stream.id];
      } else {
        partial.tracks!.push(trackId);
      }
    } else {
      const infoInStore = this.store.getPeerStream(this.peerAddr, stream.id);
      if (infoInStore) {

      } else {
        this.partials[stream.id] = {
          stream, tracks: [ trackId ]
        };
      }
    }
  }

  private absorbStreamStateEvent({
    streamId, audio, video
  }: StreamStateMsg): void {
    const stream = this.store.getPeerStream(this.peerAddr, streamId)?.stream;
    if (!stream) {
      return;
    }
    stream.getAudioTracks().forEach(t => { t.enabled = audio; });
    stream.getVideoTracks().forEach(t => { t.enabled = video; });
    this.store.syncUIWithPeerTracksState(this.peerAddr);
    this.eventBus.emit('stream:track-event', {
      peerAddr: this.peerAddr,
      streamId, audio, video
    });
  }

  private absorbStreamRemovalEvent(streamId: string): void {
    this.store.removePeerStream(this.peerAddr, streamId);
    this.eventBus.emit('stream:removed', {
      peerAddr: this.peerAddr,
      streamId
    });
  }

  private absorbPeerDisconnectEvent(): void {
    this.eventBus.emit('peer:disconnected', {
      peerAddr: this.peerAddr
    });
    super.close();
  }

  /**
   * Close should be called by one side.
   * When this is called after arrival of peer-disconnected message, a new call
   * may get started in a race condition.
   */
  async close(): Promise<void> {
    if (this.isConnected) {
      const json: DisconnectMsg = {
        type: 'disconnect'
      };
      this.dataChannel?.send(JSON.stringify(json));
    }
    await sleep(100);
    super.close();
  }

}
