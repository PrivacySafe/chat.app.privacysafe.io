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
  import { computed, inject, toRefs } from 'vue'
  import { get, size } from 'lodash'
  import { I18nPlugin, I18N_KEY, prepareDateAsSting, Ui3nBadge, Ui3nHtml } from '@v1nt1248/3nclient-lib'
  import { useChatsStore } from '../../store'
  import { getChatSystemMessageText } from '../../helpers/chat-ui.helper'
  import ChatAvatar from './chat-avatar.vue'

  const vUi3nHtml = Ui3nHtml

  const emit = defineEmits(['click'])
  const props = defineProps<{
    data: ChatListItemView & { displayName: string };
  }>()

  const { $tr } = inject<I18nPlugin>(I18N_KEY)!
  const { currentChat } = toRefs(useChatsStore())

  const selectedChatId = computed<string>(() => get(currentChat.value(), ['chatId'], ''))
  const isGroupChat = computed<boolean>(() => size(props.data.members) > 2)

  const message = computed<string>(() => {
    const { msgId, chatMessageType, messageType, body, attachments = [] } = props.data || {}

    if (!msgId)
      return ' '

    if (chatMessageType === 'system') {
      return `<i>${getChatSystemMessageText({
        message: { body } as ChatMessageView<MessageType>,
        chat: props.data,
      })}</i>`
    }

    const attachmentsText = attachments!.map(a => a.name).join(', ')
    return messageType === 'outgoing'
      ? `<b>You: </b>${body || `<i>${$tr('text.send.file')}: ${attachmentsText}</i>`}`
      : body || `<i>${$tr('text.receive.file')}: ${attachmentsText}</i>`
  })

  const date = computed<string>(() => {
    const chatLastDate = props.data.msgId
      ? props.data.timestamp
      : props.data.createdAt

    return prepareDateAsSting(chatLastDate!)
  })
</script>

<template>
  <div
    class="chat-list-item"
    :class="{ 'chat-list-item--selected': props.data.chatId === selectedChatId }"
    @click="emit('click', $event)"
  >
    <chat-avatar
      :name="props.data.displayName"
      :shape="isGroupChat ? 'decagon' : 'circle'"
    />

    <div class="chat-list-item__content">
      <div class="chat-list-item__name">
        {{ props.data.displayName }}
      </div>
      <div
        v-ui3n-html.sanitize="message"
        class="chat-list-item__message"
      />
    </div>

    <div class="chat-list-item__info">
      <div class="chat-list-item__date">
        {{ date }}
      </div>
      <div class="chat-list-item__status">
        <ui3n-badge
          v-if="props.data.unread"
          :value="props.data.unread"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import "../../assets/styles/mixins";

  .chat-list-item {
    position: relative;
    width: 100%;
    height: calc(var(--base-size) * 8);
    display: flex;
    padding: 0 calc(var(--base-size) * 2);
    justify-content: flex-start;
    align-items: center;
    border-bottom: 1px solid var(--system-white);

    &__content {
      position: relative;
      width: calc(100% - var(--base-size) * 12.5);
      margin-left: var(--base-size);
    }

    &__name {
      position: relative;
      height: 22px;
      font-size: var(--font-16);
      font-weight: 500;
      line-height: 22px;
      color: var(--black-90);
      margin-bottom: 2px;
      @include text-overflow-ellipsis();
    }

    &__message {
      position: relative;
      height: 20px;
      font-size: var(--font-14);
      font-weight: 400;
      line-height: 20px;
      @include text-overflow-ellipsis();
    }

    &__info {
      position: relative;
      width: calc(var(--base-size) * 7);
    }

    &__date {
      position: relative;
      height: 22px;
      text-align: right;
      margin-bottom: 2px;
      font-size: var(--font-9);
      font-weight: 400;
      line-height: 22px;
      color: var(--black-30);
    }

    &__status {
      position: relative;
      height: 20px;
      display: flex;
      justify-content: flex-end;
      align-items: center;

      :deep(.var-badge) {
        max-height: 20px;
        display: flex;
        top: -2px;

        .var-badge__content {
          line-height: 1;
          padding: 4px 6px;
        }
      }
    }

    &:hover {
      cursor: pointer;
      background-color: var(--blue-main-20);
    }

    &--selected {
      background-color: var(--blue-main-20);
    }
  }
</style>
