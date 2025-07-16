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
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, defineAsyncComponent, inject } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import {
  I18N_KEY,
  DIALOGS_KEY,
  NOTIFICATIONS_KEY,
} from '@v1nt1248/3nclient-lib/plugins';
import { capitalize, prepareDateAsSting } from '@v1nt1248/3nclient-lib/utils';
import { Ui3nButton, Ui3nHtml } from '@v1nt1248/3nclient-lib';
import { exportChatMessages } from '@main/utils/chats.helper';
import { getChatName } from '@main/utils/chat-ui.helper';
import { videoOpenerSrv } from '@main/store/external-services';
import type { ChatMessageView, ChatListItemView } from '~/index';
import ChatAvatar from './chat-avatar.vue';
import ChatHeaderActions from './chat-header-actions.vue';
import { useChatsStore } from '@main/store/chats.store';
import { useChatStore } from '@main/store/chat.store';
import { areChatIdsEqual } from '@shared/chat-ids';

const vUi3nHtml = Ui3nHtml;

const props = defineProps<{
  chat: ChatListItemView;
  messages: ChatMessageView[];
}>();

const { $tr } = inject(I18N_KEY)!;
const dialog = inject(DIALOGS_KEY)!;
const notification = inject(NOTIFICATIONS_KEY)!;

const router = useRouter();

const { refreshChatList } = useChatsStore();
const chatStore = useChatStore();
const { currentChatId } = storeToRefs(chatStore);
const {
  resetCurrentChat, deleteAllMessagesInChat,
  renameChat, leaveChat, deleteChat
} = chatStore;

const text = computed<string>(() => {
  if (!props.chat.lastMsg) {
    return '';
  }
  return prepareDateAsSting(props.chat.lastMsg.timestamp);
});
const isGroupChat = computed<boolean>(() => props.chat.isGroupChat);

async function runChatHistoryExporting() {
  const result = await exportChatMessages({
    chatName: props.chat.name,
    isGroupChat: props.chat.isGroupChat,
    messages: props.messages,
  });
  if (result !== undefined) {
    notification.$createNotice({
      type: result ? 'success' : 'error',
      content: result ? 'The file is saved.' : 'Error on saving file.',
    });
  }
}

async function runChatHistoryCleaning() {
  const component = defineAsyncComponent(() => import('../dialogs/confirmation-dialog.vue'));
  dialog.$openDialog({
    component,
    dialogProps: {
      title: $tr('chat.history.clean.dialog.title'),
      onConfirm: async () => {
        await deleteAllMessagesInChat(props.chat);
      },
    },
  });
}

function openChatInfoDialog() {
  const component = defineAsyncComponent(() => import('../dialogs/chat-info-dialog.vue'));
  dialog.$openDialog({
    component,
    dialogProps: {
      title: $tr('chat.info.dialog.title'),
      confirmButton: false,
      cancelButton: false,
    },
    componentProps: {
      chat: props.chat,
    },
  });
}

function runChatRenaming() {
  const component = defineAsyncComponent(() => import('../dialogs/chat-rename-dialog.vue'));
  dialog.$openDialog({
    component,
    componentProps: {
      chatName: props.chat.name,
    },
    dialogProps: {
      title: $tr('chat.rename.dialog.title'),
      confirmButtonText: $tr('chat.rename.dialog.button.text'),
      onConfirm: (async (
        { oldName, newName }: { oldName: string, newName: string }
      ) => {
        if (newName !== oldName) {
          await renameChat(props.chat, newName);
        }
      }) as any,
    },
  });
}

async function closeChat() {
  resetCurrentChat();
  await router.push('/chats');
}

function runChatDeleting() {
  const component = defineAsyncComponent(() => import('../dialogs/confirmation-dialog.vue'));
  dialog.$openDialog({
    component,
    componentProps: {
      dialogText: $tr('chat.delete.dialog.text', { chatName: props.chat.name }),
    },
    dialogProps: {
      title: $tr('chat.delete.dialog.title'),
      confirmButtonText: capitalize($tr('chat.delete.dialog.button')),
      confirmButtonColor: 'var(--color-text-button-secondary-default)',
      confirmButtonBackground: 'var(--color-bg-button-secondary-default)',
      cancelButtonColor: 'var(--color-text-button-primary-default)',
      cancelButtonBackground: 'var(--color-bg-button-primary-default)',
      onConfirm: async () => {
        await deleteChat(props.chat);
        if (areChatIdsEqual(currentChatId.value, props.chat)) {
          resetCurrentChat();
          await router.push('/chats');
        }
        await refreshChatList();
      },
    },
  });
}

function runChatLeave() {
  const component = defineAsyncComponent(() => import('../dialogs/confirmation-dialog.vue'));
  dialog.$openDialog({
    component,
    componentProps: {
      dialogText: $tr('chat.leave.dialog.text', { chatName: props.chat.name }),
    },
    dialogProps: {
      title: $tr('chat.leave.dialog.title'),
      confirmButtonText: $tr('chat.leave.dialog.button'),
      confirmButtonColor: 'var(--color-text-button-secondary-default)',
      confirmButtonBackground: 'var(--color-bg-button-secondary-default)',
      cancelButtonColor: 'var(--color-text-button-primary-default)',
      cancelButtonBackground: 'var(--color-bg-button-primary-default)',
      onConfirm: async () => {
        await leaveChat(props.chat);
        if (areChatIdsEqual(currentChatId.value, props.chat)) {
          resetCurrentChat();
          await router.push('/chats');
        }
        await refreshChatList();
      },
    },
  });
}

async function startVideoCall(): Promise<void> {
  const { isGroupChat, chatId } = props.chat;
  await videoOpenerSrv.startVideoCallForChatRoom({ isGroupChat, chatId });
}

const actionsHandlers: any = {
  history: {
    export: runChatHistoryExporting,
    clean: runChatHistoryCleaning,
  },
  chat: {
    info: openChatInfoDialog,
    rename: runChatRenaming,
    close: closeChat,
    delete: runChatDeleting,
    leave: runChatLeave,
  },
};

async function selectAction(compositeAction: string) {
  const [entity, action] = compositeAction.split(':');
  const handler: () => Promise<void> = actionsHandlers[entity]?.[action];
  if (handler) {
    await handler();
  } else {
    throw new Error(`No handler found for action ${action} on entity ${entity}`);
  }
}
</script>

<template>
  <div :class="$style.chatHeader">
    <chat-avatar
      :name="getChatName(props.chat)"
      :shape="isGroupChat ? 'decagon' : 'circle'"
    />

    <div :class="$style.chatHeaderContent">
      <div :class="$style.chatHeaderName">
        {{ getChatName(props.chat) }}
      </div>

      <div
        v-ui3n-html.sanitize="chat.lastMsg?.timestamp ? $tr('chat.header.info', { date: text }) : ''"
        :class="$style.chatHeaderInfo"
      />
    </div>

    <ui3n-button
      type="custom"
      color="var(--color-bg-button-tritery-default)"
      icon="round-phone"
      icon-color="var(--color-icon-button-tritery-default)"
      :class="$style.videoCallBtn"
      @click="startVideoCall"
    />

    <chat-header-actions @select:action="selectAction" />
  </div>
</template>

<style lang="scss" module>
@use '../../assets/styles/mixins' as mixins;

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
