<script lang="ts" setup>
  import { ref, inject, watch } from 'vue'
  import { size } from 'lodash'
  import { I18nPlugin, I18N_KEY, Ui3nInput } from '@v1nt1248/3nclient-lib'
  import { validationParams } from '@/constants'

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
