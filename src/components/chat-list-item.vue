<script lang="ts" setup>
  import { computed } from 'vue'
  import { get } from 'lodash'
  import { useChatsStore } from '@/store/chats.store'
  import { getContactName, prepareDateAsSting } from '@/helpers/chats.helper'
  import ChatAvatar from '@/components/chat-avatar.vue'

  const emit = defineEmits(['click'])
  const props = defineProps<{
    data: {
      chatId: string;
      name: string;
      members: string[];
      createdAt: number;
      unread: number;
      msgId?: string;
      messageType?: MessageType;
      body?: string;
      status?: MessageDeliveryStatus;
      timestamp?: number;
    }
  }>()
  const chatsStore = useChatsStore()

  const selectedChatId = computed<string>(() => get(chatsStore, ['currentChat', 'chatId'], ''))

  const message = computed<string>(() => {
    if (!props.data.msgId)
      return ' '

    if (props.data.messageType === 'outgoing')
      return `<b>You: </b>${props.data.body}`

    return props.data.body!
  })

  const date = computed<string>(() => {
    const chatLastDate = props.data.msgId
      ? props.data.timestamp
      : props.data.createdAt

    return prepareDateAsSting(chatLastDate!)
  })
</script>

<template>
  <div
    class="chat-list-item"
    :class="{ 'chat-list-item--selected': props.data.chatId === selectedChatId }"
    @click="emit('click', $event)"
  >
    <chat-avatar :name="props.data.name" />

    <div class="chat-list-item__content">
      <div class="chat-list-item__name">
        {{ getContactName(props.data.name) }}
      </div>
      <div
        class="chat-list-item__message"
        v-html="message"
      />
    </div>

    <div class="chat-list-item__info">
      <div class="chat-list-item__date">
        {{ date }}
      </div>
      <div class="chat-list-item__status">
        <var-badge
          v-if="props.data.unread"
          :value="props.data.unread"
          color="#0090EC"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .chat-list-item {
    position: relative;
    width: 100%;
    height: calc(var(--base-size) * 8);
    display: flex;
    padding: 0 calc(var(--base-size) * 2);
    justify-content: flex-start;
    align-items: center;
    border-bottom: 1px solid var(--system-white);

    &__content {
      position: relative;
      width: calc(100% - var(--base-size) * 12.5);
      margin-left: var(--base-size);
    }

    &__name {
      position: relative;
      height: 22px;
      max-width: 100%;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: var(--font-16);
      font-weight: 500;
      line-height: 22px;
      color: var(--black-90);
      margin-bottom: 2px;
    }

    &__message {
      position: relative;
      height: 20px;
      max-width: 100%;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font-size: var(--font-14);
      font-weight: 400;
      line-height: 20px;
    }

    &__info {
      position: relative;
      width: calc(var(--base-size) * 7);
    }

    &__date {
      position: relative;
      height: 22px;
      text-align: right;
      margin-bottom: 2px;
      font-size: var(--font-9);
      font-weight: 400;
      line-height: 22px;
      color: var(--black-30);
    }

    &__status {
      position: relative;
      height: 20px;
      display: flex;
      justify-content: flex-end;
      align-items: center;

      :deep(.var-badge) {
        max-height: 20px;
        display: flex;
        top: -2px;

        .var-badge__content {
          line-height: 1;
          padding: 4px 6px;
        }
      }
    }

    &:hover {
      cursor: pointer;
      background-color: var(--blue-main-20);
    }

    &--selected {
      background-color: var(--blue-main-20);
    }
  }
</style>
