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
import { Ui3nChip, Ui3nIcon } from '@v1nt1248/3nclient-lib';

defineProps<{
  name: string;
  size: number;
  deletable?: boolean;
}>();

const emits = defineEmits(['delete']);
</script>

<template>
  <ui3n-chip
    class="chat-attachment"
    closeable
    @close="emits('delete')"
  >
    <template #left>
      <ui3n-icon
        icon="round-attach-file"
        width="12"
        height="12"
      />
    </template>
    {{ name }}
  </ui3n-chip>
</template>

<style lang="scss" module>
.chatAttachment {
  --chip-default-color: var(--color-icon-chat-bubble-user-default);

  margin: 0 var(--spacing-xs) var(--spacing-xs) 0;
  cursor: pointer;
}
</style>
