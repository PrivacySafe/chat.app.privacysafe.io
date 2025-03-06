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
import { Ui3nSwitch } from '@v1nt1248/3nclient-lib';
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { ScreenShareOption, WindowShareOption } from './types';

const emit = defineEmits([ 'selected' ]);

const props = defineProps<{
  opts: ScreenShareOption | WindowShareOption;
}>();
const {
  srcId, name, thumbnailURL, stream, display_id, appIconURL, initiallySelected
} = props.opts as ScreenShareOption & WindowShareOption;

const selected = ref(initiallySelected);

const videoTag = shallowRef<HTMLVideoElement>();
const streamIsAttached = ref(false);

onMounted(async () => {
  videoTag.value!.srcObject = await stream;
  streamIsAttached.value = true;
});

onBeforeUnmount(async () => {
  if (!selected.value) {
    (await stream).getTracks().forEach(track => track.stop());
  }
});

</script>

<template>
  <div>
    <video :class=$style.videoPreview
      v-show="!!streamIsAttached"
      ref="videoTag"
      playsinline
      autoplay
      muted
    ></video>
    <img
      v-show="!streamIsAttached"
      :src=thumbnailURL
    />
    <br>
    <ui3n-switch :class=$style.inline
      v-model=selected
      size="24"
      @change="v => emit('selected', v)"
    />
    <img :class=$style.appIcon
      v-if=appIconURL
      :src=appIconURL
    />
    {{ name }}
  </div>
</template>

<style lang="scss" module>
.appIcon {
  width: 1em;
  height: 1em;
}

.videoPreview {
  max-width: 300px;
  max-height: 300px;
}

.inline {
  display: inline-block;
}

</style>
