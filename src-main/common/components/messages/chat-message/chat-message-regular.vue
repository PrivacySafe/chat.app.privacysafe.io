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
import size from 'lodash/size';
import { I18N_KEY, I18nPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { Ui3nHtml as vUi3nHtml, type Nullable, Ui3nProgressCircular } from '@v1nt1248/3nclient-lib';
import { prepareDateAsSting } from '@v1nt1248/3nclient-lib/utils';
import type { OutgoingMessageStatus, RegularMsgView } from '~/index';
import { useAppStore } from '@main/common/store/app.store';
import { useContactsStore } from '@main/common/store/contacts.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import { useUiOutgoingStore } from '@main/common/store/ui.outgoing.store';
import ChatMessageStatus from './chat-message-status.vue';
import ChatMessageAttachments from './chat-message-attachments/chat-message-attachments.vue';
import ChatMessageReactions from './chat-message-reactions/chat-message-reactions.vue';

const props = defineProps<{
  msg: RegularMsgView;
  wrapMsgElement: Nullable<Element>;
  relatedMessage?: RegularMsgView['relatedMessage'];
  prevMsgSender: string | undefined;
  isProcessing?: boolean;
}>();

const { $tr } = inject<I18nPlugin>(I18N_KEY)!;

const { user: ownAddr, isMobileMode } = storeToRefs(useAppStore());
const { getContactName } = useContactsStore();
const { objOfCurrentChatMessages } = storeToRefs(useMessagesStore());
const { msgsSendingProgress } = storeToRefs(useUiOutgoingStore());

const chatMsgInfo = computed(() => JSON.stringify([props.msg.chatId.chatId, props.msg.chatMessageId]));

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

const isMsgChanged = computed(() => {
  const { history = {} } = props.msg;
  const { changes = [] } = history;
  const bodyChanges = changes.filter(i => i.type === 'body');
  return bodyChanges.length > 0;
});
const hasMsgReactions = computed(() => size(props.msg.reactions) > 0);
</script>

<template>
  <div
    :class="[
      $style.chatMessageRegular,
      isMobileMode && $style.chatMessageRegularMobile,
      isIncomingMsg ? $style.incoming : $style.outgoing,
      isProcessing && $style.chatMessageRegularProcessing,
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
            v-ui3n-html:sanitize="{
              dirty: replyMessageText,
              allowedAttributes: { '*': ['class', 'data-mention', 'data-href'] }
            }"
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
          v-ui3n-html:sanitize="{
            dirty: msg.body,
            allowedAttributes: { '*': ['class', 'data-mention', 'data-href'] }
          }"
          :class="$style.text"
          style="pointer-events: auto;"
        />

        <chat-message-attachments
          v-if="msg.attachments"
          :message="msg"
        />

        <div
          :id="`footer-${msg.chatMessageId}`"
          :class="$style.footer"
        >
          <chat-message-reactions
            :reactions="msg.reactions"
            :is-incoming-msg="isIncomingMsg"
          />

          <div :class="[$style.info, hasMsgReactions && $style.infoWithReactions]">
            <b
              v-if="isMsgChanged"
              :class="$style.infoText"
            >
              {{ $tr('chat.message.changed.label') }}
            </b>

            <div :class="$style.infoText">
              {{ prepareDateAsSting(msg.timestamp) }}
            </div>

            <chat-message-status
              v-if="!isIncomingMsg"
              :value="outgoingMsgStatus"
              icon-size="12"
            />
          </div>
        </div>

        <div
          v-if="msgsSendingProgress[chatMsgInfo]?.progress > 0"
          :class="$style.progress"
        >
          {{ msgsSendingProgress[chatMsgInfo].progress }}%
        </div>
      </div>

      <div
        v-if="isProcessing"
        :class="$style.processing"
      >
        <ui3n-progress-circular
          indeterminate
          size="32"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.mention {
  display: inline-block;
  color: var(--color-text-chat-bubble-user-quote-header);
  padding: 2px var(--spacing-xs);
  border-radius: var(--spacing-xs);
  background-color: var(--color-bg-block-tritery-disabled);
}

.url {
  display: inline-block;
  color: var(--color-text-chat-bubble-user-quote-header);
}
</style>

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
      background-color: var(--color-bg-chat-bubble-user-default) !important;
    }
  }

  &.incoming {
    justify-content: flex-start;

    .content {
      max-width: calc(var(--message-max-width) - 95px);
      background-color: var(--color-bg-chat-bubble-other-default) !important;
    }
  }

  &.chatMessageRegularProcessing {
    pointer-events: none;
  }
}

.content {
  position: relative;
  min-width: var(--message-min-width);
  border-radius: var(--spacing-s);
  padding: var(--spacing-m) var(--spacing-sm) var(--spacing-s) var(--spacing-sm);
  font-size: var(--font-14);
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
  margin-bottom: var(--spacing-xs);
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

.progress {
  position: absolute;
  font-size: var(--font-12);
  font-weight: 500;
  color: var(--color-text-chat-bubble-other-default);
  right: var(--spacing-s);
  top: var(--spacing-xs);
  z-index: 1;
}

.footer {
  display: flex;
  width: calc(100% + 4px);
  margin-right: -4px;
  justify-content: space-between;
  align-items: flex-start;
  column-gap: var(--spacing-s);
  padding-top: var(--spacing-xs);
}

.info {
  display: flex;
  justify-content: center;
  align-items: center;
  column-gap: var(--spacing-xs);

  &.infoWithReactions {
    height: 24px;
  }
}

.infoText {
  font-size: var(--font-10);
  line-height: var(--font-12);
  font-weight: 500;
  color: var(--color-text-chat-bubble-other-sub);
}

.processing {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
