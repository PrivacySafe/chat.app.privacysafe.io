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
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { prepareDateAsSting } from '@v1nt1248/3nclient-lib/utils';
import { Ui3nIcon } from '@v1nt1248/3nclient-lib';
import { getTextForChatInvitationMessage, getTextForChatSystemMessage } from '@main/common/utils/chat-ui.helper';
import { useAppStore } from '@main/common/store/app.store';
import {
  CallMsgBodySysMsgData,
  ChatInvitationMsgView,
  ChatMessageView,
  ChatSysMsgView,
  WebRTCMsgBodySysMsgData,
} from '~/index';

const props = defineProps<{
  msg: ChatMessageView;
}>();

const { isMobileMode, user: ownAddr } = storeToRefs(useAppStore());

const data = computed(() => {
  const { chatMessageType } = props.msg;
  return chatMessageType === 'system'
    ? (props.msg as ChatSysMsgView).systemData
    : (props.msg as ChatInvitationMsgView).inviteData;
});

const isSystemMsgByCall = computed(() => ['call', 'webrtc-call'].includes((data.value as ChatSysMsgView['systemData']).event));
const isSystemMsgByMissedCall = computed(() => (data.value as ChatSysMsgView['systemData']).event === 'webrtc-call');
const isSystemMsgByIncomingCall = computed(() => isSystemMsgByCall.value
  && (
    ((data.value as ChatSysMsgView['systemData']) as CallMsgBodySysMsgData).value.direction === 'incoming'
  || ((data.value as ChatSysMsgView['systemData']) as WebRTCMsgBodySysMsgData).value.subType === 'outgoing-call-cancelled'
));
const callDuration = computed(() => {
  if (!isSystemMsgByCall.value) {
    return null;
  }

  const { endTimestamp } = ((data.value as ChatSysMsgView['systemData']) as CallMsgBodySysMsgData).value;
  if (typeof endTimestamp !== 'number') {
    return null;
  }

  const duration = props.msg.timestamp > endTimestamp ? 0 : endTimestamp - props.msg.timestamp;
  const durationInSeconds = Math.floor(duration / 1000);

  if (durationInSeconds < 60) {
    return `${String(durationInSeconds).padStart(2, '0')} s`;
  }

  const durationInMinutes = Math.floor(durationInSeconds / 60);
  const h = Math.floor(durationInMinutes / 60);
  const m = durationInMinutes % 60;

  if (h === 0) {
    return `${m}m`;
  }

  return `${h}H ${String(m).padStart(2, '0')}m`;
});

const msgText = computed(() => {
  const { chatMessageType } = props.msg;
  switch (chatMessageType) {
    case 'invitation':
      return getTextForChatInvitationMessage(props.msg);
    case 'system': {
      const text = getTextForChatSystemMessage(props.msg, props.msg.chatId.isGroupChat, ownAddr.value);
      return isSystemMsgByCall.value && callDuration.value ? `${text} (${callDuration.value})` : text;
    }
    default:
      return props.msg.body;
  }
});

const date = computed(() => {
  const { timestamp } = props.msg;
  return prepareDateAsSting(timestamp);
});
</script>

<template>
  <div
    :class="[
      $style.chatMessageSystem,
      isMobileMode && $style.chatMessageSystemMobile,
      isSystemMsgByCall && $style.byCall,
      isSystemMsgByMissedCall && $style.warning,
    ]"
  >
    <ui3n-icon
      v-if="isSystemMsgByCall"
      :icon="isSystemMsgByIncomingCall ? 'round-call-received' : 'round-call-made'"
      :color="isSystemMsgByIncomingCall ? 'var(--success-content-default)' : 'var(--error-content-default)'"
      :width="16"
      :height="16"
      :class="$style.icon"
    />

    <div :class="$style.text">
      <span>{{ msgText }}</span>
    </div>

    <div :class="$style.date">
      {{ date }}
    </div>
  </div>
</template>

<style lang="scss" module>
@use '@main/common/assets/styles/mixins' as mixins;

.chatMessageSystem {
  position: relative;
  width: fit-content;
  max-width: 90%;
  overflow: hidden;
  height: var(--spacing-l);
  margin: var(--spacing-s) auto;
  //border-radius: var(--spacing-l);
  display: flex;
  justify-content: space-between;
  align-items: center;
  column-gap: var(--spacing-s);
  padding: 0 12px;
  font-size: var(--font-12);
  font-weight: 500;
  line-height: var(--font-16);
  user-select: none;

  &.chatMessageSystemMobile {
    height: auto;
    padding: var(--spacing-xs) var(--spacing-m);

    .text {
      span {
        white-space: break-spaces;
      }
    }

    .date {
      flex-grow: 1;
      min-width: fit-content;
    }

    &.byCall {
      .icon {
        top: auto;
      }
    }
  }

  &.byCall {
    padding-left: var(--spacing-l);

    .icon {
      position: absolute;
      left: 10px;
      top: var(--spacing-s);
    }

    .text {
      span {
        color: var(--color-text-block-primary-default)
      }
    }

    &.warning {
      .text {
        span {
          color: var(--color-text-block-warning-default);
        }
      }
    }
  }
}

.text {
  span {
    color: var(--color-text-block-secondary-default);

    @include mixins.text-overflow-ellipsis();
  }
}

.date {
  color: var(--color-text-chat-bubble-user-sub);
}
</style>
