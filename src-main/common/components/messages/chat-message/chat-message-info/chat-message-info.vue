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
<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue';
import { I18N_KEY, I18nPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { type Nullable, Ui3nButton, Ui3nTabs, Ui3nTooltip } from '@v1nt1248/3nclient-lib';
import { useAppStore } from '@main/common/store/app.store';
import type { ChatMessageHistoryChange, RegularMsgView } from '~/index';
import { ONE_HOUR, ONE_DAY, ONE_MONTH, ONE_MINUTE } from '@shared/constants';
import ChatMessageInfoText from './chat-message-info-text.vue';
import ChatMessageInfoReactions from './chat-message-info-reactions.vue';
import ChatMessageInfoErrors from './chat-message-info-errors.vue';

const props = defineProps<{
  msg: Nullable<RegularMsgView>
}>();
const emits = defineEmits<{
  (event: 'close'): void;
}>();

const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
const appStore = useAppStore();

let remainingMessageLifespanTimerId: ReturnType<typeof setInterval> | null = null;

const currentTab = ref(0);
const remainingMessageLifespan = ref(0);
const remainingMessageLifespanAsText = ref('');

const currentMsgText = computed(() => props.msg?.body || '');
const currentReactions = computed(() => props.msg?.reactions ?? {});

const changes = computed(() => props.msg?.history?.changes || [] as ChatMessageHistoryChange[]);

function exitMsgInfo() {
  currentTab.value = 0;
  emits('close');
}

function getRemainingMessageLifespanAsString() {
  if (!props.msg || (props.msg.removeAfter === 0)) {
    remainingMessageLifespanAsText.value = '';
    return;
  }

  const now = Date.now();
  const diff = props.msg.removeAfter - now;
  if (diff < ONE_HOUR) {
    const minutes = Math.floor(diff / ONE_MINUTE);
    const seconds = (diff % ONE_MINUTE) / 1000;
    remainingMessageLifespanAsText.value = `${minutes} ${$tr('chat.minutes')} ${seconds} ${$tr('chat.seconds')}`;
  } else if (diff < ONE_DAY) {
    const hours = Math.floor(diff / ONE_HOUR);
    const minutes = Math.ceil((diff - hours * ONE_HOUR) / ONE_MINUTE);
    remainingMessageLifespanAsText.value = `${hours} ${$tr('chat.hours')} ${minutes} ${$tr('chat.minutes')}`;
  } else if (diff < ONE_MONTH) {
    const days = Math.floor(diff / ONE_DAY);
    const hours = Math.floor((diff - days * ONE_DAY) / ONE_HOUR);
    const minutes = Math.ceil((diff - days * ONE_DAY - hours * ONE_HOUR) / ONE_MINUTE);
    remainingMessageLifespanAsText.value = `${days} ${$tr('chat.days')} ${hours} ${$tr('chat.hours')} ${minutes} ${$tr('chat.minutes')}`;
  } else {
    const months = Math.floor(diff / ONE_MONTH);
    const days = Math.floor((diff - months * ONE_MONTH) / ONE_DAY);
    const hours = Math.floor((diff - months * ONE_MONTH - days * ONE_DAY) / ONE_HOUR);
    const minutes = Math.ceil((diff - months * ONE_MONTH - days * ONE_DAY - hours * ONE_HOUR) / ONE_MINUTE);
    remainingMessageLifespanAsText.value = `${months} ${$tr('chat.months')} ${days} ${$tr('chat.days')} ${hours} ${$tr('chat.hours')} ${minutes} ${$tr('chat.minutes')}`;
  }
}

watch(
  () => props.msg?.chatMessageId,
  (val, oldVal) => {
    if (val && val !== oldVal) {
      remainingMessageLifespanTimerId && clearInterval(remainingMessageLifespanTimerId);

      remainingMessageLifespanTimerId = setInterval(() => {
        if (props.msg && props.msg.removeAfter) {
          remainingMessageLifespan.value = props.msg.removeAfter - Date.now();
        }

        getRemainingMessageLifespanAsString();
      }, 1000);
    }
  }, {
    immediate: true,
  },
);

onBeforeUnmount(() => {
  remainingMessageLifespanTimerId && clearInterval(remainingMessageLifespanTimerId);
});
</script>

<template>
  <div
    v-if="msg"
    :class="$style.chatMessageInfo"
  >
    <div :class="$style.toolbar">
      <ui3n-tooltip
        content="Back to the message list"
        position-strategy="fixed"
        placement="top-start"
      >
        <ui3n-button
          type="icon"
          color="ar(--color-bg-chat-bubble-general-bg)"
          icon="round-arrow-back"
          icon-size="24"
          icon-color="var(--color-icon-block-primary-default)"
          @click.stop.prevent="exitMsgInfo"
        />
      </ui3n-tooltip>

      <span v-if="!msg || !msg?.removeAfter">
        {{ $tr('chat.message.info.auto-delete.off') }}
      </span>

      <template v-else>
        <span v-if="appStore.isMobileMode">
          {{ $tr('chat.message.info.mobile.removeAfter', { period: remainingMessageLifespanAsText }) }}
        </span>
        <span v-else>{{ $tr('chat.message.info.removeAfter', { period: remainingMessageLifespanAsText }) }}</span>
      </template>
    </div>

    <div :class="$style.body">
      <ui3n-tabs v-model="currentTab">
        <div :class="$style.tab">
          {{ $tr('chat.message.info.text.title') }}
        </div>
        <div :class="$style.tab">
          {{ $tr('chat.message.info.reactions.title') }}
        </div>
        <div :class="$style.tab">
          {{ $tr('chat.message.info.errors.title') }}
        </div>
      </ui3n-tabs>

      <div :class="$style.content">
        <chat-message-info-text
          v-if="currentTab === 0"
          :current-text="currentMsgText"
          :changes="changes"
          :timestamp="msg.timestamp"
        />

        <chat-message-info-reactions
          v-if="currentTab === 1"
          :current-reactions="currentReactions"
          :changes="changes"
          :timestamp="msg.timestamp"
        />

        <chat-message-info-errors
          v-if="currentTab === 2"
          :msg-status="msg.status"
          :changes="changes"
          :timestamp="msg.timestamp"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
.chatMessageInfo {
  --msg-info-toolbar-height: var(--spacing-xl);
  --msg-info-tab-height: var(--spacing-l);

  position: absolute;
  inset: 0;
  background-color: var(--color-bg-chat-bubble-general-bg);
  z-index: 100;
}

.toolbar {
  display: flex;
  width: 100%;
  height: var(--msg-info-toolbar-height);
  padding: 0 var(--spacing-s);
  justify-content: flex-start;
  align-items: center;
  column-gap: var(--spacing-m);
  font-size: var(--font-16);
  font-weight: 500;
  color: var(--color-text-block-primary-default);
}

.body {
  position: relative;
  width: 100%;
  height: calc(100% - var(--msg-info-toolbar-height));
  padding: 0 var(--spacing-s);

  & > div {
    --ui3n-tabs-height: var(--msg-info-tab-height);
  }
}

.tab {
  position: relative;
  width: calc(100% / 3);
  height: var(--msg-info-tab-height);
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: var(--font-14);
  font-weight: 600;
  color: var(--color-text-block-primary-default);
  text-transform: uppercase;
}

.content {
  position: relative;
  width: 100%;
  height: calc(100% - var(--msg-info-tab-height));
  padding: var(--spacing-m) var(--spacing-s);
}
</style>
