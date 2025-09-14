<!--
 Copyright (C) 2025 3NSoft Inc.

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
import { watch } from 'vue';
import { Ui3nLongPress as vUi3nLongPress } from '@v1nt1248/3nclient-lib';
import useChatMessages from './useChatMessages';
import ChatMessage from '../chat-message/chat-message.vue';
import ChatMessageActions from '../chat-message/chat-message-actions.vue';
import type { ChatListItemView, ChatMessageView, RegularMsgView } from '~/index';

export interface ChatMessagesProps {
  chat: ChatListItemView;
  messages: ChatMessageView[];
}

export interface ChatMessagesEmits {
  (event: 'reply', value: RegularMsgView): void;
}

const props = defineProps<ChatMessagesProps>();
const emits = defineEmits<ChatMessagesEmits>();

const {
  listElement,
  msgActionsMenuProps,
  handleClickOnMessagesBlock,
  handleRightClickOnAttachmentElement,
  goToMessage,
  clearMessageMenu,
  handleAction,
} = useChatMessages(emits);

watch(
  () => props.chat.chatId,
  async (value, oldValue) => {
    if (value !== oldValue) {
      setTimeout(() => {
        listElement.value && (listElement.value.scrollTop = 1e9);
      }, 100);
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    id="chat-messages"
    ref="list-element"
    v-ui3n-long-press="{ handler: handleClickOnMessagesBlock, delay: 1000 }"
    :class="$style.chatMessages"
    @click.right="handleClickOnMessagesBlock"
    @click="goToMessage"
  >
    <chat-message
      v-for="(item, index) in props.messages"
      :key="item.chatMessageId"
      :msg="item"
      :prev-msg-sender="index === 0 ? '' : props.messages[index - 1].sender"
      :related-message="(item as RegularMsgView).relatedMessage"
      @click:right="handleRightClickOnAttachmentElement"
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
