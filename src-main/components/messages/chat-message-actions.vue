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
  import { computed, onBeforeMount, ref, watch } from 'vue'
  import { Ui3nClickOutside, Ui3nIcon } from '@v1nt1248/3nclient-lib'
  import { chatMsgActionElementHeight } from '../../constants'

  const vUi3nClickOutside = Ui3nClickOutside

  const props = defineProps<{
    open: boolean;
    actions: Omit<ChatMessageAction, 'conditions'>[];
    msg: ChatMessageView<MessageType>;
    menuProps?: {
      width?: number|string;
      maxHeight?: number|string;
    };
  }>()
  const emit = defineEmits(['close', 'select:action'])

  const visible = ref(false)
  const displayUp = ref(false)

  const menuStyle = computed(() => {
    const { width = '144', maxHeight = 'auto' } = props.menuProps || {}
    return {
      width: `${width}px`,
      'max-height': maxHeight === 'auto' ? maxHeight : `${maxHeight}px`,
    }
  })

  onBeforeMount(() => {
    const calculatedMenuHeight = props.actions.length * chatMsgActionElementHeight + 12
    const msgElement = document.getElementById(props.msg.chatMessageId!)
    const { top, height } = msgElement?.getBoundingClientRect() || { top: 0, height: 0 }
    const messagesElement = document.getElementById('chat-messages')
    const { top: wrapTop, height: wrapHeight } = messagesElement?.getBoundingClientRect() || { top: 0 }
    displayUp.value = wrapHeight
    ? ((top - wrapTop) + height + calculatedMenuHeight) > wrapHeight
    : false
  })

  watch(
  () => props.open,
  val => visible.value = val,
    { immediate: true },
  )

  const closeMenu = () => {
    visible.value = false
    emit('close')
  }

  const handleAction = async (action: ChatMessageActionType) => {
    emit('select:action', { action, chatMessageId: props.msg.chatMessageId })
    closeMenu()
  }
</script>

<template>
  <div
    v-if="visible"
    v-ui3n-click-outside="closeMenu"
    :style="menuStyle"
    :class="[
      'chat-message-actions',
      {
        'chat-message-actions--up': displayUp,
        'chat-message-actions--left': !props.msg.messageType || props.msg.messageType === 'outgoing',
        'chat-message-actions--right': props.msg.messageType === 'incoming',
      },
    ]"
  >
    <div
      v-for="action in props.actions"
      :key="action.id"
      :class="[
        'chat-message-actions__item',
        {
          'chat-message-actions__item--with-margin': action.blockStart,
          'chat-message-actions__item--with-accent': action.accent,
        }
      ]"
      @click="handleAction(action.id)"
    >
      <ui3n-icon
        :icon="action.icon.name"
        width="12"
        height="12"
        :horizontal-flip="!!action.icon.horizontalFlip"
        :color="action.accent ? 'var(--pear-100)' : 'var(--base-90)'"
      />
      <span class="chat-message-actions__item-name">{{ action.title }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import "../../assets/styles/mixins";

  .chat-message-actions {
    position: absolute;
    padding: var(--half-size);
    background-color: var(--gray-50);
    border-radius: var(--half-size);
    font-size: var(--font-13);
    font-weight: 400;
    overflow-y: auto;
    z-index: 100;
    top: calc(100% - var(--base-size));
    @include block-shadow;

    &__item {
      position: relative;
      width: 100%;
      height: calc(var(--base-size) * 3);
      display: flex;
      justify-content: flex-start;
      align-items: center;
      color: var(--black-90);

      .iconify {
        margin-right: var(--half-size);
        min-width: 12px;
      }

      &-name {
        display: block;
        flex-grow: 1;
      }

      &:hover {
        cursor: pointer;
        background-color: var(--blue-main-30);
      }

      &--with-margin {
        margin-top: var(--half-size);
      }

      &--with-accent {
        color: var(--pear-100);
      }
    }

    &--left {
      right: calc(5% + var(--base-size) * 1.5);
    }

    &--right {
      left: calc(5% + var(--base-size) * 1.5);
    }

    &--up {
      top: auto;
      bottom: calc(100% - var(--base-size));
    }
  }
</style>
