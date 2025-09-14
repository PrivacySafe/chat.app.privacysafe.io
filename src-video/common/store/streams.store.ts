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
import { computed, ref, type Ref } from 'vue';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { toRO } from '@main/common/utils/readonly';
import { usePeerFuncs } from './utils/peer';
import { makePeerState } from './utils/utils';
import { useOwnVideoAudio } from './utils/own-video-audio';
import { useOwnScreenShare } from './utils/own-screen-share';
import { areAddressesEqual } from '@shared/address-utils';
import { useAppStore } from '@video/common/store/app.store';
import { videoChatSrv } from '@video/common/services/service-provider';
import { PeerChannelWithStreams } from '@video/common/services/streaming-channel';
import type { PeerState } from '@video/common/types';
import type { ChatIdObj } from '~/asmail-msgs.types';
import { generateChatMessageId } from '@shared/chat-ids';
import { isEmpty } from 'lodash';

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {
}

export const useStreamsStore = defineStore('streams', () => {
  const appStore = useAppStore();

  const peers = ref<PeerState[]>([]);
  const chatObjId = ref<Nullable<ChatIdObj>>(null);
  const chatName = ref('');
  const ownName = ref('');
  const ownAddr = ref('');

  function initialize(
    chatId: ChatIdObj,
    chatNom: string,
    ownNom: string,
    ownAddress: string,
    otherPeers: { addr: string, name: string }[],
    makePeerChannel: (peerAddr: string) => PeerChannelWithStreams,
  ): void {
    chatObjId.value = chatId;
    chatName.value = chatNom;
    ownName.value = ownNom;
    ownAddr.value = ownAddress;
    peers.value = otherPeers.map(({ addr: peerAddr, name: peerName }) => makePeerState(
      peerAddr, peerName, makePeerChannel(peerAddr),
    ));
  }

  const isGroupChat = computed(() => chatObjId.value?.isGroupChat);
  const isAnyOneConnected = computed(
    () => !!peers.value.find(p => p.webRTCConnected),
  );
  const singlePeer = computed(() => peers.value[0]);

  function getPeer(peerAddr: string) {
    const peer = peers.value.find(p => areAddressesEqual(p.peerAddr, peerAddr));
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

    Promise.allSettled(peers.value.map(
      peer => peer.channel.connect().then(() => {
        peer.channel.sendUserMediaStream(ownVA.value!.stream);
      }, noop),
    ));

    videoChatSrv.notifyBkgrndInstanceOnCallStart();
  }

  async function endCall(withoutSendSystemMsg?: boolean) {
    const { chatMessageId } = generateChatMessageId();

    const whoToSendSystemMessageTo = isGroupChat.value
      ? peers.value.filter(p => !p.webRTCConnected)
      : [singlePeer.value].filter(p => !p.webRTCConnected);

    if (isGroupChat.value) {
      await Promise.allSettled(
        peers.value.map(({ channel }) => channel.close().catch(err => console.error(err)),
        ));
    } else {
      await singlePeer.value.channel.close();
    }

    if (!isEmpty(whoToSendSystemMessageTo) && !withoutSendSystemMsg) {
      videoChatSrv.sendSystemWebRTCMsg({
        chatId: chatObjId.value!,
        recipients: whoToSendSystemMessageTo.map(p => p.peerAddr),
        chatMessageId,
        chatSystemData: {
          event: 'webrtc-call',
          value: {
            subType: 'outgoing-call-cancelled',
            sender: appStore.user!,
            chatId: chatObjId.value!,
          },
        },
      });
    }

    w3n.closeSelf();
  }

  async function handlePeerDisconnected(peerAddr: string): Promise<void> {
    const peer = getPeer(peerAddr);
    if (!peer) {
      await endCall(true);
    }

    if (!peer?.webRTCConnected) {
      peers.value = peers.value.filter(peer => peer.peerAddr !== peerAddr);
      !isGroupChat.value && w3n.closeSelf();
      return;
    }

    await peer.channel?.close();
    peers.value = peers.value.filter(peer => peer.peerAddr !== peerAddr);
    !isGroupChat.value && w3n.closeSelf();
  }

  return {
    peers,
    chatName: toRO(chatName),
    ownName: toRO(ownName),
    ownAddr: toRO(ownAddr),

    isGroupChat,
    chatObjId,
    isAnyOneConnected,
    singlePeer,

    initialize,
    startCall,
    endCall,
    getPeer,
    ...usePeerFuncs(getPeer),
    ...ownVideoAudio,
    ...ownScreenShare,
    handlePeerDisconnected,
  };
});

export type StreamsStore = ReturnType<typeof useStreamsStore>;
export type Peer = ReturnType<StreamsStore['getPeer']>;
