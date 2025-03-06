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

import { defineStore } from 'pinia';
import { PeerChannelWithStreams } from '@video/services/streaming-channel';

export interface PeerState {
  peerAddr: string;
  peerName: string;
  isMicOn: boolean;
  isCamOn: boolean;
  streams: StreamWithInfo[];
  webRTCConnected: boolean;
  channel: PeerChannelWithStreams;
}

export interface StreamWithInfo {
  type: StreamType;
  stream: MediaStream;
  tracks: string[];
}

export type VideoShareStreamType = 'window' | 'screen';
export type SoundShareStreamType = 'desk-sound';
export type StreamType = 'camera+mic' |
VideoShareStreamType | SoundShareStreamType;

export interface OwnVideoAudio {
  stream: MediaStream;
  deviceId: string;
}

export interface OwnScreen {
  stream: MediaStream;
  type: VideoShareStreamType;
  srcId: string;
  name: string;
}

export interface StreamsStoreState {
  chatName: string;
  ownName: string;
  ownAddr: string;
  ownVA: OwnVideoAudio | null;
  ownScreens: OwnScreen[] | null;
  ownDeskSound: boolean;
  isMicOn: boolean;
  isCamOn: boolean;
  peers: PeerState[];
}

export function makePeerState(
  peerAddr: string, peerName: string,
  channel: PeerChannelWithStreams
): PeerState {
  return {
    peerAddr,
    peerName,
    isCamOn: false,
    isMicOn: false,
    streams: [],
    webRTCConnected: false,
    channel
  };
}

export const useStreamsStore = defineStore('streams', {

  state: () => ({
    peers: [] as PeerState[],
    chatName: '',
    ownName: '',
    ownAddr: '',
    isMicOn: false,
    isCamOn: false,
    ownVA: null,
    ownScreens: null,
    ownDeskSound: false,
  } as StreamsStoreState),

  getters: {
    isGroupChat: state => (state.peers.length > 1),

    isAnyOneConnected: state => !!state.peers.find(p => p.webRTCConnected),

    singlePeer: state => {
      if (state.peers.length !== 1) {
        throw new Error(`This is a group chat. Use address based access`);
      }
      return state.peers[0];
    },

    isOwnAudioAvailable: ({ ownVA }) => (ownVA ?
      (ownVA.stream.getAudioTracks().length > 0) :
      undefined
    ),

    isOwnVideoAvailable: ({ ownVA }) => (ownVA ?
      (ownVA.stream.getVideoTracks().length > 0) :
      undefined
    ),

    isSharingOwnDeskSound: ({ ownDeskSound }) => ownDeskSound,

  },

  actions: {
    setMicOn(val: boolean) {
      if ((this.isMicOn !== val) && this.ownVA) {
        this.isMicOn = val;
        toggleAudioIn(this.ownVA.stream, val);
        const streamId = this.ownVA.stream.id;
        this.peers.forEach(({ channel }) => channel.signalOwnStreamState(
          streamId, val, this.isCamOn
        ));
      }
    },

    setCamOn(val: boolean) {
      if ((this.isCamOn !== val) && this.ownVA) {
        this.isCamOn = val;
        toggleVideoIn(this.ownVA.stream, val);
        const streamId = this.ownVA.stream.id;
        this.peers.forEach(({ channel }) => channel.signalOwnStreamState(
          streamId, this.isMicOn, this.isCamOn
        ));
      }
    },

    setOwnVAStream(val: MediaStream | null, videoDevId: string | null) {
      if (val) {
        this.ownVA = {
          stream: val,
          deviceId: videoDevId!
        };
        toggleAudioIn(this.ownVA.stream, this.isMicOn);
        toggleVideoIn(this.ownVA.stream, this.isCamOn);
      } else {
        this.ownVA = null;
      }
    },

    setOwnDeskSoundSharing(val: boolean) {
      if (val) {
        if (!this.ownScreens) {
          throw new Error(`there is screens shared to setup desk audio share`);
        }
        toggleAudioIn(this.ownScreens[0].stream, true);
      } else {
        if (this.ownScreens) {
          toggleAudioIn(this.ownScreens[0].stream, false);
        }
      }
      this.ownDeskSound = val;
    },

    addOwnScreen(
      stream: MediaStream, type: OwnScreen['type'], srcId: string, name: string,
      startSendingToPeers = true
    ) {
      toggleAudioIn(stream, false);
      if (!this.ownScreens) {
        this.ownScreens = [];
      }
      this.ownScreens.push({ stream, type, srcId, name });
      if (startSendingToPeers) {
        for (const { channel } of this.peers) {
          if (channel.isConnected) {
            channel.sendScreenMediaStream(type, stream);
          }
        }
      }
    },

    removeOwnScreen(srcId: string, stopSendingToPeers = true) {
      if (!this.ownScreens) {
        return;
      }
      const ind = this.ownScreens.findIndex(info => (info.srcId === srcId));
      if (ind < 0) {
        return;
      }
      const { stream } = this.ownScreens[ind];
      const sendOtherShareSound = (this.ownDeskSound && (ind === 0));
      this.ownScreens.splice(ind, 1);
      if (this.ownScreens.length === 0) {
        this.ownScreens = null;
        this.ownDeskSound = false;
      }
      if (stopSendingToPeers) {
        for (const { channel } of this.peers) {
          if (channel.isConnected) {
            channel.stopSendingStream(stream);
          }
        }
      }
      if (sendOtherShareSound && this.ownScreens) {
        toggleAudioIn(this.ownScreens[0].stream, true);
      }
    },

    getPeer(peerAddr: string) {
      const peer = this.peers.find(p => (p.peerAddr === peerAddr));
      if (!peer) {
        throw new Error(`Peer with address ${peerAddr} not found among ${this.peers.length} peers. Is it exact spelling as is used in chat info?`);
      }
      return peer;
    },

    addPeerStreamTrack(
      peerAddr: string, type: StreamType, stream: MediaStream, trackId: string
    ) {
      const { streams } = this.getPeer(peerAddr);
      const streamWithInfo = streams.find(
        ({ stream: { id } }) => (id === stream.id)
      );
      if (streamWithInfo) {
        streamWithInfo.tracks.push(trackId);
      } else {
        streams.push({
          type, stream, tracks: [ trackId ]
        });
      }
    },

    removePeerStreamTrack(
      peerAddr: string, streamId: string, trackId: string
    ) {
      const { streams } = this.getPeer(peerAddr);
      const indOfStream = streams.findIndex(
        ({ stream: { id } }) => (id === streamId)
      );
      if (indOfStream < 0) {
        return;
      }
      const { tracks } = streams[indOfStream];
      const indOfTrack = tracks.indexOf(trackId);
      if (indOfTrack >= 0) {
        if (tracks.length > 1) {
          tracks.splice(indOfTrack, 1);
        } else {
          streams.splice(indOfStream, 1);
        }
      }
    },

    removePeerStream(peerAddr: string, streamId: string) {
      const { streams } = this.getPeer(peerAddr);
      const indOfStream = streams.findIndex(
        ({ stream: { id } }) => (id === streamId)
      );
      if (indOfStream < 0) {
        return;
      }
      streams.splice(indOfStream, 1);
    },

    getStream(peerAddr: string, streamId: string) {
      const { streams } = this.getPeer(peerAddr);
      return streams.find(({ stream: { id } }) => (id === streamId));
    },

    getStreams(peerAddr: string, type: StreamType) {
      const { streams } = this.getPeer(peerAddr);
      return streams.filter(s => (s.type === type))
      .map(({ stream }) => stream);
    },

    hasTrackON(
      peerAddr: string, streamType: StreamType, trackType: 'audio'|'video'
    ): boolean {
      const { streams } = this.getPeer(peerAddr);
      for (const { stream, type } of streams) {
        if (type !== streamType) {
          continue;
        }
        if (trackType === 'audio') {
          if (stream.getAudioTracks().find(t => t.enabled)) {
            return true;
          }
        } else if (trackType === 'video') {
          if (stream.getVideoTracks().find(t => t.enabled)) {
            return true;
          }
        }
      }
      return false;
    },

    syncUIWithTracksState(peerAddr: string): void {
      const peer = this.getPeer(peerAddr);
      peer.isMicOn = this.hasTrackON(peerAddr, 'camera+mic', 'audio');
      peer.isCamOn = this.hasTrackON(peerAddr, 'camera+mic', 'video');
    },

  },
});

function toggleAudioIn(stream: MediaStream, enable: boolean): void {
  stream.getAudioTracks().forEach(audioTrack => {
    audioTrack.enabled = enable;
  });
}

function toggleVideoIn(stream: MediaStream, enable: boolean): void {
  stream.getVideoTracks().forEach(videoTrack => {
    videoTrack.enabled = enable;
  });
}

export type StreamsStore = ReturnType<typeof useStreamsStore>;
export type Peer = ReturnType<StreamsStore['getPeer']>;
