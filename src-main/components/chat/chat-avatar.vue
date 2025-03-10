<!--
 Copyright (C) 2020 - 2024 3NSoft Inc.

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
import { computed, onMounted, ref } from 'vue';
import isEmpty from 'lodash/isEmpty';
import { getElementColor } from '@v1nt1248/3nclient-lib/utils';

const props = defineProps<{
  name: string;
  size?: number | string;
  shape?: 'circle' | 'box' | 'octagon' | 'decagon' | 'dodecagon' | undefined;
}>();

const shapes = {
  circle: 'circle(50% at 50% 50%)',
  box: 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)',
  octagon: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
  decagon: 'polygon(100.00% 50.00%,90.45% 79.39%,65.45% 97.55%,34.55% 97.55%,9.55% 79.39%,0.00% 50.00%,9.55% 20.61%,34.55% 2.45%,65.45% 2.45%,90.45% 20.61%)',
  dodecagon: 'polygon(100.00% 50.00%,93.30% 75.00%,75.00% 93.30%,50.00% 100.00%,25.00% 93.30%,6.70% 75.00%,0.00% 50.00%,6.70% 25.00%,25.00% 6.70%,50.00% 0.00%,75.00% 6.70%,93.30% 25.00%)',
};

const avatarElement = ref<HTMLDivElement | null>(null);

const clipPathValue = computed(() => {
  if (!props.shape) {
    return shapes.circle;
  }

  const value = shapes[props.shape];
  return value || shapes.circle;
});

const letters = computed<string>(() => {
  if (isEmpty(props.name)) {
    return '';
  }

  return props.name.length === 1
    ? props.name.toLocaleUpperCase()
    : `${props.name[0].toLocaleUpperCase()}${props.name[1].toLocaleLowerCase()}`;
});

const mainStyle = computed<Record<string, string>>(() => {
  return {
    '--clip-path-value': clipPathValue.value,
    backgroundColor: getElementColor(letters.value || '?'),
  };
});

onMounted(() => {
  if (avatarElement.value) {
    const avatarSize = Number(props.size || 36);
    avatarElement.value!.style.setProperty('--chat-avatar-size', `${avatarSize}px`);
  }
});
</script>

<template>
  <div
    ref="avatarElement"
    :class="$style.chatAvatar"
    :style="mainStyle"
  >
    {{ letters }}
  </div>
</template>

<style lang="scss" module>
.chatAvatar {
  --chat-avatar-size: calc(var(--spacing-s) * 4.5);
  --chat-avatar-text-size: calc(var(--chat-avatar-size) * 0.4);

  -webkit-font-smoothing: antialiased;
  min-height: var(--chat-avatar-size);
  height: var(--chat-avatar-size);
  min-width: var(--chat-avatar-size);
  width: var(--chat-avatar-size);
  position: relative;
  clip-path: var(--clip-path-value);
  color: var(--color-text-avatar-primary-default);
  font-size: var(--chat-avatar-text-size);
  font-weight: 600;
  line-height: 1;
  z-index: 1;
  pointer-events: none;
  user-select: none;
  text-shadow: 2px 2px 5px var(--grey-70);
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
