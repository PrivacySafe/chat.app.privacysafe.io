<script lang="ts" setup>
  import { ref } from 'vue'

  const emit = defineEmits(['select'])
  const deleteForEveryone = ref(false)

  const onFlagChange = (val: boolean) => emit('select', val)
</script>

<template>
  <div class="message-delete-dialog">
    <div class="message-delete-dialog__text">
      {{ $tr('chat.message.delete.dialog.text') }}
    </div>
    <var-checkbox
      v-model="deleteForEveryone"
      class="message-delete-dialog__checkbox"
      @change="onFlagChange"
    >
      {{ $tr('chat.message.delete.dialog.additional') }}
    </var-checkbox>
  </div>
</template>

<style lang="scss">
  .message-delete-dialog__wrapper {
    .var-dialog__actions {
      .var-dialog__confirm-button {
        .var-button__content {
          text-transform: capitalize;
        }
      }
    }
  }
</style>

<style lang="scss" scoped>
  .message-delete-dialog {
    &__text {
      font-size: var(--font-12);
      font-weight: 400;
      line-height: var(--font-16);
      color: var(--black-90);
      margin-bottom: var(--half-size);
    }

    &__checkbox {
      --checkbox-icon-size: var(--font-20);
      --checkbox-checked-color: var(--blue-main);

      :deep(.var-checkbox) {
        .var-checkbox__text {
          font-size: var(--font-12);
          font-weight: 500;
          color: var(--system-black);
        }

        .var-checkbox__action {
          .var-icon {
            line-height: var(--font-20);
          }
        }
      }
    }
  }
</style>
