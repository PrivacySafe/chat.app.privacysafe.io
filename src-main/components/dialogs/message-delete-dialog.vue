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
import { ref } from 'vue';
import { Ui3nCheckbox } from '@v1nt1248/3nclient-lib';

const emits = defineEmits(['select']);
const deleteForEveryone = ref(false);

function onFlagChange(val: boolean | string | number) {
  emits('select', val);
}
</script>

<template>
  <div :class="$style.messageDeleteDialog">
    <div :class="$style.messageDeleteDialogText">
      {{ $tr('chat.message.delete.dialog.text') }}
    </div>

    <ui3n-checkbox
      v-model="deleteForEveryone"
      :class="$style.messageDeleteDialogCheckbox"
      @change="onFlagChange"
    >
      {{ $tr('chat.message.delete.dialog.additional') }}
    </ui3n-checkbox>
  </div>
</template>

<style lang="scss" module>
.messageDeleteDialog {
  padding: var(--spacing-l) var(--spacing-m);
}

.messageDeleteDialogText {
  font-size: var(--font-12);
  font-weight: 400;
  line-height: var(--font-16);
  color: var(--color-text-block-primary-default);
  margin-bottom: var(--spacing-s);
}

.messageDeleteDialogCheckbox {
  --ui3n-checkbox-text-weight: 600;
}
</style>
