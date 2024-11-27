<!--
 Copyright (C) 2020 - 2024 3NSoft Inc.

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
import { computed, inject } from 'vue';
import { storeToRefs } from 'pinia';
import get from 'lodash/get';
import size from 'lodash/size';
import { I18nPlugin, I18N_KEY } from '@v1nt1248/3nclient-lib/plugins';
import { prepareDateAsSting } from '@v1nt1248/3nclient-lib/utils';
import { Ui3nBadge, Ui3nHtml } from '@v1nt1248/3nclient-lib';
import { useChatsStore } from '@main/store';
import { getChatSystemMessageText } from '@main/helpers/chat-ui.helper';
import type { ChatListItemView, ChatMessageView, MessageType } from '~/index';
import ChatAvatar from './chat-avatar.vue';

const vUi3nHtml = Ui3nHtml;

const props = defineProps<{
  data: ChatListItemView & { displayName: string };
}>();
const emit = defineEmits(['click']);

const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
const { currentChat } = storeToRefs(useChatsStore());

const selectedChatId = computed<string>(() => get(currentChat.value(), ['chatId'], ''));
const isGroupChat = computed<boolean>(() => size(props.data.members) > 2);

const message = computed<string>(() => {
  const { msgId, chatMessageType, messageType, body, attachments = [] } = props.data || {};

  if (!msgId)
    return ' ';

  if (chatMessageType === 'system') {
    return `<i>${getChatSystemMessageText({
      message: { body } as ChatMessageView<MessageType>,
      chat: props.data,
    })}</i>`;
  }

  const attachmentsText = attachments!.map(a => a.name).join(', ');
  return messageType === 'outgoing'
    ? `<b>You: </b>${body || `<i>${$tr('text.send.file')}: ${attachmentsText}</i>`}`
    : body || `<i>${$tr('text.receive.file')}: ${attachmentsText}</i>`;
});

const date = computed<string>(() => {
  const chatLastDate = props.data.msgId
    ? props.data.timestamp
    : props.data.createdAt;

  return prepareDateAsSting(chatLastDate!);
});
</script>

<template>
  <div
    :class="[$style.chatListItem, data.chatId === selectedChatId && $style.chatListItemSelected]"
    @click="emit('click', $event)"
  >
    <chat-avatar
      :name="data.displayName"
      :shape="isGroupChat ? 'decagon' : 'circle'"
    />

    <div :class="$style.chatListItemContent">
      <div :class="$style.chatListItemName">
        {{ data.displayName }}
      </div>
      <div
        v-ui3n-html.sanitize="message"
        :class="$style.chatListItemMessage"
      />
    </div>

    <div :class="$style.chatListItemInfo">
      <div :class="$style.chatListItemDate">
        {{ date }}
      </div>
      <div :class="$style.chatListItemStatus">
        <ui3n-badge
          v-if="data.unread"
          :value="data.unread"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
@use '../../assets/styles/mixins' as mixins;

.chatListItem {
  position: relative;
  width: 100%;
  height: calc(var(--spacing-s) * 8);
  display: flex;
  padding: 0 var(--spacing-m);
  justify-content: flex-start;
  align-items: center;
  border-radius: var(--spacing-xs);

  &:hover {
    cursor: pointer;
    background-color: var(--color-bg-chat-bubble-general-bg);
  }
}

.chatListItemSelected {
  background-color: var(--color-bg-chat-bubble-general-bg);
}

.chatListItemContent {
  position: relative;
  margin-left: var(--spacing-s);
  flex-grow: 1;
}

.chatListItemName {
  position: relative;
  height: 22px;
  font-size: var(--font-16);
  font-weight: 500;
  line-height: 22px;
  color: var(--color-text-chat-bubble-other-default);
  margin-bottom: 2px;
  @include mixins.text-overflow-ellipsis();
}

.chatListItemMessage {
  position: relative;
  height: 20px;
  font-size: var(--font-14);
  font-weight: 400;
  line-height: 20px;
  color: var(--color-text-chat-bubble-other-default);
  @include mixins.text-overflow-ellipsis();
}

.chatListItemInfo {
  position: relative;
  width: max-content;
  padding-left: var(--spacing-xs);
}

.chatListItemDate {
  position: relative;
  height: 22px;
  white-space: nowrap;
  text-align: right;
  margin-bottom: 2px;
  font-size: var(--font-10);
  font-weight: 400;
  line-height: 22px;
  color: var(--color-text-chat-bubble-other-sub);
}

.chatListItemStatus {
  position: relative;
  height: 20px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
</style>
