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
import { computed, inject, onMounted, ref } from 'vue';
import { I18N_KEY } from '@v1nt1248/3nclient-lib/plugins';
import { prepareDateAsSting } from '@v1nt1248/3nclient-lib/utils';
import { Ui3nHtml as vUi3nHtml } from '@v1nt1248/3nclient-lib';
import { getTextForChatInvitationMessage, getTextForChatSystemMessage } from '@main/utils/chat-ui.helper';
import type { ChatMessageView, OutgoingMessageStatus, RegularMsgView } from '~/index';
import ChatMessageStatus from './chat-message-status.vue';
import ChatMessageAttachments from './chat-message-attachments.vue';
import { useChatStore } from '@main/store/chat.store';
import { useContactsStore } from '@main/store/contacts.store';

const props = defineProps<{
  msg: ChatMessageView;
  relatedMessage: RegularMsgView['relatedMessage'];
  prevMsgSender: string | undefined;
}>();

const { $tr } = inject(I18N_KEY)!;
const chatStore = useChatStore();
const { markMessageAsRead } = chatStore;
const { getContactName } = useContactsStore();

const chatMsgElement = ref<Element | null>(null);

const isIncomingMsg = computed(() => props.msg.isIncomingMsg);

const isMsgSystem = computed(() => (props.msg.chatMessageType === 'system') || (props.msg.chatMessageType === 'invitation'));

const outgoingMsgStatus = computed(() => (
  (!isMsgSystem.value && !isIncomingMsg.value) ?
  props.msg.status as OutgoingMessageStatus : undefined
));

const currentMsgSender = computed<string>(() => props.msg.sender);

const showSender = computed<boolean>(() => isIncomingMsg.value &&
  !isMsgSystem.value && (currentMsgSender.value !== props.prevMsgSender)
);

const msgText = computed<string>(() => {
  switch (props.msg.chatMessageType) {
    case 'regular':
      return props.msg.body;
    case 'invitation':
      return getTextForChatInvitationMessage(props.msg);
    case 'system':
      return getTextForChatSystemMessage(props.msg);
  }
});

const initialMessage = computed(() => {
  if (!props.relatedMessage) {
    return;    
  } else if (props.relatedMessage.replyTo) {
    return props.relatedMessage.replyTo;
  } else if (props.relatedMessage.forwardingOf) {
    return props.relatedMessage.forwardingOf;
  }
});

const initialMessageText = computed(() => {
  
  const body = initialMessage.value?.body;
  const attachments = initialMessage.value?.attachments;
  const attachmentsText = (attachments || []).map(a => a.name).join(', ');
  return body || `<i>${$tr('text.receive.file')}: ${attachmentsText}</i>`;
});

// XXX what does this do? Check IntersectionObserver in mdn.
function intersectHandler(
  entries: IntersectionObserverEntry[], observer: IntersectionObserver
) {
  entries.forEach(async entry => {
    if (entry.isIntersecting) {
      const {
        chatMessageId, isIncomingMsg, chatMessageType, status, chatId
      } = props.msg;
      if ((chatMessageId === entry.target.id.replace('msg-', ''))
      && isIncomingMsg
      && (chatMessageType !== 'system')
      && (status === 'unread')) {
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
    ref="chatMsgElement"
    :class="[
      $style.chatMessage,
      currentMsgSender !== prevMsgSender && !isMsgSystem && $style.withOffset,
      isMsgSystem
        ? $style.chatMessageSystem
        : isIncomingMsg ? $style.chatMessageIncoming : $style.chatMessageOutgoing
    ]"
  >
    <div :class="$style.chatMessageBody">
      <div
        :id="msg.chatMessageId"
        class="chat-message__content"
        :class="$style.chatMessageContent"
      >
        <div style="pointer-events: none;">
          <h4
            v-if="showSender"
            :class="$style.chatMessageSender"
          >
            {{ getContactName(msg.sender) }}
          </h4>

          <div
            v-if="initialMessage"
            :class="$style.chatMessageInitial"
          >
            <span :class="$style.chatMessageInitialSender">
              {{ getContactName(initialMessage.sender) }}
            </span>
            <span
              v-ui3n-html.sanitize.classes="initialMessageText"
              :class="$style.chatMessageInitialText"
            />
          </div>

          <pre
            v-ui3n-html.sanitize.classes="msgText"
            :class="$style.chatMessageText"
          />

          <chat-message-attachments
            v-if="(msg as RegularMsgView).attachments && !isMsgSystem"
            :attachments="(msg as RegularMsgView).attachments"
            :disabled="!isIncomingMsg"
          />

          <div :class="$style.chatMessageTime">
            {{ prepareDateAsSting(msg.timestamp) }}
          </div>

          <chat-message-status
            v-if="!isIncomingMsg"
            :class="$style.chatMessageStatus"
            :value="outgoingMsgStatus"
            icon-size="12"
          />
        </div>
      </div>
    </div>
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

    .chatMessageBody {
      justify-content: flex-end;
      max-width: calc(var(--message-max-width) - 120px);
    }

    .chatMessageContent {
      background-color: var(--color-bg-chat-bubble-user-default);
    }
  }

  &.chatMessageIncoming {
    justify-content: flex-start;

    .chatMessageBody {
      justify-content: flex-start;
      max-width: calc(var(--message-max-width) - 95px);
    }

    .chatMessageContent {
      background-color: var(--color-bg-chat-bubble-other-default);
    }
  }

  &.chatMessageSystem {
    .chatMessageContent {
      padding: var(--spacing-s) var(--spacing-sm);
      min-width: 100%;
      width: 100%;
      text-align: center;
    }

    .chatMessageText {
      font-size: var(--font-12);
      font-style: italic;
      font-weight: 300;
    }

    .chatMessageTime {
      right: 0;
      width: 100%;
      text-align: center;
      font-style: italic;
      font-weight: 400;
      font-size: var(--font-9);
      line-height: var(--font-10);
      padding-top: calc(var(--spacing-xs) / 2);
    }
  }

  &:not(.chatMessageSystem) {
    .chatMessageContent {
      cursor: pointer;
    }
  }
}

.withOffset {
  margin-top: var(--spacing-s);
}

.chatMessageBody {
  position: relative;
  width: 90%;
  word-break: break-word;
  margin: 0 5%;
  display: flex;
  align-items: flex-start;
}

.chatMessageContent {
  position: relative;
  min-width: var(--message-min-width);
  border-radius: var(--spacing-s);
  padding: var(--spacing-s) var(--spacing-sm) var(--spacing-sm) var(--spacing-sm);
  font-size: var(--font-14);
  line-height: var(--font-20);
  color: var(--color-text-chat-bubble-other-default);
}

.chatMessageSender {
  font-size: var(--font-13);
  font-weight: 600;
  line-height: var(--font-18);
  margin: 0 0 2px;
}

.chatMessageText {
  font-family: Manrope, sans-serif;
  font-size: var(--font-14);
  font-weight: 400;
  line-height: var(--font-20);
  margin: 0;
  white-space: pre-wrap;
}

.chatMessageInitial {
  border-top-right-radius: var(--spacing-xs);
  border-bottom-right-radius: var(--spacing-xs);
  border-left: 2px solid var(--color-icon-chat-bubble-other-default);
  padding: var(--spacing-xs) 6px var(--spacing-xs) var(--spacing-xs);
  font-size: var(--font-12);
  line-height: var(--font-14);
  color: var(--color-text-control-primary-default);
  background-color: var(--color-bg-chat-bubble-other-quote);
}

.chatMessageInitialSender {
  display: block;
  font-style: italic;
  font-weight: 500;
}

.chatMessageInitialText {
  display: block;
}

.chatMessageTime {
  position: absolute;
  font-size: var(--font-10);
  line-height: var(--font-12);
  font-weight: 500;
  color: var(--color-text-chat-bubble-other-sub);
  right: var(--spacing-s);
  bottom: calc(var(--spacing-xs) / 2);

  .chatMessageOutgoing & {
    right: var(--spacing-ml);
  }
}

.chatMessageStatus {
  position: absolute;
  right: var(--spacing-s);
  bottom: calc(var(--spacing-xs) / 2);
}
</style>
