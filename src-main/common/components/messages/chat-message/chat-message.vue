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
import { computed, onMounted, useTemplateRef } from 'vue';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { useMessagesStore } from '@main/common/store/messages.store';
import type { ChatInvitationMsgView, ChatMessageView, RegularMsgView } from '~/index';
import ChatMessageSystem from './chat-message-system.vue';
import ChatMessageInvitationRequest from './chat-message-invitation-request.vue';
import ChatMessageRegular from './chat-message-regular.vue';

const props = defineProps<{
  msg: ChatMessageView;
  relatedMessage?: RegularMsgView['relatedMessage'];
  prevMsgSender: string | undefined;
}>();

const messagesStore = useMessagesStore();
const { markMessageAsRead } = messagesStore;

const chatMsgElement = useTemplateRef<Nullable<Element>>('chat-msg-element');

const isIncomingMsg = computed(() => props.msg.isIncomingMsg);

const isMsgSystem = computed(() => (props.msg.chatMessageType === 'system')
  || (props.msg.chatMessageType === 'invitation'));

const isInvitationRequest = computed(() => props.msg.chatMessageType === 'invitation' && isIncomingMsg.value);

const currentMsgSender = computed<string>(() => props.msg.sender);

function intersectHandler(
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver,
) {
  entries.forEach(async entry => {
    if (entry.isIntersecting) {
      const { chatMessageId, isIncomingMsg, chatMessageType, status, chatId } = props.msg;
      const msgIdFromDomElement = entry.target.id.replace('msg-', '');

      if (
        chatMessageId === msgIdFromDomElement
        && isIncomingMsg
        && (chatMessageType !== 'system')
        && (status === 'unread')
      ) {
        await markMessageAsRead(chatId, chatMessageId);
      }
      observer.unobserve(entry.target);
    }
  });
}

onMounted(() => {
  const observer = new IntersectionObserver(intersectHandler, {
    root: document.getElementById('chatMessages'),
    rootMargin: '0px',
    threshold: 0.5,
  });
  if (chatMsgElement.value) {
    observer.observe(chatMsgElement.value as Element);
  }
});

</script>

<template>
  <div
    :id="`msg-${msg.chatMessageId}`"
    ref="chat-msg-element"
    :class="[
      $style.chatMessage,
      currentMsgSender !== prevMsgSender && !isMsgSystem && $style.withOffset,
      !isMsgSystem && isIncomingMsg ? $style.chatMessageIncoming : $style.chatMessageOutgoing,
    ]"
  >
    <chat-message-system
      v-if="isMsgSystem && !isInvitationRequest"
      :msg="msg"
    />

    <chat-message-invitation-request
      v-else-if="isMsgSystem && isInvitationRequest"
      :msg="msg as ChatInvitationMsgView"
    />

    <chat-message-regular
      v-else
      :msg="msg as RegularMsgView"
      :wrap-msg-element="chatMsgElement"
      :related-message="relatedMessage"
      :prev-msg-sender="prevMsgSender"
    />
  </div>
</template>

<style lang="scss" module>
.chatMessage {
  --message-max-width: 720px;
  --message-min-width: 112px;
  --spacing-sm: calc(var(--spacing-s) * 1.5);

  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-s);

  &.chatMessageOutgoing {
    justify-content: flex-end;
  }

  &.chatMessageIncoming {
    justify-content: flex-start;
  }
}

.withOffset {
  margin-top: var(--spacing-s);
}
</style>
