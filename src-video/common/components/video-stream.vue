<!--
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
-->

<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue';

const { stream, isStreamOwn, muted } = defineProps<{
  stream: MediaStream|Promise<MediaStream>;
  isStreamOwn?: boolean;
  muted?: boolean;
}>();

const videoTag = useTemplateRef<HTMLVideoElement>('video-tag');

onMounted(async () => {
  if ((stream as Promise<MediaStream>).then) {
    videoTag.value!.srcObject = await stream;
  } else {
    videoTag.value!.srcObject = stream as MediaStream;
  }
});

</script>

<template>
  <video
    ref="video-tag"
    :class="[$style.video, isStreamOwn && $style.mirrorFlip]"
    playsinline
    autoplay
    :muted="muted"
  />
</template>

<style lang="scss" module>
.video {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-control-secondary-default);
  border-radius: var(--spacing-s);
}

.mirrorFlip {
  transform: rotateY(180deg);
}
</style>
