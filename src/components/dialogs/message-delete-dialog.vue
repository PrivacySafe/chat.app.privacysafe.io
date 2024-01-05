<script lang="ts" setup>
  import { ref } from 'vue'
  import { Ui3nCheckbox } from '@v1nt1248/3nclient-lib'

  const emits = defineEmits(['select'])
  const deleteForEveryone = ref(false)

  const onFlagChange = (val: boolean | string | number) => emits('select', val)
</script>

<template>
  <div class="message-delete-dialog">
    <div class="message-delete-dialog__text">
      {{ $tr('chat.message.delete.dialog.text') }}
    </div>
    <ui3n-checkbox
      v-model="deleteForEveryone"
      class="message-delete-dialog__checkbox"
      @change="onFlagChange"
    >
      {{ $tr('chat.message.delete.dialog.additional') }}
    </ui3n-checkbox>
  </div>
</template>

<style lang="scss" scoped>
  .message-delete-dialog {
    padding: 32px 16px;

    &__text {
      font-size: var(--font-12);
      font-weight: 400;
      line-height: var(--font-16);
      color: var(--black-90);
      margin-bottom: var(--half-size);
    }

    &__checkbox {
      left: -5px;
    }
  }
</style>
