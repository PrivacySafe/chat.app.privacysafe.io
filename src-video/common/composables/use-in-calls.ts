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

import { computed, inject, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { I18N_KEY, DIALOGS_KEY, VUEBUS_KEY, VueBusPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { useAppStore } from '@video/common/store/app.store.ts';
import { useStreamsStore } from '@video/common/store/streams.store.ts';
import type { PeerEvents } from '@video/common/types/events.ts';
import ScreenShareChoiceDialog
  from '@video/desktop/components/dialogs/screen-share-choice-dialog/screen-share-choice-dialog.vue';
import type { SharedStream } from '@video/common/types';

export function useInCalls() {
  const { $emitter } = inject<VueBusPlugin<PeerEvents>>(VUEBUS_KEY)!;
  const { $tr } = inject(I18N_KEY)!;
  const dialog = inject(DIALOGS_KEY)!;

  const { user: ownName } = useAppStore();
  const streams = useStreamsStore();
  const { isGroupChat, peers, ownScreens, isSharingOwnDeskSound } = storeToRefs(streams);
  const { handlePeerDisconnected, endCall, removeOwnScreen, addOwnScreen, setOwnDeskSoundSharing } = streams;

  const isFullscreen = ref(false);

  const peerVideos = computed(
    () => peers.value.map(({ peerAddr, peerName }, i) => ({
      peerAddr,
      peerName,
      vaStream: streams.getPeerStreams(peerAddr, 'camera+mic')![0],
      videoMuted: !peers.value[i].isCamOn,
      audioMuted: !peers.value[i].isMicOn,
    })),
  );

  const peerSharedStreams = computed(
    () => peers.value.flatMap(({ peerAddr, peerName }) => [
      ...streams.getPeerStreams(peerAddr, 'screen'),
      ...streams.getPeerStreams(peerAddr, 'window'),
    ].map(stream => ({ peerAddr, peerName, stream }))),
  );

  function toggleMicStatus() {
    streams.setMicOn(!streams.isMicOn);
  }

  function toggleCamStatus() {
    streams.setCamOn(!streams.isCamOn);
  }

  async function endCallWhenPeerCloses({ peerAddr }: { peerAddr: string }) {
    await handlePeerDisconnected(peerAddr);
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

  function openScreenShareChoice() {
    dialog.$openDialog<typeof ScreenShareChoiceDialog>({
      component: ScreenShareChoiceDialog,
      componentProps: {
        initiallyShared: ownScreens.value ? ownScreens.value.concat() : [],
        initialDeskSoundShared: isSharingOwnDeskSound.value,
      },
      dialogProps: {
        title: $tr('sharing.choice.title'),
        cssStyle: {
          width: '95%',
          height: '95%',
        },
        closeOnClickOverlay: false,
        onConfirm: (data: unknown) => {
          if (!data) {
            return;
          }

          const { selected, selectedDeskSound } = data as { selected: SharedStream[]; selectedDeskSound: boolean };
          // unshare those not among selected
          ownScreens.value
            ?.filter(({ srcId }) => !selected.find(s => (s.srcId === srcId)))
            .forEach(({ srcId }) => removeOwnScreen(srcId));
          // add selected if not already shared
          for (const { srcId, stream, type, name } of selected) {
            if (!ownScreens.value?.find(s => (s.srcId === srcId))) {
              addOwnScreen(stream, type, srcId, name);
            }
          }
          setOwnDeskSoundSharing(ownScreens.value ? selectedDeskSound : false);
        },
      },
    });
  }

  function doOnMounted() {
    document.addEventListener('fullscreenchange', fullscreenchangeHandler);

    $emitter.on('peer:disconnected', endCallWhenPeerCloses);
  }

  function doBeforeUnmount() {
    document.removeEventListener('fullscreenchange', fullscreenchangeHandler);

    $emitter.off('peer:disconnected', endCallWhenPeerCloses);
  }

  return {
    ownName,
    isGroupChat,
    isFullscreen,
    streams,
    peerVideos,
    peerSharedStreams,
    toggleMicStatus,
    toggleCamStatus,
    toggleFullscreen,
    openScreenShareChoice,
    endCall,
    doOnMounted,
    doBeforeUnmount,
  };
}
