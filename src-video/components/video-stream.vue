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
import { onMounted, shallowRef } from 'vue';

const { stream, muted, styleClass } = defineProps<{
  stream: MediaStream|Promise<MediaStream>;
  muted?: boolean;
  styleClass?: string|string[];
}>();

const videoTag = shallowRef<HTMLVideoElement>();

onMounted(async () => {
  if ((stream as Promise<any>).then) {
    videoTag.value!.srcObject = await stream;
  } else {
    videoTag.value!.srcObject = stream as MediaStream;
  }
});

</script>

<template>
  <video
    ref="videoTag"
    :class="[
      $style.video,
      ...(Array.isArray(styleClass) ?
        styleClass : (styleClass ? [ styleClass ] : [])
      )
    ]"
    playsinline
    autoplay
    :muted=muted
  />
</template>

<style lang="scss" module>

.video {
  max-width: 100%;
  max-height: 100%;
  background-color: var(--color-bg-control-secondary-default);
}

</style>
