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
import { Ui3nButton, Ui3nProgressCircular } from '@v1nt1248/3nclient-lib';
import { useChatsStore } from '@main/common/store/chats.store';
import { useAppStore } from '@main/common/store/app.store';
import type { ChatListItemView } from '~/chat.types';
import ChatListItem from './chat-list-item.vue';

const emits = defineEmits<{
  (event: 'click', value: ChatListItemView): void;
}>();

const { t } = useI18n();

const chatsStore = useChatsStore();
const { chatListSortedByTime, chatListLoaded, chatListError } = storeToRefs(chatsStore);
const { backendStage } = storeToRefs(useAppStore());
</script>

<template>
  <div :class="$style.chatList">
    <!-- Before the spinner: a list that could not be fetched at all used to
         fall back to the spinner and turn there forever (2026-09-10). -->
    <div
      v-if="chatListError"
      :class="$style.stateInfo"
    >
      <div>{{ t('app.startup.listNotLoaded') }}</div>
      <ui3n-button
        type="secondary"
        @click="chatsStore.refreshChatList()"
      >
        {{ t('app.startup.retry') }}
      </ui3n-button>
    </div>

    <!-- The first list load waits for the deno component to open its
         databases, which on a cold start takes seconds: without an explicit
         state the sidebar is a blank block indistinguishable from a hang. -->
    <div
      v-else-if="!chatListLoaded"
      :class="$style.stateInfo"
    >
      <ui3n-progress-circular
        indeterminate
        size="32"
      />
      <!-- What it is waiting on, when the service says so: a slow start is a
           legitimate wait, and naming the stage is what tells it apart from
           a hang without cutting it short. -->
      <div v-if="backendStage">
        {{ t('app.startup.stillStarting', { stage: backendStage }) }}
      </div>
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
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-s);
  padding: var(--spacing-l) var(--spacing-s);
  font-size: var(--font-13);
  color: var(--color-text-block-secondary-default);
  text-align: center;
}
</style>
