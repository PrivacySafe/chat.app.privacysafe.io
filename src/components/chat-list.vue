<script lang="ts" setup>
  import { useChatsStore } from '@/store/chats.store'
  import { useRouter } from 'vue-router'
  import ChatListItem from '@/components/chat-list-item.vue'

  const chatsStore = useChatsStore()
  const router = useRouter()

  const goChat = (ev: MouseEvent, chatId: string) => {
    ev.preventDefault()
    console.log('\nGO: ', chatId)
    router.push(`/chats/${chatId}`)
  }
</script>

<template>
  <div class="chat-list">
    <chat-list-item
      v-for="chat in chatsStore.chatList"
      :key="chat.chatId"
      :data="chat"
      @click="goChat($event, chat.chatId)"
    />
  </div>
</template>

<style lang="scss" scoped>
  .chat-list {
    position: relative;
    width: 100%;
    overflow-x: hidden;
    overflow-y: auto;

    &__item {
      position: relative;
      width: 100%;
      height: calc(var(--base-size) * 8);
      display: flex;
      padding: 0 calc(var(--base-size) * 2);
    }
  }
</style>
