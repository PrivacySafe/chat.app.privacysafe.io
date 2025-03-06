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

import { computed, inject, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { VUEBUS_KEY, VueBusPlugin, type VueEventBus } from '@v1nt1248/3nclient-lib/plugins';
import { useAppStore } from '@video/store/app';
import { useStreamsStore } from '@video/store/streams';
import type { PeerEvents } from '@video/services/events';
import { screenSharingChoiceDialogMaker } from '@video/views/dialogs/sharing-choice-dialog';

export function useCommonCallElements() {
  const appStore = useAppStore();
  const ownName = appStore.user;
  const streams = useStreamsStore();
  const { peers } = storeToRefs(streams);
  // const $emitter = inject<VueBusPlugin<PeerEvents>>(VUEBUS_KEY)!.$emitter as VueEventBus<PeerEvents>;

  const isFullscreen = ref(false);

  const peerVideos = computed(
    () => peers.value.map(({ peerAddr, peerName }, i) => ({
      peerAddr,
      peerName,
      vaStream: streams.getStreams(peerAddr, 'camera+mic')![0],
      videoMuted: !peers.value[i].isCamOn,
      audioMuted: !peers.value[i].isMicOn
    }))
  );

  const peerSharedStreams = computed(
    () => peers.value.flatMap(({ peerAddr, peerName }) => [
      ...streams.getStreams(peerAddr, 'screen'),
      ...streams.getStreams(peerAddr, 'window')
    ].map(stream => ({ peerAddr, peerName, stream })))
  );

  function toggleMicStatus() {
    streams.setMicOn(!streams.isMicOn);
  }

  function toggleCamStatus() {
    streams.setCamOn(!streams.isCamOn);
  }

  function fullscreenchangeHandler() {
    isFullscreen.value = !!document.fullscreenElement;
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  }

  onMounted(() => {
    document.addEventListener('fullscreenchange', fullscreenchangeHandler);
  });

  onBeforeUnmount(() => {
    document.removeEventListener('fullscreenchange', fullscreenchangeHandler);
  });

  return {
    ownName,
    isFullscreen,
    streams,
    peerVideos,
    peerSharedStreams,
    toggleMicStatus,
    toggleCamStatus,
    toggleFullscreen,
    openScreenShareChoice: screenSharingChoiceDialogMaker()
  };
}

export function useCall() {
  const streams = useStreamsStore();
  const { singlePeer: peer } = storeToRefs(streams);
  const $emitter = inject<VueBusPlugin<PeerEvents>>(VUEBUS_KEY)!.$emitter as VueEventBus<PeerEvents>;

  async function endCall() {
    await peer.value.channel.close();
    w3n.closeSelf();
  }

  async function endCallWhenPeerCloses() {
    w3n.closeSelf();
  }

  $emitter.on('peer:disconnected', ({ peerAddr }) => {
    if (peer.value.peerAddr === peerAddr) {
      endCallWhenPeerCloses();
    }
  });

  onMounted(() => {
    // document.addEventListener('fullscreenchange', fullscreenchangeHandler);
  });

  onBeforeUnmount(() => {
    // document.removeEventListener('fullscreenchange', fullscreenchangeHandler);
  });

  return {
    endCall
  };
}

export function useGroupCall() {
  const streams = useStreamsStore();
  const { peers } = storeToRefs(streams);
  // const $emitter = inject<VueBusPlugin<PeerEvents>>(VUEBUS_KEY)!.$emitter as VueEventBus<PeerEvents>;

  async function endCall() {
    await Promise.all(peers.value.map(
      ({ channel }) => channel.close().catch(err => console.error(err))
    ));
    w3n.closeSelf();
  }

  // $emitter.on('peer:disconnected', ({ peerAddr }) => {
  //   if (peer.value.peerAddr === peerAddr) {
  //     endCallWhenPeerCloses();
  //   }
  // });

  onMounted(() => {
    // document.addEventListener('fullscreenchange', fullscreenchangeHandler);
  });

  onBeforeUnmount(() => {
    // document.removeEventListener('fullscreenchange', fullscreenchangeHandler);
  });

  return {
    endCall,
  };
}
