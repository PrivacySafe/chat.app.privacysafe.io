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
import { computed, inject, watch } from 'vue';
import { storeToRefs } from 'pinia';
import dayjs from 'dayjs';
import { I18N_KEY, I18nPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { prepareDateAsSting } from '@v1nt1248/3nclient-lib/utils';
import { Ui3nBadge, Ui3nButton, Ui3nIcon, Ui3nHtml } from '@v1nt1248/3nclient-lib';
import { getTextForChatInvitationMessage, getTextForChatSystemMessage } from '@main/common/utils/chat-ui.helper';
import { useAppStore } from '@main/common/store/app.store';
import { useUiIncomingStore } from '@main/common/store/ui.incoming.store';
import { useChatStore } from '@main/common/store/chat.store';
import type { ChatListItemView, OutgoingMessageStatus } from '~/index';
import ChatAvatar from '@main/common/components/chat/chat-avatar.vue';
import ChatMessageStatus from '@main/common/components/messages/chat-message/chat-message-status.vue';

const vUi3nHtml = Ui3nHtml;

const props = defineProps<{
  data: ChatListItemView & { displayName: string };
}>();
const emit = defineEmits(['click']);

const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
const { user: ownAddr } = storeToRefs(useAppStore());
const { currentChatId } = storeToRefs(useChatStore());
const { toggleRinging, joinIncomingCall, dismissIncomingCall, endCall } = useUiIncomingStore();

const selectedChatId = computed<string>(() => currentChatId.value ? currentChatId.value.chatId : '');

const isGroupChat = computed<boolean>(() => props.data.isGroupChat);
const currentChatObjId = computed(() => ({ isGroupChat: isGroupChat.value, chatId: props.data.chatId }));
const isIncomingCall = computed(() => props.data.incomingCall && props.data.incomingCall.chatId && props.data.incomingCall.peerAddress);
const chatWithCall = computed(() => !!props.data.callStart);

const isLastMsgIncoming = computed(() => {
  if (!props.data.lastMsg) return true;
  return props.data.lastMsg.isIncomingMsg;
});
const lastMsgStatus = computed(() => {
  if (isLastMsgIncoming.value || props.data.lastMsg?.chatMessageType !== 'regular') return undefined;

  return props.data.lastMsg?.status as OutgoingMessageStatus;
});

const message = computed<string>(() => {
  const lastMsg = props.data.lastMsg;
  if (!lastMsg) return ' ';

  switch (lastMsg.chatMessageType) {
    case 'regular': {
      const { attachments, isIncomingMsg, body } = lastMsg;
      const attachmentsText = attachments?.map(a => a.name).join(', ') || ' ';
      if (isIncomingMsg) {
        return body || `<i>${$tr('text.receive.file')}: ${attachmentsText}</i>`;
      }

      return `<b>${$tr('text.msg-sender.you')}: </b>${body || `<i>${$tr('text.send.file')}: ${attachmentsText}</i>`}`;
    }

    case 'system':
      return `<i>${getTextForChatSystemMessage(lastMsg, props.data.isGroupChat, ownAddr.value)}</i>`;

    case 'invitation':
      return `<i>${getTextForChatInvitationMessage(lastMsg, props.data.status)}</i>`;

    default:
      return ' ';
  }
});

const date = computed<string>(() => {
  const chatLastDate = props.data.lastMsg?.timestamp
    ? props.data.lastMsg.timestamp
    : props.data.createdAt;

  return prepareDateAsSting(chatLastDate!);
});

const callInOnSince = computed(() => {
  if (chatWithCall.value) {
    return dayjs(props.data.callStart).format('HH:mm');
  }

  return '';
});

watch(
  isIncomingCall,
  async (val) => {
    await toggleRinging(!!val);
  },
);
</script>

<template>
  <div
    :class="[$style.chatListItem, data.chatId === selectedChatId && $style.chatListItemSelected]"
    @click="emit('click', $event)"
  >
    <chat-avatar
      :name="data.displayName"
      :shape="isGroupChat ? 'decagon' : 'circle'"
      :call-in-progress="chatWithCall"
      :settings="data.settings"
    />

    <div :class="$style.chatListItemBody">
      <div :class="$style.chatListItemContent">
        <div :class="[$style.chatListItemName, (chatWithCall || isIncomingCall) && $style.callInProgress]">
          <ui3n-icon
            v-if="chatWithCall || isIncomingCall"
            icon="round-phone-in-talk"
            :width="16"
            :height="16"
            color="var(--color-icon-block-accent-default)"
          />

          <span>{{ data.displayName }}</span>
        </div>

        <div
          v-if="chatWithCall || isIncomingCall"
          :class="$style.chatListItemMessage"
        >
          <i v-if="chatWithCall">{{ $tr('va.call.in.progress') }} {{ callInOnSince }}</i>
          <i v-else>{{ $tr('va.presettings.incoming.call', { address: data.incomingCall!.peerAddress }) }}</i>
        </div>

        <div
          v-else
          v-ui3n-html:sanitize="message"
          :class="$style.chatListItemMessage"
        />
      </div>

      <div :class="$style.chatListItemInfo">
        <div :class="$style.chatListItemDate">
          {{ date }}
        </div>

        <div :class="$style.chatListItemStatus">
          <ui3n-button
            v-if="chatWithCall"
            type="custom"
            size="small"
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
              @click.stop.prevent="() => joinIncomingCall(currentChatObjId, data.incomingCall!.peerAddress)"
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


          <template v-else>
            <ui3n-badge
              v-if="isLastMsgIncoming && data.unread"
              :value="data.unread"
            />

            <chat-message-status
              v-if="!isLastMsgIncoming && lastMsgStatus"
              :value="lastMsgStatus"
              icon-size="12"
            />
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
@use '@main/common/assets/styles/mixins' as mixins;

.chatListItem {
  --chat-list-item-height: 64px;

  position: relative;
  width: 100%;
  height: var(--chat-list-item-height);
  padding: 0 var(--spacing-m);
  display: flex;
  justify-content: flex-start;
  align-items: center;
  border-radius: var(--spacing-xs);

  &:hover {
    cursor: pointer;
    background-color: var(--color-bg-chat-bubble-general-bg);
  }

  &.chatListItemSelected {
    background-color: var(--color-bg-chat-bubble-general-bg);
  }
}

.chatListItemBody {
  position: relative;
  width: calc(100% - 36px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-left: var(--spacing-s);
  overflow: hidden;
}

.chatListItemContent {
  position: relative;
  flex-grow: 1;
  overflow: hidden;
}

.chatListItemName {
  position: relative;
  height: 22px;
  width: 100%;

  span {
    display: block;
    font-size: var(--font-16);
    font-weight: 500;
    line-height: 22px;
    color: var(--color-text-chat-bubble-other-default);
    @include mixins.text-overflow-ellipsis();
  }

  &.callInProgress {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    column-gap: var(--spacing-xs);

    span {
      @include mixins.text-overflow-ellipsis(calc(100% - 20px));
    }
  }
}

.chatListItemMessage {
  position: relative;
  height: var(--spacing-ml);
  font-size: var(--font-14);
  font-weight: 400;
  line-height: var(--spacing-ml);;
  color: var(--color-text-chat-bubble-other-default);
  @include mixins.text-overflow-ellipsis();
}

.chatListItemInfo {
  position: relative;
  width: max-content;
  padding: 0 var(--spacing-xs);
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
  height: var(--spacing-ml);;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  column-gap: var(--spacing-xs);
}
</style>
