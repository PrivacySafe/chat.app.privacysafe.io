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

import { type Ref, computed, ref } from 'vue';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import type { OwnVideoAudio, PeerState } from '@video/common/types';
import { toRO } from '@main/common/utils/readonly.ts';
import { toggleVideoIn, toggleAudioIn } from '@video/common/store/utils/utils.ts';

export function useOwnVideoAudio(peers: Ref<PeerState[]>) {

  const ownVA = ref<Nullable<OwnVideoAudio>>(null);
  const isMicOn = ref(false);
  const isCamOn = ref(false);

  const isOwnAudioAvailable = computed(() => ownVA.value
    ? ownVA.value.stream.getAudioTracks().length > 0
    : undefined,
  );
  const isOwnVideoAvailable = computed(() => ownVA.value
    ? ownVA.value.stream.getVideoTracks().length > 0
    : undefined,
  );

  function setMicOn(val: boolean): void {
    if (isMicOn.value !== val && ownVA.value) {
      isMicOn.value = val;
      toggleAudioIn(ownVA.value.stream, val);
      const streamId = ownVA.value.stream.id;
      peers.value.forEach(({ channel }) => channel.signalOwnStreamState(
        streamId,
        val,
        isCamOn.value,
      ));
    }
  }

  function setCamOn(val: boolean): void {
    if (isCamOn.value !== val && ownVA.value) {
      isCamOn.value = val;
      toggleVideoIn(ownVA.value.stream, val);
      const streamId = ownVA.value.stream.id;
      peers.value.forEach(({ channel }) => channel.signalOwnStreamState(
        streamId,
        isMicOn.value,
        isCamOn.value,
      ));
    }
  }

  function setOwnVAStream(val: Nullable<MediaStream>, videoDevId: Nullable<string>): void {
    if (val) {
      ownVA.value = {
        stream: val,
        deviceId: videoDevId!,
      };
      toggleAudioIn(ownVA.value.stream, isMicOn.value);
      toggleVideoIn(ownVA.value.stream, isCamOn.value);
    } else {
      ownVA.value = null;
    }
  }

  return {
    ownVA: toRO(ownVA),
    isMicOn: toRO(isMicOn),
    isCamOn: toRO(isCamOn),
    isOwnAudioAvailable,
    isOwnVideoAvailable,

    setMicOn,
    setCamOn,
    setOwnVAStream,
  };
}
