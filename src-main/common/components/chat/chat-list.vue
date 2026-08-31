<!--
 Copyright (C) 2020 - 2025 3NSoft Inc.

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
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { Ui3nProgressCircular } from '@v1nt1248/3nclient-lib';
import { useChatsStore } from '@main/common/store/chats.store';
import type { ChatListItemView } from '~/chat.types';
import ChatListItem from './chat-list-item.vue';

const emits = defineEmits<{
  (event: 'click', value: ChatListItemView): void;
}>();

const { t } = useI18n();

const chatsStore = useChatsStore();
const { chatListSortedByTime, chatListLoaded } = storeToRefs(chatsStore);
</script>

<template>
  <div :class="$style.chatList">
    <!-- The first list load waits for the deno component to open its
         databases, which on a cold start takes seconds: without an explicit
         state the sidebar is a blank block indistinguishable from a hang. -->
    <div
      v-if="!chatListLoaded"
      :class="$style.stateInfo"
    >
      <ui3n-progress-circular
        indeterminate
        size="32"
      />
    </div>

    <div
      v-else-if="chatListSortedByTime.length === 0"
      :class="$style.stateInfo"
    >
      {{ t('chat.list.empty') }}
    </div>

    <template v-else>
      <chat-list-item
        v-for="chat in chatListSortedByTime"
        :key="chat.chatId"
        :data="chat"
        @click.stop.prevent="emits('click', chat)"
      />
    </template>
  </div>
</template>

<style lang="scss" module>
.chatList {
  position: relative;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 0 var(--spacing-xs);
  background-color: var(--color-bg-block-primary-default);
  user-select: none;
}

.stateInfo {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-l) var(--spacing-s);
  font-size: var(--font-13);
  color: var(--color-text-block-secondary-default);
}
</style>
