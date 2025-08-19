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
import { computed, onBeforeUnmount, watchEffect } from 'vue';
import { Ui3nIcon } from '@v1nt1248/3nclient-lib';
import VideoPlaceholder from '@video/common/components/video-placeholder.vue';
import VideoStream from "@video/common/components/video-stream.vue";

const props = defineProps<{
  peerName: string;
  peerAddr: string;
  stream: MediaStream;
  isVideoOn: boolean;
  isAudioOn: boolean;
  styleClass?: string|(string|Record<string,boolean>)[]|Record<string,boolean>;
  size?: 'normal' | 'small';
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
  <div :class="$style.peerVideo">
    <video-stream
      v-if="isVideoOn"
      :stream="stream"
    />

    <video-placeholder
      v-else
      :user-name="peerName"
      :width="size === 'small' ? 72 : 144"
    />

    <ui3n-icon
      v-if="!isAudioOn"
      icon="round-mic-off"
      color="var(--color-icon-button-tritery-default)"
      :width="size === 'small' ? 16 : 24"
      :height="size === 'small' ? 16 : 24"
      :class="$style.micIcon"
    />
  </div>
</template>

<style lang="scss" module>
.peerVideo {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--color-bg-control-secondary-default);
  border-radius: var(--spacing-s);
}

.micIcon {
  position: absolute;
  left: calc(50% - var(--spacing-s));
  top: var(--spacing-s);
}

</style>
