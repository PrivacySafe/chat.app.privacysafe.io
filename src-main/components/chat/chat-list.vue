<!--
 Copyright (C) 2020 - 2024 3NSoft Inc.

 This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU General Public License as published by the Free Software
 Foundation, either version 3 of the License, or (at your option) any later
 version.

 This program is distributed in the hope that it will be useful, but
 WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 this program. If not, see <http://www.gnu.org/licenses/>.
-->

<script lang="ts" setup>
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useChatsStore } from '@main/store/chats';
import ChatListItem from './chat-list-item.vue';

const router = useRouter();
const { namedChatList } = storeToRefs(useChatsStore());

function goChat(ev: MouseEvent, chatId: string) {
  ev.preventDefault();
  router.push(`/chats/${chatId}`);
}
</script>

<template>
  <div :class="$style.chatList">
    <chat-list-item
      v-for="chat in namedChatList"
      :key="chat.chatId"
      :data="chat"
      @click="goChat($event, chat.chatId)"
    />
  </div>
</template>

<style lang="scss" module>
.chatList {
  position: relative;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0 var(--spacing-xs);
}
</style>
