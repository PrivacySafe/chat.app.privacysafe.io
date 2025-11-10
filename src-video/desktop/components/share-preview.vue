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
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue';
import { Ui3nSwitch } from '@v1nt1248/3nclient-lib';
import type { ScreenShareOption, WindowShareOption } from '@video/common/types';

const props = defineProps<{
  opts: ScreenShareOption | WindowShareOption;
}>();
const emit = defineEmits(['selected']);

const name = computed(() => props.opts.name);
const thumbnailURL = computed(() => props.opts.thumbnailURL);
const stream = computed(() => props.opts.stream);
const appIconURL = computed(() => (props.opts as WindowShareOption)?.appIconURL);

const videoTag = useTemplateRef<HTMLVideoElement>('video-tag');
const selected = ref(props.opts.initiallySelected);
const streamIsAttached = ref(false);

onMounted(async () => {
  videoTag.value!.srcObject = await stream.value;
  streamIsAttached.value = true;
});

onBeforeUnmount(async () => {
  if (!selected.value) {
    (await stream.value).getTracks().forEach(track => track.stop());
  }
});
</script>

<template>
  <div :class="$style.sharePreview">
    <video
      v-show="!!streamIsAttached"
      ref="video-tag"
      :class="$style.videoPreview"
      playsinline
      autoplay
      muted
    />

    <img
      v-show="!streamIsAttached"
      :src="thumbnailURL"
      alt="thumbnail url"
    >

    <div :class="$style.action">
      <ui3n-switch
        v-model="selected"
        size="24"
        @change="(v: boolean) => emit('selected', v)"
      />

      <div :class="$style.text">
        <img
          v-if="appIconURL"
          :class="$style.appIcon"
          :src="appIconURL"
          alt="app icon"
        >

        <span>{{ name }}</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
@use '@main/common/assets/styles/mixins' as mixins;

.sharePreview {
  position: relative;
  width: 100%;
  height: 100%;
  padding-bottom: var(--spacing-xl);
  background-color: var(--color-bg-chat-bubble-general-bg);
  color: var(--color-text-block-primary-default);
}

.videoPreview {
  position: relative;
  width: 100%;
  height: 100%;
}

.action {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: var(--spacing-xl);
  padding: 0 var(--spacing-s);
  display: flex;
  justify-content: flex-start;
  align-items: center;
  column-gap: var(--spacing-s);
  overflow: hidden;
}

.text {
  display: flex;
  width: calc(100% - var(--spacing-xl) - var(--spacing-s));
  justify-content: flex-start;
  align-items: center;
  column-gap: var(--spacing-s);

  .appIcon {
    width: var(--spacing-m);
    height: var(--spacing-m);
  }

  span {
    display: block;
    height: var(--spacing-m);
    line-height: var(--spacing-m);
    @include mixins.text-overflow-ellipsis();
  }
}
</style>
