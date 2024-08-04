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

import { defineStore } from 'pinia'
import { toCanonicalAddress } from './libs/address-utils';
import { computed, shallowRef } from 'vue'
import { WebRTCPeer } from './webrtc-peer';

function makePeerStore(peerAddr: string, peerName: string) {

  const webRTCPeer = shallowRef<WebRTCPeer>()
  const vaStream = shallowRef<MediaStream>()

  return defineStore(`peer:${toCanonicalAddress(peerAddr)}`, () => ({

    addr: peerAddr,

    name: peerName,

    webrtc: computed(() => webRTCPeer.value),

    vaStream: computed(() => vaStream.value),

    setWebRTCPeer(peer: WebRTCPeer): void {
      if (webRTCPeer.value) {
        throw new Error(`WebRTC peer is already set`)
      }
      webRTCPeer.value = peer
      peer.ontrack = ({ track, streams }) => {
        track.onunmute = () => {
          // this assumes that both tracks arrive in the same stream which is
          // attached once
          vaStream.value = streams[0];
        }
      }
    }

  }))
}

export type PeerStoreUseFn = ReturnType<typeof makePeerStore>
export type PeerStore = ReturnType<PeerStoreUseFn>

export const useStreamsStore = defineStore('streams', () => {

  let chat: ChatInfoForCall

  const ownMediaStream = shallowRef<MediaStream>()
  const peerStores = new Map<string, PeerStoreUseFn>()

  return {

    chat: computed(() => chat),

    isGroupChat(): boolean {
      return (peerStores.size > 1)
    },

    setChat(chatInfo: ChatInfoForCall) {
      if (chat) {
        throw new Error(`Chat is already set`)
      }
      chat = chatInfo
      for (const { addr, name } of chat.peers) {
        peerStores.set(toCanonicalAddress(addr), makePeerStore(addr, name))
      }
    },

    ownStream: computed(() => ownMediaStream.value!),

    setOwnStream(s: MediaStream): void {
      ownMediaStream.value = s
    },

    usePeerStore(peerAddr: string): PeerStore {
      const usePeerStore = peerStores.get(toCanonicalAddress(peerAddr))
      if (!chat) {
        throw new Error(`Chat is not set, but start to use peer stores`)
      }
      if (!usePeerStore) {
        throw new Error(`Peer ${peerAddr} is not among chat members`)
      }
      return usePeerStore()
    },

    isAnyOneConnected: computed(() => {
      for (const usePeer of peerStores.values()) {
        const peer = usePeer()
        if (peer.webrtc) {
          return true
        }
      }
      return false
    })

  }
});

