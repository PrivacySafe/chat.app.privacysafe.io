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
import { WebRTCPeer } from 'src-video/webrtc-peer';
import { setupStateChangesFromPeerEvents } from './peer-state';

export interface StreamsStoreState {
  chatName: string;
  ownName: string;
  ownVAStream: MediaStream|null;
  peers: PeerState[];
}

export interface PeerState {
  peerAddr: string;
  peerName: string;
  vaChannel: WebRTCPeer;
  vaStream: MediaStream|null;
}

export const useStreamsStore = defineStore('streams', {

  state: () => ({
    peers: [],
    chatName: '',
    ownName: '',
    ownVAStream: null
  } as StreamsStoreState),

  getters: {
    isGroupChat: ({ peers }) => (peers.length > 1),
    isAnyOneConnected: ({ peers }) => !!peers.find(p => !!p.vaStream),
    fstPeer: ({ peers }) => peers[0],
  },

  actions: {

    initStoreWithChatInfo(
      chatInfo: ChatInfoForCall, makeVAChannel: (peerAddr: string) => WebRTCPeer
    ): void {
      if (this.ownName) {
        throw new Error(`Chat is already set`);
      }
      const { chatName, ownName, peers } = chatInfo;
      this.chatName = chatName;
      this.ownName = ownName;
      this.peers = peers.map(({ addr: peerAddr, name: peerName }) => {
        const peerState: PeerState = {
          peerAddr,
          peerName,
          vaChannel: makeVAChannel(peerAddr),
          vaStream: null
        };
        // XXX note that some code on bare (not wrapped/proxied) object won't
        //     trigger watches, hence following setup call is done below on
        //     wrapped peer states, that even requires casting
        // setupStateChangesFromPeerEvents(peerState);
        return peerState;
      });
      this.peers.forEach(
        peer => setupStateChangesFromPeerEvents(peer as PeerState)
      );
    },

    sendOwnStreamToPeers() {
      if (!this.ownVAStream) {
        throw new Error(`Own stream is not set`);
      }
      for (const peer of this.peers) {
        peer.vaChannel.sendMediaStream(this.ownVAStream);
      }
    },

  }

});

export type StreamsStore = ReturnType<typeof useStreamsStore>;
