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
import { computed, ComputedRef, inject } from 'vue';
import { storeToRefs } from 'pinia';
import get from 'lodash/get';
import { I18N_KEY } from '@v1nt1248/3nclient-lib/plugins';
import { Ui3nHtml as vUi3nHtml, type Nullable } from '@v1nt1248/3nclient-lib';
import { prepareDateAsSting } from '@v1nt1248/3nclient-lib/utils';
import type { OutgoingMessageStatus, RegularMsgView } from '~/index';
import { useAppStore } from '@main/common/store/app.store';
import { useContactsStore } from '@main/common/store/contacts.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import ChatMessageStatus from './chat-message-status.vue';
import ChatMessageAttachments from './chat-message-attachments.vue';

const props = defineProps<{
  msg: RegularMsgView;
  wrapMsgElement: Nullable<Element>;
  relatedMessage?: RegularMsgView['relatedMessage'];
  prevMsgSender: string | undefined;
}>();

const { $tr } = inject(I18N_KEY)!;

const { user: ownAddr, isMobileMode } = storeToRefs(useAppStore());
const { getContactName } = useContactsStore();
const { objOfCurrentChatMessages } = storeToRefs(useMessagesStore());

const isIncomingMsg = computed(() => props.msg.isIncomingMsg);

const outgoingMsgStatus = computed(() => props.msg.chatMessageType === 'regular' && !isIncomingMsg.value
  ? props.msg.status as OutgoingMessageStatus
  : undefined,
);

const currentMsgSender = computed<string>(() => props.msg.sender);

const showSender = computed<boolean>(() => props.msg.chatMessageType === 'regular'
  && isIncomingMsg.value
  && (currentMsgSender.value !== props.prevMsgSender),
);

const replyMessage = computed(() => {
  if (!(props.relatedMessage && props.relatedMessage?.replyTo && props.relatedMessage?.replyTo?.chatMessageId)) {
    return null;
  }

  const replyMessageId = props.relatedMessage.replyTo.chatMessageId;
  return get(objOfCurrentChatMessages.value, replyMessageId, null);
}) as ComputedRef<RegularMsgView | null>;

const replyMessageText = computed(() => {
  if (!replyMessage.value) return '';

  const body = replyMessage.value.body;
  const attachments = replyMessage.value.attachments;
  const attachmentsText = (attachments || []).map(a => a.name).join(', ');
  return body || `<i>${$tr('text.receive.file')}: ${attachmentsText}</i>`;
});

const forwardMessageSender = computed(() => props.relatedMessage && props.relatedMessage?.forwardFrom && props.relatedMessage?.forwardFrom?.sender);
</script>

<template>
  <div
    :class="[
      $style.chatMessageRegular,
      isMobileMode && $style.chatMessageRegularMobile,
      isIncomingMsg ? $style.incoming : $style.outgoing,
    ]"
  >
    <div
      :id="msg.chatMessageId"
      class="chat-message__content"
      :class="$style.content"
    >
      <div style="pointer-events: none;">
        <h4
          v-if="showSender"
          :class="$style.sender"
        >
          {{ getContactName(msg.sender || ownAddr) }}
        </h4>

        <div
          v-if="replyMessage"
          :class="$style.replyMessage"
        >
          <span :class="$style.replyMessageSender">
            {{ getContactName(replyMessage.sender || ownAddr) }}
          </span>
          <span
            v-ui3n-html.sanitize.classes="replyMessageText"
            :class="$style.replyMessageText"
          />
        </div>

        <div
          v-if="forwardMessageSender"
          :class="$style.forwardMessage"
        >
          {{ $tr('chat.message.forward.label') }}: {{ forwardMessageSender }}
        </div>

        <pre
          v-ui3n-html.sanitize.classes="msg.body"
          :class="$style.text"
        />

        <chat-message-attachments
          v-if="msg.attachments"
          :attachments="msg.attachments"
          :disabled="!isIncomingMsg"
        />

        <div :class="$style.time">
          {{ prepareDateAsSting(msg.timestamp) }}
        </div>

        <chat-message-status
          v-if="!isIncomingMsg"
          :class="$style.status"
          :value="outgoingMsgStatus"
          icon-size="12"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
.chatMessageRegular {
  --message-max-width: 720px;
  --message-min-width: 112px;

  position: relative;
  width: 90%;
  overflow-wrap: break-word;
  word-break: normal;
  margin: 0 5%;
  display: flex;
  align-items: flex-start;

  &.chatMessageRegularMobile {
    width: 85% !important;
  }

  &.outgoing {
    justify-content: flex-end;

    .content {
      max-width: calc(var(--message-max-width) - 120px);
      background-color: var(--color-bg-chat-bubble-user-default);
    }

    .time {
      right: var(--spacing-ml);
    }
  }

  &.incoming {
    justify-content: flex-start;

    .content {
      max-width: calc(var(--message-max-width) - 95px);
      background-color: var(--color-bg-chat-bubble-other-default);
    }
  }
}

.content {
  position: relative;
  min-width: var(--message-min-width);
  border-radius: var(--spacing-s);
  padding: var(--spacing-s) var(--spacing-sm) var(--spacing-sm) var(--spacing-sm);
  font-size: var(--font-14);
  line-height: var(--font-20);
  color: var(--color-text-chat-bubble-other-default);
  cursor: pointer;
}

.sender,
.forwardMessage {
  font-size: var(--font-13);
  font-weight: 600;
  line-height: var(--font-18);
  margin: 0 0 2px;
}

.replyMessage {
  border-top-right-radius: var(--spacing-xs);
  border-bottom-right-radius: var(--spacing-xs);
  border-left: 2px solid var(--color-icon-chat-bubble-other-default);
  padding: var(--spacing-xs) 6px;
  font-size: var(--font-12);
  line-height: var(--font-14);
  color: var(--color-text-control-primary-default);
  background-color: var(--color-bg-chat-bubble-other-quote);
}

.replyMessageSender {
  display: block;
  font-style: italic;
  font-weight: 500;
  margin-bottom: var(--spacing-xs);
}

.replyMessageText {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.text {
  font-family: Manrope, sans-serif;
  font-size: var(--font-14);
  font-weight: 400;
  line-height: var(--font-20);
  margin: 0;
  white-space: pre-wrap;
}

.time {
  position: absolute;
  font-size: var(--font-10);
  line-height: var(--font-12);
  font-weight: 500;
  color: var(--color-text-chat-bubble-other-sub);
  right: var(--spacing-s);
  bottom: calc(var(--spacing-xs) / 2);
}

.status {
  position: absolute;
  right: var(--spacing-s);
  bottom: calc(var(--spacing-xs) / 2);
}
</style>
