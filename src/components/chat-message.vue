<script lang="ts" setup>
  import { computed, onMounted, ref } from 'vue'
  import { get } from 'lodash'
  import { useChatsStore } from '@/store/chats.store'
  import { getContactName, prepareDateAsSting } from '@/helpers/chats.helper'
  import ChatMessageStatus from '@/components/chat-message-status.vue'

  const props = defineProps<{
    msg: ChatMessageViewForDB<MessageType>;
    prevMsgSender: string|undefined;
  }>()

  const chatsStore = useChatsStore()

  const chatMsgElement = ref<HTMLDivElement|null>(null)
  const msgType = computed<MessageType>(() => get(props.msg, ['messageType'], 'outgoing'))
  const currentMsgSender = computed<string>(() => get(props.msg, ['sender'], ''))
  const currentMsgType = computed<MessageType>(() => get(props.msg, ['messageType'], 'outgoing'))
  const doesShowSender = computed<boolean>(() => currentMsgSender.value !== props.prevMsgSender && currentMsgType.value === 'incoming')

  const intersectHandler = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
    console.log('\n(CLIENT) CROSSING: ', props.msg.chatMessageId, props.msg.messageType, props.msg.chatMessageType)
    entries.forEach(async entry => {
      if (entry.isIntersecting) {
        const { id } = entry.target
        const { chatMessageId, messageType, chatMessageType, status } = props.msg
        if (id === chatMessageId && messageType === 'incoming' && chatMessageType !== 'system' && status === 'received') {
          console.log('\n(CLIENT) EXECUTE CHANGING OF MSG STATUS: ', chatMessageId)
          await chatsStore.updateMessageStatus({ chatMessageId, value: null })
          await chatsStore.getChatList()
        }
        observer.unobserve(entry.target)
      }
    })
  }

  onMounted(() => {
    const observer = new IntersectionObserver(intersectHandler, {
      root: document.getElementById('chatMessages'),
      rootMargin: '0px',
      threshold: 0.5,
    })
    observer.observe(chatMsgElement.value!)
  })
</script>

<template>
  <div
    :id="props.msg.chatMessageId"
    ref="chatMsgElement"
    :class="[
      'chat-message',
      `chat-message--${msgType}`,
      { 'chat-message--offset': currentMsgSender !== props.prevMsgSender },
    ]"
  >
    <div class="chat-message__body">
      <div class="chat-message__content">
        <h4
          v-if="doesShowSender"
          class="chat-message__sender"
        >
          {{ getContactName(props.msg.sender) }}
        </h4>
        <pre
          class="chat-message__text"
          v-html="props.msg.body"
        />
        <div class="chat-message__time">
          {{ prepareDateAsSting(props.msg.timestamp) }}
        </div>
        <chat-message-status
          v-if="props.msg.messageType === 'outgoing'"
          class="chat-message__status"
          :value="props.msg.status"
          icon-size="12"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .chat-message {
    --message-max-width: 720px;

    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    padding: var(--half-size) var(--base-size);

    &--offset {
      margin-top: var(--base-size);
    }

    &__body {
      position: relative;
      width: 100%;
      word-break: break-word;
      margin: 0 5%;
      display: flex;
      align-items: flex-start;
    }

    &__content {
      //flex-grow: 1;
      position: relative;
      border-radius: var(--base-size);
      padding: var(--base-size) calc(var(--base-size) * 1.5) calc(var(--base-size) * 1.5) calc(var(--base-size) * 1.5);
      font-size: var(--font-14);
      line-height: var(--font-20);
      color: var(--black-90);
    }

    &.chat-message--outgoing {
      justify-content: flex-end;

      .chat-message__body {
        justify-content: flex-end;
        max-width: calc(var(--message-max-width) - 120px);
      }

      .chat-message__content {
        background-color: var(--blue-main-30);
      }
    }

    &.chat-message--incoming {
      justify-content: flex-start;

      .chat-message__body {
        justify-content: flex-start;
        max-width: calc(var(--message-max-width) - 95px);
      }

      .chat-message__content {
        background-color: var(--system-white);
      }
    }

    &__sender {
      font-size: var(--font-13);
      font-weight: 600;
      line-height: var(--font-18);
      color: var(--blue-main-120);
      margin: 0 0 2px;
    }

    &__text {
      font-family: OpenSans, sans-serif;
      font-size: var(--font-14);
      font-weight: 400;
      line-height: var(--font-20);
      margin: 0;
      white-space: pre-wrap;
    }

    &__time {
      position: absolute;
      font-size: var(--font-10);
      line-height: var(--font-12);
      font-weight: 500;
      color: var(--black-30);
      right: var(--base-size);
      bottom: calc(var(--half-size) / 2);

      .chat-message--outgoing & {
        right: calc(var(--base-size) * 3);
      }
    }

    &__status {
      position: absolute;
      right: var(--base-size);
      bottom: calc(var(--half-size) / 2);
    }
  }
</style>
