<script lang="ts" setup>
  import { onBeforeMount, computed, ref } from 'vue'
  import { useRoute, onBeforeRouteUpdate } from 'vue-router'
  import { without } from 'lodash'
  import { useAppStore } from '@/store/app.store'
  import { useChatsStore } from '@/store/chats.store'
  import { randomStr } from '@/services/base/random'
  import { Icon } from '@iconify/vue'
  import ChatHeader from '@/components/chat-header.vue'
  import ChatMessages from '@/components/chat-messages.vue'
  import PField from '@/components/p-field.vue'

  const route = useRoute()
  const appStore = useAppStore()
  const chatsStore = useChatsStore()
  const chat = computed(() => chatsStore.currentChat)
  const messages = computed(() => chatsStore.currentChatMessages)
  const msgText = ref<string>('')
  const disabled = ref(false)

  onBeforeMount(async () => {
    const { chatId } = route.params as { chatId: string }
    chatId && await chatsStore.getChat(chatId)
  })

  onBeforeRouteUpdate(async (to, from, next) => {
    const chatIdFrom = from.params.chatId as string
    const chatIdTo = to.params.chatId as string
    if (chatIdTo && chatIdTo !== chatIdFrom) {
      await chatsStore.getChat(chatIdTo)
      next()
    }
  })

  const sendMessage = async (ev: Event|KeyboardEvent, force = false) => {
    if (disabled.value) {
      return
    }

    const { key, shiftKey } = ev as KeyboardEvent
    ev.preventDefault()
    ev.stopImmediatePropagation()
    if (!force && key === 'Enter' && shiftKey) {
      msgText.value += '\n'
    } else if (force || (!force && key === 'Enter' && !shiftKey)) {
      const { chatId } = route.params as { chatId: string }
      const me = appStore.user
      const chatMembers = chat.value?.members || []
      const recipients = without(chatMembers, me)

      if (recipients.length) {
        const msgId = randomStr(10)
        const chatMessageId = `${chatId}:${randomStr(8)}`
        const message: ChatOutgoingMessage = {
          msgId,
          msgType: 'chat',
          recipients,
          plainTxtBody: msgText.value.trim(),
          jsonBody: {
            chatId,
            ...(recipients.length > 1 && { chatName: chatsStore.currentChatName }),
            chatMessageType: 'regular',
            chatMessageId,
            members: chatMembers,
            initialMessageId: msgId,
          },
          status: 'sending',
        }

        disabled.value = true
        chatsStore.sendMessages(message)

        setTimeout(() => {
          msgText.value = ''
          disabled.value = false
        }, 400)
      }
    }
  }
</script>

<template>
  <div class="chat">
    <chat-header
      v-if="chat"
      :data="chat"
    />

    <section class="chat__messages">
      <chat-messages
        v-if="messages"
        :data="messages"
      />
    </section>

    <div class="chat__input">
      <var-button
        round
        class="chat__input-emoji"
      >
        <icon
          icon="baseline-emoticon"
          width="20"
          height="20"
          color="#b3b3b3"
        />
      </var-button>

      <var-button
        round
        class="chat__input-file"
      >
        <icon
          icon="baseline-attach-file"
          width="20"
          height="20"
          color="#b3b3b3"
        />
      </var-button>

      <p-field
        v-model:text="msgText"
        type="textarea"
        :rows="1"
        :max-rows="3"
        class="chat__input-field"
        @keydown.enter="sendMessage"
      />

      <var-button
        round
        class="chat__input-send"
        :disabled="!msgText.trim() || disabled"
        @click="sendMessage($event, true)"
      >
        <icon
          icon="baseline-send"
          width="20"
          height="20"
          :color="msgText ? '#0090ec' : '#b3b3b3'"
        />
      </var-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .chat {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--blue-main-20);

    .chat-header {
      margin-bottom: var(--base-size);
    }

    &__messages {
      position: relative;
      width: 100%;
      flex-basis: calc(100% - var(--base-size) * 6);
      overflow-y: auto;
    }

    &__input {
      --button-default-color: transpatent;
      --button-disabled-color: transpatent;
      --button-normal-height: 32px;

      position: relative;
      width: 100%;
      display: flex;
      padding: var(--base-size) calc(var(--base-size) * 2);
      justify-content: center;
      align-items: center;
      max-height: calc(var(--base-size) * 11);
      flex-grow: 1;
      background-color: var(--system-white);
      margin-top: var(--base-size);

      .var-button {
        box-shadow: none;
        min-height: var(--button-normal-height);
        max-height: var(--button-normal-height);
        min-width: var(--button-normal-height);
        max-width: var(--button-normal-height);
        margin: 0 calc(var(--base-size) / 2);
      }

      &-field {
        max-width: 55%;
        margin: 0 calc(var(--base-size) * 2);
      }
    }
  }
</style>
