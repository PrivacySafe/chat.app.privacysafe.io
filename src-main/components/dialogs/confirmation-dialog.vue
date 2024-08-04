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
  import { computed } from 'vue'

  const props = defineProps<{
    dialogText?: string;
    additionalDialogText?: string;
  }>()

  const text = computed<string>(() => props.dialogText || 'confirmation.dialog.text')
</script>

<template>
  <div class="confirmation-dialog">
    {{ $tr(text) }}
    <span v-if="props.additionalDialogText">{{ $tr(additionalDialogText!) }}</span>
  </div>
</template>

<style lang="scss" scoped>
  .confirmation-dialog {
    font-size: var(--font-14);
    font-weight: 400;
    color: var(--black-90);
    text-align: center;
    padding: 32px 16px;
  }
</style>
