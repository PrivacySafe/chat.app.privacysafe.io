<script lang="ts" setup>
  import { Icon } from '@iconify/vue'

  const props = defineProps<{
    name: string;
    size: number;
    deletable?: boolean;
  }>()

  const emit = defineEmits(['delete'])
</script>

<template>
  <var-chip
    class="chat-attachment"
    size="small"
  >
    <template #left>
      <icon
        icon="baseline-attach-file"
        width="12"
        height="12"
      />
    </template>
    {{ name }}
    <template
      v-if="props.deletable"
      #right
    >
      <var-button
        round
        @click="emit('delete')"
      >
        <icon
          icon="baseline-close"
          width="12"
          height="12"
        />
      </var-button>
    </template>
  </var-chip>
</template>

<style lang="scss" scoped>
  .chat-attachment {
    --chip-default-color: var(--gray-50);

    margin: 0 var(--half-size) var(--half-size) 0;
    cursor: pointer;

    .var-button {
      box-shadow: none;
    }
  }
</style>
