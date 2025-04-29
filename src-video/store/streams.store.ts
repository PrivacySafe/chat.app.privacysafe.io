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
import { computed, ref, Ref } from 'vue';
import { PeerState, makePeerState, usePeerFuncs } from './peer';
import { videoChatSrv } from '@video/services/video-component-srv';
import { PeerChannelWithStreams } from '@video/services/streaming-channel';
import { useOwnVideoAudio } from './own-video-audio';
import { useOwnScreenShare } from './own-screen-share';
import { toRO } from '@main/utils/readonly';

export type { StreamType } from './peer';

export const useStreamsStore = defineStore('streams', () => {

  const peers = ref<PeerState[]>([]);
  const chatName = ref('');
  const ownName = ref('');
  const ownAddr = ref('');

  function initialize(
    chatNom: string, ownNom: string, ownAddress: string,
    otherPeers: { addr: string, name: string }[],
    makePeerChannel: (peerAddr: string) => PeerChannelWithStreams
  ): void {
    chatName.value = chatNom;
    ownName.value = ownNom;
    ownAddr.value = ownAddress;
    peers.value = otherPeers.map(({
      addr: peerAddr, name: peerName
    }) => makePeerState(
      peerAddr, peerName, makePeerChannel(peerAddr)
    ));
  }

  const isGroupChat = computed(() => (peers.value.length > 1));
  const isAnyOneConnected = computed(
    () => !!peers.value.find(p => p.webRTCConnected)
  );
  const singlePeer = computed(() => {
    if (isGroupChat.value) {
      throw new Error(`This is a group chat. Use address based access`);
    }
    return peers.value[0];
  });

  function getPeer(peerAddr: string) {
    const peer = peers.value.find(p => (p.peerAddr === peerAddr));
    if (!peer) {
      throw new Error(`Peer with address ${peerAddr} not found among ${peers.value.length} peers. Is it exact spelling as is used in chat info?`);
    }
    return peer as PeerState;
  }

  const ownVideoAudio = useOwnVideoAudio(peers as Ref<PeerState[]>);
  const ownScreenShare = useOwnScreenShare(peers as Ref<PeerState[]>);
  const { ownVA } = ownVideoAudio;

  function startCall() {
    if (!ownVA.value) {
      throw new Error(`Own stream is not set`);
    }
    const connectingProcs = peers.value.map(
      peer => peer.channel.connect().then(() => {
        peer.channel.sendUserMediaStream(ownVA.value!.stream);
      }, noop)
    );
    videoChatSrv.notifyBkgrndInstanceOnCallStart();
  }
  

  return {
    peers,
    chatName: toRO(chatName),
    ownName: toRO(ownName),
    ownAddr: toRO(ownAddr),

    initialize,

    ...ownVideoAudio,
    ...ownScreenShare,

    isGroupChat,
    isAnyOneConnected,
    singlePeer,

    startCall,

    getPeer,

    ...usePeerFuncs(getPeer)
  };
});

function noop() {}

export type StreamsStore = ReturnType<typeof useStreamsStore>;
export type Peer = ReturnType<StreamsStore['getPeer']>;
