/*
Copyright (C) 2025 3NSoft Inc.

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
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { transformWeb3nFileToFile } from '@v1nt1248/3nclient-lib/utils';
import type { AttachmentViewInfo } from '@main/common/components/messages/chat-message/chat-message-attachments/types';
import { timeInSecondsToString } from '@main/common/utils/chat-ui.helper';
import { getFileByInfoFromMsg } from '@main/common/utils/files.helper';
import type { AttachmentVideoViewEmits } from './attachment-video-view.vue';

export function useVideoView(
  { item, incomingMsgId, emits }:
  { item: AttachmentViewInfo; incomingMsgId?: string; emits: AttachmentVideoViewEmits }
) {
  const videoPlayerRef = useTemplateRef<HTMLVideoElement>('videoEl');
  const isProcessing = ref(true);
  const isPlaying = ref(false);
  const duration = ref(0);
  const currentTime = ref(0);
  const volume = ref(50);

  const durationAsText = computed(() => timeInSecondsToString(duration.value));
  const currentTimeAsText = computed(() => timeInSecondsToString(currentTime.value));

  function onCanplaythrough() {
    isProcessing.value = false;
    duration.value = videoPlayerRef.value!.duration;
  }

  function onTimeupdate(event: Event) {
    currentTime.value = (event.target as HTMLVideoElement).currentTime;
  }

  function onEnded() {
    isPlaying.value = false;
    currentTime.value = 0;
    videoPlayerRef.value!.currentTime = 0;
  }

  function play() {
    videoPlayerRef.value!.play();
    isPlaying.value = true;
  }

  function pause() {
    videoPlayerRef.value!.pause();
    isPlaying.value = false;
  }

  function updateVolume(val: number | [number, number]) {
    if (!Array.isArray(val)) {
      volume.value = val;
      videoPlayerRef.value!.volume = (val || 0) / 100;
    }
  }

  function updateCurrentTime(val: number | [number, number]) {
    if (!Array.isArray(val)) {
      currentTime.value = val;
      videoPlayerRef.value!.currentTime = val;
    }
  }

  onMounted(() => {
    videoPlayerRef.value!.currentTime = 0;
    videoPlayerRef.value!.volume = volume.value / 100;

    videoPlayerRef.value!.addEventListener('canplaythrough', onCanplaythrough);
    videoPlayerRef.value!.addEventListener('timeupdate', onTimeupdate);
    videoPlayerRef.value!.addEventListener('ended', onEnded);

    setTimeout(() => {
      getFileByInfoFromMsg(item.id!, incomingMsgId)
        .then(file3n => {
          if (!file3n) {
            isProcessing.value = false;
            emits('error');
            return;
          }

          return transformWeb3nFileToFile(file3n as web3n.files.ReadonlyFile);
        })
        .then(val => {
          if (!val) {
            return;
          }

          const mediaData = URL.createObjectURL(val);
          videoPlayerRef.value!.src = mediaData;
        })
        .finally(() => {
          isProcessing.value = false;
        });
    }, 100);
  });

  onBeforeUnmount(() => {
    videoPlayerRef.value!.removeEventListener('canplaythrough', onCanplaythrough);
    videoPlayerRef.value!.removeEventListener('timeupdate', onTimeupdate);
    videoPlayerRef.value!.addEventListener('ended', onEnded);
  });

  return {
    isProcessing,
    isPlaying,
    videoPlayerRef,
    currentTime,
    duration,
    volume,
    currentTimeAsText,
    durationAsText,
    updateVolume,
    updateCurrentTime,
    play,
    pause,
  };
}
