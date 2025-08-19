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
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { Ui3nInput } from '@v1nt1248/3nclient-lib';
import { useChatsStore } from '@main/common/store/chats.store.ts';
import { useChatStore } from '@main/common/store/chat.store.ts';
import { areChatIdsEqual } from '@shared/chat-ids.ts';
import type { ChatIdObj } from '~/asmail-msgs.types.ts';
import ChatAvatar from '../chat/chat-avatar.vue';

const emit = defineEmits(['select', 'confirm']);

const { chatListSortedByTime } = storeToRefs(useChatsStore());
const { currentChatId } = storeToRefs(useChatStore());

const searchText = ref('');

// We can only make forward messages to already created and active chats (having accept)
const filteredChatList = computed(() => chatListSortedByTime.value.filter(c => (
  c.displayName.toLowerCase().includes(searchText.value.toLowerCase())
  && !['initiated', 'invited'].includes(c.status)
  && !areChatIdsEqual(currentChatId.value, c)
)));

function selectItem(
  { chatId, contact }:
  { chatId?: ChatIdObj; contact?: { mail: string; name: string; } },
) {
  emit('select', { chatId, contact });
  emit('confirm');
}
</script>

<template>
  <div :class="$style.messageForwardDialog">
    <ui3n-input
      v-model="searchText"
      icon="round-search"
      clearable
      :class="$style.search"
    />

    <div :class="$style.messageForwardDialogBody">
      <h4 :class="$style.messageForwardDialogSubtitle">
        {{ $tr('chat.message.forward.dialog.chats.section.title') }}
      </h4>

      <template v-if="filteredChatList.length">
        <div
          v-for="chat in filteredChatList"
          :key="chat.chatId"
          :class="$style.messageForwardDialogItem"
          @click="selectItem({
            chatId: { isGroupChat: chat.isGroupChat, chatId: chat.chatId }
          })"
        >
          <chat-avatar
            :name="chat.displayName"
            :shape="chat.isGroupChat ? 'decagon' : 'circle'"
            :size="28"
          />
          <div :class="$style.messageForwardDialogItemName">
            {{ chat.displayName }}
          </div>
        </div>
      </template>

      <template v-else>
        <div :class="$style.messageForwardDialogEmpty">
          {{ $tr('chat.message.forward.dialog.chats.empty') }}
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" module>
@use '@main/common/assets/styles/mixins' as mixins;

.messageForwardDialog {
  --forward-dialog-body-offset: calc(var(--spacing-s) * 8);

  position: relative;
  height: 380px;
  padding: 16px;
  overflow: hidden;
}

.search {
  margin-bottom: var(--spacing-m);
}

.messageForwardDialogBody {
  position: relative;
  height: calc(100% - var(--forward-dialog-body-offset));
  overflow-y: auto;
  overflow-x: hidden;
}

.messageForwardDialogSubtitle {
  font-size: var(--font-12);
  font-weight: 500;
  color: var(--color-text-block-primary-default);
  margin: 0 0 var(--spacing-s);
}

.messageForwardDialogItem {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  height: var(--spacing-xl);
  cursor: pointer;

  &:hover {
    background-color: var(--color-bg-chat-bubble-general-bg);
  }
}

.messageForwardDialogItemName {
  position: relative;
  width: calc(100% - calc(var(--spacing-s) * 3.5));
  margin-left: var(--spacing-xs);
  font-size: var(--font-12);
  font-weight: 500;
  color: var(--color-text-block-primary-default);
  @include mixins.text-overflow-ellipsis();
}

.messageForwardDialogEmpty {
  position: relative;
  width: 100%;
  text-align: center;
  font-size: var(--font-12);
  font-weight: 500;
  font-style: italic;
  color: var(--color-text-chat-bubble-other-default);
  margin-bottom: var(--spacing-s);
}
</style>
