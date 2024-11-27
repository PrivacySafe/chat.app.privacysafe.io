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
import { computed } from 'vue';
import { Ui3nIcon } from '@v1nt1248/3nclient-lib';
import { messageDeliveryStatuses } from '@main/constants';
import type { MessageDeliveryStatus } from '~/index';

const props = defineProps<{
  value: MessageDeliveryStatus | undefined;
  iconSize?: number | string;
}>();

const iconSize = computed(() => {
  const isSizeNotNumber = isNaN(Number(props.iconSize));
  return isSizeNotNumber ? 16 : Number(props.iconSize);
});

const statusUiInfo = computed(() => {
  if (props.value) {
    return messageDeliveryStatuses[props.value] || null;
  }
  return null;
});
</script>

<template>
  <ui3n-icon
    v-if="statusUiInfo"
    :icon="statusUiInfo.icon"
    :width="iconSize"
    :height="iconSize"
    :color="statusUiInfo.color"
  />
</template>
