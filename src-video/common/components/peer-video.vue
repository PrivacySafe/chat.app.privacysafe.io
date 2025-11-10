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
  stream: MediaStream | Promise<MediaStream> | undefined;
  isVideoOn: boolean;
  isAudioOn: boolean;
  styleClass?: string|(string|Record<string,boolean>)[]|Record<string,boolean>;
  size?: 'normal' | 'small';
}>();

const sizeCss = computed(() => props.size === 'small' ? '16px' : '24px');

const isAudioOnly = computed(() => (!props.isVideoOn && props.isAudioOn));

let audio: HTMLAudioElement | undefined = undefined;

const onAudioOnlyEffect = watchEffect(() => {
  if (isAudioOnly.value) {
    if (!audio) {
      audio = new Audio();
      audio.autoplay = true;
      audio.srcObject = props.stream as MediaStream;
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

    <div
      v-if="!isAudioOn"
      :class="$style.micOff"
    >
      <ui3n-icon
        icon="round-mic-off"
        color="var(--color-icon-chat-bubble-other-selected)"
        :width="size === 'small' ? 16 : 24"
        :height="size === 'small' ? 16 : 24"
      />
    </div>
  </div>
</template>

<style lang="scss" module>
.peerVideo {
  --peer-icon-size: v-bind(sizeCss);
  --peer-icon-wrap-size: calc(var(--peer-icon-size) * 1.25);

  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--color-bg-control-secondary-default);
  border-radius: var(--spacing-s);
}

.micOff {
  position: absolute;
  right: calc(var(--peer-icon-wrap-size) / 4);
  top: calc(var(--peer-icon-wrap-size) / 4);
  width: var(--peer-icon-wrap-size);
  height: var(--peer-icon-wrap-size);
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: var(--color-bg-block-tritery-default);
}
</style>
