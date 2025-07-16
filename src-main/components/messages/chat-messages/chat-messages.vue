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
/* eslint-disable @typescript-eslint/no-explicit-any */
import { watch } from 'vue';
import useChatMessages from './useChatMessages';
import type { ChatMessagesProps, ChatMessagesEmits } from './types';
import ChatMessage from '../chat-message.vue';
import ChatMessageActions from '../chat-message-actions.vue';
import { RegularMsgView } from '~/chat.types';

const props = defineProps<ChatMessagesProps>();
const emit = defineEmits<ChatMessagesEmits>();

const {
  listElement,
  msgActionsMenuProps,
  goToMessage,
  openMessageMenu,
  clearMessageMenu,
  handleAction,
} = useChatMessages(emit);

watch(
  () => props.chat.chatId,
  async (value, oldValue) => {
    if (value !== oldValue) {
      setTimeout(() => {
        listElement.value!.scrollTop = 1e9;
      }, 50);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    id="chat-messages"
    ref="listElement"
    :class="$style.chatMessages"
    @click.right="openMessageMenu"
    @click="goToMessage"
  >
    <chat-message
      v-for="(item, index) in props.messages"
      :key="item.templateIteratorKey"
      :msg="item"
      :prev-msg-sender="index === 0 ? '' : props.messages[index - 1].sender"
      :related-message="(item as RegularMsgView).relatedMessage"
    />

    <teleport
      v-if="msgActionsMenuProps.msg"
      :disabled="!msgActionsMenuProps.open"
      :to="`#msg-${msgActionsMenuProps.msg.chatMessageId}`"
    >
      <chat-message-actions
        :open="msgActionsMenuProps.open"
        :actions="msgActionsMenuProps.actions"
        :msg="msgActionsMenuProps.msg"
        @close="clearMessageMenu"
        @select:action="handleAction"
      />
    </teleport>
  </div>
</template>

<style lang="scss" module>
.chatMessages {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-chat-bubble-general-bg);
  padding-bottom: var(--spacing-s);
  overflow-y: auto;

  .scroller {
    height: 100%;
  }
}
</style>
