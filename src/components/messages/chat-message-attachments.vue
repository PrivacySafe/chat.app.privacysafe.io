<script lang="ts" setup>
  import { computed } from 'vue'
  import { isEmpty } from 'lodash'
  import { Ui3nIcon } from '@v1nt1248/3nclient-lib'

  const props = defineProps<{
    attachments?: ChatMessageAttachmentsInfo[];
    disabled: boolean;
  }>()

  const items = computed(() => {
    if (isEmpty(props.attachments)) {
      return []
    }

    return props.attachments!.map(i => {
      const lastDotPosition = i.name.lastIndexOf('.')
      return {
        filename: i.name.slice(0, lastDotPosition),
        ext: i.name.slice(lastDotPosition + 1),
      }
    })
  })
</script>

<template>
  <div
    :class="[
      'chat-message-attachments',
      { 'chat-message-attachments--disabled': props.disabled },
    ]"
  >
    <div
      v-for="(item, index) in items"
      :key="index"
      class="chat-message-attachments__item"
    >
      <ui3n-icon
        icon="baseline-attach-file"
        width="16"
        height="16"
      />
      <div class="chat-message-attachments__item-name">
        {{ item.filename }}
      </div>
      <div class="chat-message-attachments__item-ext">
        .{{ item.ext }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import "../../assets/styles/mixins";

  .chat-message-attachments {
    position: relative;
    max-width: 100%;

    &__item {
      position: relative;
      display: flex;
      justify-content: flex-start;
      align-items: center;
      height: calc(var(--base-size) * 2.5);
      font-size: var(--font-14);
      font-weight: 400;
      color: var(--black-90);

      .iconify {
        position: relative;
        left: -4px;
      }

      &-name {
        position: relative;
        height: calc(var(--base-size) * 2.5);
        text-align: left;
        flex-shrink: 1;
        line-height: var(--font-20);
        @include text-overflow-ellipsis();
      }

      &-ext {
        flex-shrink: 0;
        line-height: var(--font-20);
      }
    }
  }
</style>
