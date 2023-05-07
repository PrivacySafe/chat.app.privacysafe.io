<script lang="ts" setup>
  import { computed } from 'vue'
  import { getContactName, prepareDateAsSting } from '@/helpers/chats.helper'
  import ChatAvatar from '@/components/chat-avatar.vue'

  const props = defineProps<{
    data: ChatView & { unread: number } & ChatMessageViewForDB<MessageType>;
  }>()

  const text = computed<string>(() => {
    if (!props.data.msgId)
      return ''

    return prepareDateAsSting(props.data.timestamp)
  })
</script>

<template>
  <div class="chat-header">
    <chat-avatar :name="props.data.name" />

    <div class="chat-header__content">
      <div class="chat-header__name">
        {{ getContactName(props.data.name) }}
      </div>

      <div
        class="chat-header__info"
        v-html="props.data.timestamp ? $tr('chat.header.info', { date: text }) : ''"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .chat-header {
    position: relative;
    width: 100%;
    min-height: calc(var(--base-size) * 8);
    height: calc(var(--base-size) * 8);
    background-color: var(--system-white);
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding: 0 calc(var(--base-size) * 2);

    &__content {
      position: relative;
      width: calc(100% - var(--base-size) * 5.5);
      margin-left: var(--base-size);
    }

    &__name,
    &__info{
      position: relative;
      width: 100%;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    &__name {
      font-size: var(--font-16);
      font-weight: 600;
      line-height: 22px;
      color: var(--black-90);
    }

    &__info {
      min-height: 14px;
      font-size: var(--font-12);
      font-weight: 400;
      line-height: 14px;
      color: var(--black-30);
    }
  }
</style>
