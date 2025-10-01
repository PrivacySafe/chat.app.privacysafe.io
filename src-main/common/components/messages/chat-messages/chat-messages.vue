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
import { type Nullable, Ui3nLongPress as vUi3nLongPress } from '@v1nt1248/3nclient-lib';
import useChatMessages from './useChatMessages';
import type { ChatListItemView, ChatMessageView, RegularMsgView } from '~/index';
import ChatMessage from '../chat-message/chat-message.vue';
import ChatMessageActions from '../chat-message/chat-message-actions.vue';
import ReactionsDialog from '@main/common/components/dialogs/reactions-dialog.vue';

export interface ChatMessagesProps {
  chat: ChatListItemView;
  messages: ChatMessageView[];
}

export interface ChatMessagesEmits {
  (event: 'init', value: Nullable<HTMLDivElement>): void;
  (event: 'reply', value: RegularMsgView): void;
  (event: 'edit', value: RegularMsgView): void;
  (event: 'show:info', value: RegularMsgView): void;
}

const props = defineProps<ChatMessagesProps>();
const emits = defineEmits<ChatMessagesEmits>();

const {
  selectedMessages,
  msgActionsMenuProps,
  msgReactionsMenuProps,
  recentReactions,
  selectMessage,
  handleClickOnMessagesBlock,
  handleRightClickOnAttachmentElement,
  goToMessage,
  clearMessageMenu,
  handleAction,
  handleSelectionReaction,
} = useChatMessages(emits);
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
      :selected-messages="selectedMessages"
      :prev-msg-sender="index === 0 ? '' : props.messages[index - 1].sender"
      :prev-msg-info="
        index === 0
          ? null
          : {
            isIncomingMsg: props.messages[index - 1].isIncomingMsg,
            status: props.messages[index - 1].status
          }
      "
      :related-message="(item as RegularMsgView).relatedMessage"
      @select="selectMessage"
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

    <teleport
      v-if="msgReactionsMenuProps.msg"
      :disabled="!msgReactionsMenuProps.open"
      :to="`#msg-${msgReactionsMenuProps.msg.chatMessageId}`"
    >
      <reactions-dialog
        :open="msgReactionsMenuProps.open"
        :recent-reactions="recentReactions"
        :msg="msgReactionsMenuProps.msg"
        @close="clearMessageMenu"
        @select:reaction="handleSelectionReaction"
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
