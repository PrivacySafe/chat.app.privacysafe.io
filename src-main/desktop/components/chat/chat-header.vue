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

import { computed } from 'vue';
import { Ui3nButton, Ui3nHtml } from '@v1nt1248/3nclient-lib';
import { useChatHeader } from '@main/common/composables/useChatHeader.ts';
import { useRouting } from '@main/desktop/composables/useRouting.ts';
import { getChatName } from '@main/common/utils/chat-ui.helper.ts';
import type { ChatMessageView, ChatListItemView } from '~/index.ts';
import ChatAvatar from '@main/common/components/chat/chat-avatar.vue';
import ChatHeaderActions from './chat-header-actions.vue';

const vUi3nHtml = Ui3nHtml;

const props = defineProps<{
  chat: ChatListItemView;
  messages: ChatMessageView[];
}>();

const chatVal = computed(() => props.chat);
const chatMessagesVal = computed(() => props.messages);

const { goToChatsRoute } = useRouting();

const {
  text,
  isGroupChat,
  currentChatObjId,
  isIncomingCall,
  chatWithCall,
  callDuration,
  selectAction,
  joinIncomingCall,
  dismissIncomingCall,
  startCall,
  endCall,
} = useChatHeader({
  chat: chatVal,
  messages: chatMessagesVal,
  // @ts-expect-error
  goToChats: () => goToChatsRoute(),
  isMobileMode: false,
});
</script>

<template>
  <div :class="$style.chatHeader">
    <chat-avatar
      :name="getChatName(props.chat)"
      :shape="isGroupChat ? 'decagon' : 'circle'"
      :call-in-progress="chatWithCall"
    />

    <div :class="$style.chatHeaderContent">
      <div :class="$style.chatHeaderName">
        {{ getChatName(props.chat) }}
      </div>

      <div
        v-if="chatWithCall"
        :class="$style.chatHeaderInfo"
      >
        {{ $tr('chat.header.call.duration') }}: {{ callDuration }}
      </div>

      <div
        v-else
        v-ui3n-html.sanitize="chat.lastMsg?.timestamp ? $tr('chat.header.info', { date: text }) : ''"
        :class="$style.chatHeaderInfo"
      />
    </div>

    <ui3n-button
      v-if="chatWithCall"
      type="custom"
      color="var(--error-content-default)"
      text-color="var(--error-fill-default)"
      icon="round-phone-disabled"
      icon-color="var(--error-fill-default)"
      icon-position="left"
      @click.stop.prevent="() => endCall(currentChatObjId)"
    >
      {{ $tr('va.end.call') }}
    </ui3n-button>

    <template v-else-if="isIncomingCall">
      <ui3n-button
        type="custom"
        size="small"
        color="var(--success-content-default)"
        text-color="var(--success-fill-default)"
        icon="round-phone"
        icon-color="var(--success-fill-default)"
        icon-position="left"
        @click.stop.prevent="() => joinIncomingCall(currentChatObjId, chat.incomingCall!.peerAddress)"
      >
        {{ $tr('va.presettings.btn.join') }}
      </ui3n-button>

      <ui3n-button
        type="custom"
        size="small"
        color="var(--warning-content-default)"
        text-color="var(--warning-fill-default)"
        icon="round-call-end"
        icon-color="var(--warning-fill-default)"
        icon-position="left"
        @click.stop.prevent="() => dismissIncomingCall(currentChatObjId, false)"
      >
        {{ $tr('va.presettings.btn.decline') }}
      </ui3n-button>
    </template>

    <ui3n-button
      v-else
      type="custom"
      color="var(--color-bg-button-tritery-default)"
      icon="round-phone"
      icon-color="var(--color-icon-button-tritery-default)"
      :class="$style.videoCallBtn"
      @click.stop.prevent="startCall(currentChatObjId)"
    />

    <chat-header-actions
      :disabled="isIncomingCall || chatWithCall"
      @select:action="selectAction"
    />
  </div>
</template>

<style lang="scss" module>
@use '@main/common/assets/styles/_mixins.scss' as mixins;

.chatHeader {
  position: relative;
  width: 100%;
  min-height: calc(var(--spacing-l) * 2);
  height: calc(var(--spacing-l) * 2);
  background-color: var(--color-bg-block-primary-default);
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 0 var(--spacing-m);
  column-gap: var(--spacing-s);
}

.chatHeaderContent {
  position: relative;
  flex-grow: 1;
  flex-shrink: 1;
}

.chatHeaderName,
.chatHeaderInfo {
  position: relative;
  @include mixins.text-overflow-ellipsis();
}

.chatHeaderName {
  font-size: var(--font-16);
  font-weight: 600;
  line-height: 22px;
  color: var(--color-text-block-primary-default);
}

.chatHeaderInfo {
  min-height: 14px;
  font-size: var(--font-12);
  font-weight: 400;
  line-height: 14px;
  color: var(--color-text-block-secondary-default);
}

.videoCallBtn {
  padding: 0 var(--spacing-s) !important;
  column-gap: 0 !important;
}
</style>
