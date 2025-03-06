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

const {
  user, stream, isCamOn, styleClass
} = defineProps<{
  user: string;
  stream: MediaStream;
  isCamOn: boolean;
  styleClass?: string|string[];
}>();

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
      v-if="isCamOn"
      :stream=stream
      :muted=true
      :styleClass="[ $style.mirrorFlip, $style.rounded ]"
    />
    <video-placeholder
      v-else
      :userName=user
    />
  </div>  
</template>

<style lang="scss" module>

.mirrorFlip {
  transform: rotateY(180deg);
}

.rounded {
  border-radius: var(--spacing-s);
}

</style>