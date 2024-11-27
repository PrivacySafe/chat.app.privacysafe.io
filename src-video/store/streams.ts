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

import { defineStore } from 'pinia';
import set from 'lodash/set';
import { VideoAudioChannel } from 'src-video/services/video-audio-channel';

export interface PeerState {
  peerAddr: string;
  peerName: string;
  vaChannel: VideoAudioChannel;
  vaStream: MediaStream | null;
}

export interface PeerUiState {
  isMicOn: boolean;
  isCamOn: boolean;
}

export interface StreamsStoreState {
  chatName: string;
  ownName: string;
  ownAddr: string;
  ownVAStream: MediaStream | null;
  isMicOn: boolean;
  isCamOn: boolean;
  peers: PeerState[];
  peersUiState: Record<string, PeerUiState>;
}

export const useStreamsStore = defineStore('streams', {

  state: () => ({
    peers: [],
    peersUiState: {},
    chatName: '',
    ownName: '',
    ownAddr: '',
    isMicOn: true,
    isCamOn: true,
    ownVAStream: null,
  } as StreamsStoreState),

  getters: {
    isGroupChat: state => state.peers.length > 1,

    isAnyOneConnected: state => !!state.peers.find(p => !!p.vaStream),

    fstPeer: state => state.peers[0],

    fstPeerUiState: state => state.peersUiState[0],

    isOwnAudioAvailable: ({ ownVAStream }) => (ownVAStream ?
      (ownVAStream.getAudioTracks().length > 0) :
      undefined
    ),

    isOwnVideoAvailable: ({ ownVAStream }) => (ownVAStream ?
      (ownVAStream.getVideoTracks().length > 0) :
      undefined
    ),
  },

  actions: {
    setMicOn(val: boolean) {
      this.isMicOn = val;
      this.ownVAStream?.getAudioTracks().forEach(audioTrack => {
        audioTrack.enabled = val;
      });
    },

    setCamOn(val: boolean) {
      this.isCamOn = val;
      this.ownVAStream?.getVideoTracks().forEach(videoTrack => {
        videoTrack.enabled = val;
      });
    },

    setPeerUiState({ user, mic, cam }: { user: string; mic?: 'on' | 'off'; cam?: 'on' | 'off' }) {
      if (mic) {
        set(this.peersUiState, [user, 'isMicOn'], mic === 'on');
      }
      if (cam) {
        set(this.peersUiState, [user, 'isCamOn'], cam === 'on');
      }
    },

    setOwnVAStream(val: MediaStream | null) {
      this.ownVAStream = val;
      this.ownVAStream?.getAudioTracks().forEach(audioTrack => {
        audioTrack.enabled = this.isMicOn;
      });
      this.ownVAStream?.getVideoTracks().forEach(videoTrack => {
        videoTrack.enabled = this.isCamOn;
      });
    },

    getPeer(peerAddr: string) {
      const peer = this.peers.find(p => (p.peerAddr === peerAddr));
      if (!peer) {
        throw new Error(`Peer with address ${peerAddr} not found among ${this.peers.length} peers. Is it exact spelling as is used in chat info?`);
      }
      return peer;
    },
  },
});

export type StreamsStore = ReturnType<typeof useStreamsStore>;
export type Peer = ReturnType<StreamsStore['getPeer']>;
