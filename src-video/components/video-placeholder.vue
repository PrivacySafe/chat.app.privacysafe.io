<!--
 Copyright (C) 2024 3NSoft Inc.

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
import ChatAvatar from '@main/components/chat/chat-avatar.vue';

interface VideoPlaceholderProps {
  userName: string;
  width?: number | string;
}

withDefaults(defineProps<VideoPlaceholderProps>(), {
  width: 144,
})
</script>

<template>
  <div :class="$style.videoPlaceholder">
    <chat-avatar
      :size="width"
      :name="userName ?? ' '"
    />

    {{ userName }}
  </div>
</template>

<style lang="scss" module>
.videoPlaceholder {
  max-width: 100%;
  max-height: 100%;
  position: relative;
  width: max-content;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  row-gap: var(--spacing-s);
  font-size: var(--font-16);
  font-weight: 500;
  color: var(--color-text-control-primary-default);
  transform: none;
}
</style>
