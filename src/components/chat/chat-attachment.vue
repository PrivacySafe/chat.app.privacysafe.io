<script lang="ts" setup>
  import { Ui3nChip, Ui3nIcon } from '@v1nt1248/3nclient-lib'

  defineProps<{
    name: string;
    size: number;
    deletable?: boolean;
  }>()

  const emits = defineEmits(['delete'])
</script>

<template>
  <ui3n-chip
    class="chat-attachment"
    closeable
    @close="emits('delete')"
  >
    <template #left>
      <ui3n-icon
        icon="attach-file"
        width="12"
        height="12"
      />
    </template>
    {{ name }}
  </ui3n-chip>
</template>

<style lang="scss" scoped>
  .chat-attachment {
    --chip-default-color: var(--gray-50);

    margin: 0 var(--half-size) var(--half-size) 0;
    cursor: pointer;
  }
</style>
