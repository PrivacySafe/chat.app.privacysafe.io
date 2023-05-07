<script lang="ts" setup>
  import { inject, onBeforeMount, onBeforeUnmount, nextTick, getCurrentInstance, ref } from 'vue'
  // import VirtualList from '@virtual-list/vue'
  // import { useAppStore } from '@/store/app.store'
  import { useChatsStore } from '@/store/chats.store'
  import ChatMessage from './chat-message.vue'

  const props = defineProps<{
    data: ChatMessageViewForDB<MessageType>[],
  }>()

  const instance = getCurrentInstance()
  const $emitter = inject('event-bus') as EventBus
  // const appStore = useAppStore()
  const chatsStore = useChatsStore()
  const listElement = ref<HTMLDivElement|null>(null)

  const scrollList = async ({ chatId}: { chatId: string }) => {
    console.log('\n--- INTO SCROLL LIST METHOD ---\n')
    if (listElement.value && chatsStore.currentChatId === chatId) {
      await nextTick(() => {
        console.log('\n--- SCROLL HAS DONE ---\n')
        listElement.value!.scrollTop = 1e9
      })
    }
  }

  onBeforeMount(() => {
    $emitter.on('send:message', scrollList)
  })

  onBeforeUnmount(() => {
    $emitter.off('send:message', scrollList)
  })

  // watch(
  //   () => appStore.appWindowSize,
  //   () => _forceUpdate(),
  // )
</script>

<template>
  <div
    id="chatMessages"
    ref="listElement"
    class="chat-messages"
  >
    <!--
    <virtual-list
      :items="props.data"
      :first-render="10"
      item-key="msgId"
      style="height: 100%;"
    >
      <template #default="{ item, index }">
        <chat-message
          :msg="item"
          :prev-msg-sender="index === 0 ? '' : props.data[index - 1].sender"
        />
      </template>
    </virtual-list>
    -->
    <chat-message
      v-for="(item, index) in props.data"
      :key="item.chatMessageId"
      :msg="item"
      :prev-msg-sender="index === 0 ? '' : props.data[index - 1].sender"
    />
  </div>
</template>

<style lang="scss" scoped>
  .chat-messages {
    position: relative;
    width: 100%;
    height: 100%;
    background-color: var(--blue-main-20);
    padding-bottom: var(--base-size);
    overflow-y: auto;

    .scroller {
      height: 100%;
    }
  }
</style>
