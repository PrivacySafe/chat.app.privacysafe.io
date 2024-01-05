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
