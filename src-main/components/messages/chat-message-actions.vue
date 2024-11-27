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
import { computed, onBeforeMount, ref, watch } from 'vue';
import { Ui3nClickOutside, Ui3nIcon } from '@v1nt1248/3nclient-lib';
import { chatMsgActionElementHeight } from '@main/constants';
import type { ChatMessageAction, ChatMessageActionType, ChatMessageView, MessageType } from '~/index';

const vUi3nClickOutside = Ui3nClickOutside;

const props = defineProps<{
  open: boolean;
  actions: Omit<ChatMessageAction, 'conditions'>[];
  msg: ChatMessageView<MessageType>;
  menuProps?: {
    width?: number | string;
    maxHeight?: number | string;
  };
}>();
const emit = defineEmits(['close', 'select:action']);

const visible = ref(false);
const displayUp = ref(false);

const menuStyle = computed(() => {
  const { width = '144', maxHeight = 'auto' } = props.menuProps || {};
  return {
    width: `${width}px`,
    'max-height': maxHeight === 'auto' ? maxHeight : `${maxHeight}px`,
  };
});

onBeforeMount(() => {
  const calculatedMenuHeight = props.actions.length * chatMsgActionElementHeight + 12;
  const msgElement = document.getElementById(props.msg.chatMessageId!);
  const { top, height } = msgElement?.getBoundingClientRect() || { top: 0, height: 0 };
  const messagesElement = document.getElementById('chat-messages');
  const { top: wrapTop, height: wrapHeight } = messagesElement?.getBoundingClientRect() || { top: 0 };
  displayUp.value = wrapHeight
    ? ((top - wrapTop) + height + calculatedMenuHeight) > wrapHeight
    : false;
});

watch(
  () => props.open,
  val => visible.value = val,
  { immediate: true },
);

function closeMenu() {
  visible.value = false;
  emit('close');
}

async function handleAction(action: ChatMessageActionType) {
  emit('select:action', { action, chatMessageId: props.msg.chatMessageId });
  closeMenu();
}
</script>

<template>
  <div
    v-if="visible"
    v-ui3n-click-outside="closeMenu"
    :style="menuStyle"
    :class="[
      $style.chatMessageActions,
      displayUp && $style.up,
      (!msg.messageType || msg.messageType === 'outgoing') && $style.left,
      msg.messageType === 'incoming' && $style.right,
    ]"
  >
    <div
      v-for="action in actions"
      :key="action.id"
      :class="[
        $style.item,
        action.accent && $style.withAccent,
        action.blockStart && $style.withMargin,
      ]"
      @click="handleAction(action.id)"
    >
      <ui3n-icon
        :icon="action.icon.name"
        width="12"
        height="12"
        :horizontal-flip="!!action.icon.horizontalFlip"
        :color="action.accent ? 'var(--warning-content-default)' : 'var(--color-icon-control-primary-default)'"
      />
      <span :class="$style.itemName">{{ action.title }}</span>
    </div>
  </div>
</template>

<style lang="scss" module>
@use '../../assets/styles/mixins' as mixins;

.chatMessageActions {
  position: absolute;
  padding: var(--spacing-xs);
  background-color: var(--color-bg-control-secondary-default);
  border-radius: var(--spacing-xs);
  font-size: var(--font-13);
  font-weight: 400;
  overflow-y: auto;
  z-index: 100;
  top: calc(100% - var(--spacing-xs));
  @include mixins.block-shadow();


  &.up {
    top: auto;
    bottom: calc(100% - var(--spacing-s));
  }

  &.left {
    right: calc(5% + var(--spacing-s) * 1.5);
  }

  &.right {
    left: calc(5% + var(--spacing-s) * 1.5);
  }
}

.item {
  position: relative;
  width: 100%;
  height: var(--spacing-ml);
  display: flex;
  justify-content: flex-start;
  align-items: center;
  color: var(--color-text-control-primary-default);

  :global(.ui3n-icon) {
    margin-right: var(--spacing-xs);
    min-width: 12px;
  }

  &:hover {
    cursor: pointer;
    background-color: var(--color-bg-control-primary-hover);

    :global(.ui3n-icon) {
      color: var(--color-icon-control-accent-hover);
    }
  }

  &.withAccent {
    color: var(--warning-content-default);

    &:hover {
      :global(.ui3n-icon) {
        color: var(--warning-content-default);
      }
    }
  }

  &.withMargin {
    margin-top: var(--spacing-xs);
  }
}

.itemName {
  display: block;
  flex-grow: 1;
}
</style>
