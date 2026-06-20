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
  import { computed, ref } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { storeToRefs } from 'pinia';
  import {
    Ui3nDialog,
    type Ui3nDialogComponentProps,
    type Ui3nDialogEvent,
    Ui3nInput,
  } from '@v1nt1248/3nclient-lib';
  import { useChatsStore } from '@main/common/store/chats.store.ts';
  import { useChatStore } from '@main/common/store/chat.store.ts';
  import { areChatIdsEqual } from '@shared/chat-ids.ts';
  import type { ChatIdObj } from '~/asmail-msgs.types.ts';
  import ChatAvatar from '../chat/chat-avatar.vue';

  defineProps<{
    dialogProps?: Ui3nDialogComponentProps<{ chatId?: ChatIdObj; contact?: { mail: string; name: string } }>;
  }>();
  const emits = defineEmits<{
    (
      event: 'action',
      value: { event: Ui3nDialogEvent; data?: { chatId?: ChatIdObj; contact?: { mail: string; name: string } } },
    ): void;
  }>();

  const { t } = useI18n();

  const { chatListSortedByTime } = storeToRefs(useChatsStore());
  const { currentChatId } = storeToRefs(useChatStore());

  const searchText = ref('');

  // We can only make forward messages to already created and active chats (having accept)
  const filteredChatList = computed(() =>
    chatListSortedByTime.value.filter(
      c =>
        c.displayName.toLowerCase().includes(searchText.value.toLowerCase()) &&
        !['initiated', 'invited'].includes(c.status) &&
        !areChatIdsEqual(currentChatId.value, c),
    ),
  );

  function selectItem({ chatId, contact }: { chatId?: ChatIdObj; contact?: { mail: string; name: string } }) {
    emits('action', { event: 'confirm', data: { chatId, contact } });
  }
</script>

<template>
  <ui3n-dialog
    v-bind="dialogProps"
    :class="$style.msgForwardDialog"
    @action="emits('action', $event)"
  >
    <template #body>
      <div :class="$style.messageForwardDialog">
        <ui3n-input
          v-model="searchText"
          icon="round-search"
          clearable
          :class="$style.search"
        />

        <div :class="$style.messageForwardDialogBody">
          <h4 :class="$style.messageForwardDialogSubtitle">
            {{ t('chat.message.dialog.forward.section.chats.title') }}
          </h4>

          <template v-if="filteredChatList.length">
            <div
              v-for="chat in filteredChatList"
              :key="chat.chatId"
              :class="$style.messageForwardDialogItem"
              @click="
                selectItem({
                  chatId: { isGroupChat: chat.isGroupChat, chatId: chat.chatId },
                })
              "
            >
              <chat-avatar
                :name="chat.displayName"
                :shape="chat.isGroupChat ? 'decagon' : 'circle'"
                :size="28"
                :settings="chat.settings"
              />
              <div :class="$style.messageForwardDialogItemName">
                {{ chat.displayName }}
              </div>
            </div>
          </template>

          <template v-else>
            <div :class="$style.messageForwardDialogEmpty">
              {{ t('chat.message.dialog.forward.section.chats.empty') }}
            </div>
          </template>
        </div>
      </div>
    </template>
  </ui3n-dialog>
</template>

<style lang="scss" module>
  @use '@main/common/assets/styles/mixins' as mixins;

  .msgForwardDialog {
    --forward-dialog-body-offset: 64px;

    position: relative;
    width: 400px !important;
    border-radius: var(--spacing-m) !important;
  }

  .messageForwardDialog {
    position: relative;
    height: 380px;
    padding: 16px;
    overflow: hidden;
  }

  .search {
    margin-bottom: var(--spacing-m);
  }

  .messageForwardDialogBody {
    position: relative;
    height: calc(100% - var(--forward-dialog-body-offset));
    overflow-y: auto;
    overflow-x: hidden;
  }

  .messageForwardDialogSubtitle {
    font-size: var(--font-12);
    font-weight: 500;
    color: var(--color-text-block-primary-default);
    margin: 0 0 var(--spacing-s);
  }

  .messageForwardDialogItem {
    position: relative;
    width: 100%;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    height: var(--spacing-xl);
    cursor: pointer;

    &:hover {
      background-color: var(--color-bg-chat-bubble-general-bg);
    }
  }

  .messageForwardDialogItemName {
    position: relative;
    width: calc(100% - calc(var(--spacing-s) * 3.5));
    margin-left: var(--spacing-xs);
    font-size: var(--font-12);
    font-weight: 500;
    color: var(--color-text-block-primary-default);
    @include mixins.text-overflow-ellipsis();
  }

  .messageForwardDialogEmpty {
    position: relative;
    width: 100%;
    text-align: center;
    font-size: var(--font-12);
    font-weight: 500;
    font-style: italic;
    color: var(--color-text-chat-bubble-other-default);
    margin-bottom: var(--spacing-s);
  }
</style>
