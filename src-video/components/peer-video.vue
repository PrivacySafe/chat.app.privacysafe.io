<!--
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
-->

<script lang="ts" setup>
import VideoPlaceholder from '@video/components/video-placeholder.vue';
import VideoStream from "@video/components/video-stream.vue";
import { computed, onBeforeUnmount, watchEffect, HTMLAttributes } from 'vue';

const props = defineProps<{
  peerName: string;
  peerAddr: string;
  stream: MediaStream;
  isVideoOn: boolean;
  isAudioOn: boolean;
  styleClass?: string|(string|Record<string,boolean>)[]|Record<string,boolean>;
}>();

const isAudioOnly = computed(() => (!props.isVideoOn && props.isAudioOn));
let audio: HTMLAudioElement|undefined = undefined;
const onAudioOnlyEffect = watchEffect(() => {
  if (isAudioOnly.value) {
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      audio.srcObject = props.stream;
    }
  } else {
    if (audio) {
      audio.srcObject = null;
      audio = undefined;
    }
  }
});

onBeforeUnmount(() => {
  onAudioOnlyEffect.stop();
  if (audio) {
    audio.pause();
    audio.srcObject = null;
    audio = undefined;
  }
});

</script>

<template>
  <div
    :class="[
      ...(Array.isArray(styleClass) ?
        styleClass : (styleClass ? [ styleClass ] : [])
      )
    ]"
  >
    <video-stream
      v-if="isVideoOn"
      :stream=stream
      :styleClass=$style.rounded
    />
    <video-placeholder
      v-else
      :userName=peerName
    />

    <ui3n-icon
      v-if="!isAudioOn"
      icon="round-mic-off"
      icon-color="var(--color-icon-button-tritery-default)"
      width="24"
      height="24"
      :class="$style.micIcon"
    />

  </div>
</template>

<style lang="scss" module>

.rounded {
  border-radius: var(--spacing-s);
}

.micIcon {
  position: absolute;
  left: var(--spacing-s);
  top: var(--spacing-s);
}

</style>