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
import { Ui3nButton } from '@v1nt1248/3nclient-lib';

const { icon, styleClass, disabled } = defineProps<{
  icon: string;
  styleClass?: string|string[];
  disabled?: boolean;
}>();

const emits = defineEmits([ 'click', 'focus', 'blur' ]);

</script>

<template>
  <ui3n-button
    type="custom"
    color="var(--color-bg-button-tritery-default)"
    :icon=icon
    icon-color="var(--color-icon-button-tritery-default)"
    :class="[
      $style.btn,
      ...(Array.isArray(styleClass) ?
        styleClass : (styleClass ? [ styleClass ] : [])
      )
    ]"
    :disabled=disabled
    @click="emits('click', $event)"
    @focusin="emits('focus', $event)"
    @focusout="emits('blur', $event)"
  />
</template>

<style lang="scss" module>

.btn {
  padding: 0 var(--spacing-s) !important;
  column-gap: 0 !important;
}

</style>