<script lang="ts" setup>
  import { computed, inject, onMounted, ref, toRefs } from 'vue'
  import { get } from 'lodash'
  import { useChatsStore } from '@/store'
  import { getChatSystemMessageText } from '@/helpers/chat-ui.helper'
  import { prepareDateAsSting } from '@/helpers/forUi'
  import { getContactName } from '@/helpers/contacts.helper'
  import ChatMessageStatus from '@/components/messages/chat-message-status.vue'
  import ChatMessageAttachments from '@/components/messages/chat-message-attachments.vue'
  import { getMessageFromCurrentChat } from '@/helpers/chat-message-actions.helpers'

  const props = defineProps<{
    msg: ChatMessageView<MessageType>;
    prevMsgSender: string|undefined;
  }>()

  const { $tr } = inject<I18nPlugin>('i18n')!
  const { currentChat } = toRefs(useChatsStore())
  const { getChatList, handleUpdateMessageStatus } = useChatsStore()

  const chatMsgElement = ref<Element|null>(null)
  const msgType = computed<MessageType>(() => get(props.msg, ['messageType'], 'outgoing'))
  const isMsgSystem = computed<boolean>(() => get(props.msg, ['chatMessageType'], 'regular') === 'system')
  const currentMsgSender = computed<string>(() => get(props.msg, ['sender'], ''))
  const doesShowSender = computed<boolean>(() => currentMsgSender.value !== props.prevMsgSender && msgType.value === 'incoming' && !isMsgSystem.value)
  const msgText = computed<string>(() => isMsgSystem.value
    ? getChatSystemMessageText({ message: props.msg, chat: currentChat.value() })
    : props.msg.body)
  const initialMessage = computed(() => getMessageFromCurrentChat({ chatMessageId: props.msg.initialMessageId }))
  const initialMessageText = computed(() => {
    const { body, attachments } = initialMessage.value || {}
    const attachmentsText = (attachments || []).map(a => a.name).join(', ')
    return body || `<i>${$tr('text.receive.file')}: ${attachmentsText}</i>`
  })

  const intersectHandler = (entries: IntersectionObserverEntry[], observer: IntersectionObserver) => {
    entries.forEach(async entry => {
      if (entry.isIntersecting) {
        const { id } = entry.target
        const { chatMessageId, messageType, chatMessageType, status } = props.msg
        if (chatMessageId === id.replace('msg-', '') && messageType === 'incoming' && chatMessageType !== 'system' && status === 'received') {
          await handleUpdateMessageStatus({ chatMessageId, value: null })
          await getChatList()
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
    if (chatMsgElement.value) {
      observer.observe(chatMsgElement.value as Element)
    }
  })
</script>

<template>
  <div
    :id="`msg-${props.msg.chatMessageId}`"
    ref="chatMsgElement"
    :class="[
      'chat-message',
      `chat-message--${isMsgSystem ? 'system' : msgType}`,
      { 'chat-message--offset': currentMsgSender !== props.prevMsgSender && !isMsgSystem },
    ]"
  >
    <div class="chat-message__body">
      <div
        :id="props.msg.chatMessageId"
        class="chat-message__content"
      >
        <div style="pointer-events: none;">
          <h4
            v-if="doesShowSender"
            class="chat-message__sender"
          >
            {{ getContactName(props.msg.sender) }}
          </h4>
          <div
            v-if="initialMessage"
            class="chat-message__initial-msg"
          >
            <span class="chat-message__initial-msg-sender">
              {{ getContactName(initialMessage.sender) }}
            </span>
            <span
              v-phtml.sanitize.classes="initialMessageText"
              class="chat-message__initial-msg-text"
            />
          </div>
          <pre
            v-phtml.sanitize.classes="msgText"
            class="chat-message__text"
          />
          <chat-message-attachments
            v-if="props.msg.attachments && !isMsgSystem"
            :attachments="props.msg.attachments"
            :disabled="props.msg.messageType === 'outgoing'"
          />

          <div class="chat-message__time">
            {{ prepareDateAsSting(props.msg.timestamp) }}
          </div>
          <chat-message-status
            v-if="props.msg.messageType === 'outgoing' && !isMsgSystem"
            class="chat-message__status"
            :value="props.msg.status"
            icon-size="12"
          />
        </div>
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
      width: 90%;
      word-break: break-word;
      margin: 0 5%;
      display: flex;
      align-items: flex-start;
    }

    &__content {
      position: relative;
      min-width: calc(var(--base-size) * 14);
      border-radius: var(--base-size);
      padding: var(--base-size) calc(var(--base-size) * 1.5) calc(var(--base-size) * 1.5) calc(var(--base-size) * 1.5);
      font-size: var(--font-14);
      line-height: var(--font-20);
      color: var(--black-90);
    }

    &__initial-msg {
      border-left: 2px solid var(--black-90);
      padding-left: var(--half-size);
      font-size: var(--font-12);
      color: var(--black-90);

      &-sender {
        display: block;
        line-height: var(--font-14);
      }

      &-text {
        display: block;
        font-style: italic;
        line-height: var(--font-14);
      }
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

    &.chat-message--system {
      .chat-message {
        &__content {
          padding: var(--base-size) calc(var(--base-size) * 1.5);
          min-width: 100%;
          width: 100%;
          text-align: center;
        }

        &__text {
          font-size: var(--font-12);
          font-style: italic;
          font-weight: 300;
        }

        &__time {
          right: 0;
          width: 100%;
          text-align: center;
          font-style: italic;
          font-weight: 400;
          font-size: var(--font-9);
          line-height: var(--font-10);
          padding-top: calc(var(--half-size) / 2);
        }
      }
    }

    &:not(.chat-message--system) {
      .chat-message__content {
        cursor: pointer;
      }
    }
  }
</style>
