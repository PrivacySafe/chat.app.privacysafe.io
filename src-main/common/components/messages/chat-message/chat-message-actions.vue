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
import { computed, onBeforeMount, ref, watch } from 'vue';
import { Ui3nClickOutside, Ui3nIcon } from '@v1nt1248/3nclient-lib';
import { chatMsgActionElementHeight } from '@main/common/constants';
import type { ChatMessageAction, ChatMessageActionType, ChatMessageView } from '~/index.ts';

const vUi3nClickOutside = Ui3nClickOutside;

const props = defineProps<{
  open: boolean;
  actions: Omit<ChatMessageAction, 'conditions'>[];
  msg: ChatMessageView;
  menuProps?: {
    width?: number | string;
    maxHeight?: number | string;
  };
}>();
const emits = defineEmits<{
  (event: 'close'): void;
  (event: 'select:action', value: { action: ChatMessageActionType, chatMessageId: string }): void;
}>();

const visible = ref(false);
const canClose = ref(false);
const displayUp = ref(false);

const menuStyle = computed(() => {
  const { width = '144', maxHeight = 'auto' } = props.menuProps || {};
  return {
    width: `${width}px`,
    'max-height': maxHeight === 'auto' ? maxHeight : `${maxHeight}px`,
  };
});
const chatMsgActionElementHeightCss = computed(() => `${chatMsgActionElementHeight}px`);

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

function closeMenu() {
  if (!canClose.value) {
    return;
  }

  visible.value = false;
  canClose.value = false;
  emits('close');
}

async function handleAction(action: ChatMessageActionType) {
  emits('select:action', { action, chatMessageId: props.msg.chatMessageId });
  closeMenu();
}

watch(
  () => props.open,
  (val, oldVal) => {
    visible.value = val;
    if (val && val !== oldVal) {
      setTimeout(() => {
        canClose.value = true;
      }, 500);
    }
  }, {
    immediate: true,
  },
);
</script>

<template>
  <div
    v-if="visible"
    v-ui3n-click-outside="closeMenu"
    :style="menuStyle"
    :class="[
      $style.chatMessageActions,
      displayUp && $style.up,
      !msg.isIncomingMsg && $style.left,
      msg.isIncomingMsg && $style.right,
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
      @click.stop.prevent="handleAction(action.id)"
    >
      <div :class="$style.itemIcon">
        <ui3n-icon
          :icon="action.icon.name"
          width="14"
          height="14"
          :horizontal-flip="!!action.icon.horizontalFlip"
          :color="action.accent ? 'var(--warning-content-default)' : 'var(--color-icon-control-primary-default)'"
        />
      </div>

      <span :class="$style.itemName">{{ action.title }}</span>
    </div>
  </div>
</template>

<style lang="scss" module>
@use '@main/common/assets/styles/mixins' as mixins;

@keyframes scale {
  0% { transform: scale(1); }
  50% { transform: scale(0.75); }
  100% { transform: scale(1); }
}

.chatMessageActions {
  --action-item-height: v-bind(chatMsgActionElementHeightCss);

  position: absolute;
  padding: var(--spacing-xs);
  background-color: var(--color-bg-control-secondary-default);
  border-radius: var(--spacing-xs);
  font-size: var(--font-13);
  font-weight: 400;
  overflow-y: auto;
  z-index: 100;
  top: calc(100% - var(--spacing-s));
  @include mixins.block-shadow();

  &.up {
    top: auto;
    bottom: var(--spacing-s);
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
  height: var(--action-item-height);
  display: flex;
  justify-content: flex-start;
  align-items: center;
  color: var(--color-text-control-primary-default);

  :global(.ui3n-icon) {
    margin-right: var(--spacing-xs);
    min-width: 14px;
  }

  &:hover {
    cursor: pointer;
    background-color: var(--color-bg-control-primary-hover);

    .itemIcon {
      animation: scale 0.4s ease-in-out;
    }

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

.itemIcon {
  position: relative;
}

.itemName {
  display: block;
  flex-grow: 1;
}
</style>
