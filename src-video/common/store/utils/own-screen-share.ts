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

import { type Ref, ref } from 'vue';
import { toggleAudioIn } from '@video/common/store/utils/utils.ts';
import { toRO } from '@main/common/utils/readonly.ts';
import type { PeerState, OwnScreen } from '@video/common/types';

export function useOwnScreenShare(peers: Ref<PeerState[]>) {

  const ownScreens = ref<OwnScreen[] | null>(null);
  const ownDeskSound = ref(false);

  function setOwnDeskSoundSharing(val: boolean) {
    if (val) {
      if (!ownScreens.value) {
        throw new Error(`Can't share desk audio, when no screens shared`);
      }
      toggleAudioIn(ownScreens.value[0].stream, true);
    } else {
      if (ownScreens.value) {
        toggleAudioIn(ownScreens.value[0].stream, false);
      }
    }
    ownDeskSound.value = val;
  }

  function addOwnScreen(
    stream: MediaStream,
    type: OwnScreen['type'],
    srcId: string,
    name: string,
    startSendingToPeers = true,
  ) {
    toggleAudioIn(stream, false);
    if (!ownScreens.value) {
      ownScreens.value = [];
    }
    ownScreens.value.push({ stream, type, srcId, name });
    if (startSendingToPeers) {
      for (const { channel } of peers.value) {
        if (channel.isConnected) {
          channel.sendScreenMediaStream(type, stream);
        }
      }
    }
  }

  function removeOwnScreen(srcId: string, stopSendingToPeers = true) {
    if (!ownScreens.value) {
      return;
    }

    const ind = ownScreens.value.findIndex(info => (info.srcId === srcId));
    if (ind < 0) {
      return;
    }

    const { stream } = ownScreens.value[ind];
    const sendOtherShareSound = ownDeskSound.value && ind === 0;

    ownScreens.value.splice(ind, 1);
    if (ownScreens.value.length === 0) {
      ownScreens.value = null;
      ownDeskSound.value = false;
    }

    if (stopSendingToPeers) {
      for (const { channel } of peers.value) {
        if (channel.isConnected) {
          channel.stopSendingStream(stream);
        }
      }
    }

    if (sendOtherShareSound && ownScreens.value) {
      toggleAudioIn(ownScreens.value[0].stream, true);
    }
  }

  return {
    ownScreens: toRO(ownScreens),
    isSharingOwnDeskSound: toRO(ownDeskSound),

    setOwnDeskSoundSharing,
    addOwnScreen,
    removeOwnScreen,
  };
}
