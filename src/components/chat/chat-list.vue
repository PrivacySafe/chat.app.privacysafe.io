<script lang="ts" setup>
  import { toRefs } from 'vue'
  import { useRouter } from 'vue-router'
  import { useChatsStore } from '@/store'
  import ChatListItem from '@/components/chat/chat-list-item.vue'

  const router = useRouter()
  const { namedChatList } = toRefs(useChatsStore())

  const goChat = (ev: MouseEvent, chatId: string) => {
    ev.preventDefault()
    router.push(`/chats/${chatId}`)
  }
</script>

<template>
  <div class="chat-list">
    <chat-list-item
      v-for="chat in namedChatList()"
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
