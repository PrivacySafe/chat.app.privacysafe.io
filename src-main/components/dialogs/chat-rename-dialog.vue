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
  import { ref, inject, watch } from 'vue'
  import { size } from 'lodash'
  import { I18nPlugin, I18N_KEY, Ui3nInput } from '@v1nt1248/3nclient-lib'
  import { validationParams } from '../../constants'

  const { chatsNameMaxLength } = validationParams
  const { $tr } = inject<I18nPlugin>(I18N_KEY)!

  const props = defineProps<{
    chatName: string;
  }>()
  const emit = defineEmits(['select', 'validate'])
  const data = ref({ oldName: props.chatName, newName: props.chatName })
  const isValid = ref(false)

  const checkRequired = (text?: string): boolean|string => !!text || $tr('validation.text.required')
  const checkLength = (text?: string): boolean|string => size(text) < chatsNameMaxLength || $tr('validation.text.length', { length: chatsNameMaxLength.toString() })

  emit('select', data.value)

  watch(
    () => isValid.value,
    val => emit('validate', val),
    { immediate: true },
  )
</script>

<template>
  <div class="chat-rename-dialog">
    <ui3n-input
      v-model:value="data.newName"
      :rules="[checkRequired, checkLength]"
      placeholder="Enter chat name"
      @update:valid="val => isValid = val"
    />
  </div>
</template>

<style lang="scss" scoped>
  .chat-rename-dialog {
    position: relative;
    width: 100%;
    height: calc(var(--base-size) * 13);
    padding: 32px 16px;
  }
</style>
