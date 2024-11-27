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
/* eslint-disable @typescript-eslint/no-explicit-any */
import { computed, defineAsyncComponent, inject, toRefs } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import get from 'lodash/get';
import size from 'lodash/size';
import {
  I18nPlugin,
  I18N_KEY,
  DialogsPlugin,
  DIALOGS_KEY,
  NotificationsPlugin,
  NOTIFICATIONS_KEY,
} from '@v1nt1248/3nclient-lib/plugins';
import { prepareDateAsSting } from '@v1nt1248/3nclient-lib/utils';
import { Ui3nButton, Ui3nHtml } from '@v1nt1248/3nclient-lib';
import { useAppStore, useChatsStore } from '@main/store';
import { exportChatMessages } from '@main/helpers/chats.helper';
import { getChatName } from '@main/helpers/chat-ui.helper';
import { videoOpenerProxy } from '@main/services/services-provider';
import { areAddressesEqual } from '@main/libs/address-utils';
import type { ChatView, ChatMessageView, MessageType } from '~/index';
import ChatAvatar from './chat-avatar.vue';
import ChatHeaderActions from './chat-header-actions.vue';

const vUi3nHtml = Ui3nHtml;

const props = defineProps<{
  chat: ChatView & { unread: number } & ChatMessageView<MessageType>;
  messages: ChatMessageView<MessageType>[];
}>();

const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
const dialog = inject<DialogsPlugin>(DIALOGS_KEY)!;
const notification = inject<NotificationsPlugin>(NOTIFICATIONS_KEY)!;

const router = useRouter();

const chatsStore = useChatsStore();
const { user } = storeToRefs(useAppStore());
const { currentChatId } = storeToRefs(chatsStore);
const { getChat, deleteChat, leaveChat, clearChat, renameChat, getChatList } = chatsStore;

const text = computed<string>(() => {
  if (!props.chat.msgId) {
    return '';
  }
  return prepareDateAsSting(props.chat.timestamp);
});
const isGroupChat = computed<boolean>(() => size(props.chat.members) > 2);

async function runChatHistoryExporting() {
  const result = await exportChatMessages({
    chatName: props.chat.name,
    members: props.chat.members,
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
        await clearChat(props.chat.chatId);
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
      onConfirm: async ({ oldName, newName }: { oldName: string, newName: string }) => {
        if (newName !== oldName) {
          await renameChat(props.chat, newName);
        }
      },
    },
  });
}

async function closeChat() {
  await router.push('/chats');
  await getChat(null);
}

function runChatDeleting() {
  const component = defineAsyncComponent(() => import('../dialogs/confirmation-dialog.vue'));
  dialog.$openDialog({
    component,
    dialogProps: {
      title: $tr('chat.delete.dialog.title'),
      confirmButtonColor: 'var(--color-text-button-secondary-default)',
      confirmButtonBackground: 'var(--color-bg-button-secondary-default)',
      cancelButtonColor: 'var(--color-text-button-primary-default)',
      cancelButtonBackground: 'var(--color-bg-button-primary-default)',
      onConfirm: async () => {
        await deleteChat(props.chat.chatId);
        if (props.chat.chatId === currentChatId.value) {
          await router.push('/chats');
          await getChat(null);
        }
        await getChatList();
      },
    },
  });
}

function runChatLeave() {
  const component = defineAsyncComponent(() => import('../dialogs/confirmation-dialog.vue'));
  dialog.$openDialog({
    component,
    dialogProps: {
      title: $tr('chat.leave.dialog.title'),
      confirmButtonText: 'chat.leave.dialog.button',
      confirmButtonColor: 'var(--color-text-button-secondary-default)',
      confirmButtonBackground: 'var(--color-bg-button-secondary-default)',
      cancelButtonColor: 'var(--color-text-button-primary-default)',
      cancelButtonBackground: 'var(--color-bg-button-primary-default)',
      onConfirm: async () => {
        await leaveChat(props.chat, [user.value]);
        if (props.chat.chatId === currentChatId.value) {
          await router.push('/chats');
          await getChat(null);
        }
        await getChatList();
      },
    },
  });
}

async function startVideoCall(): Promise<void> {
  const { chatId, name: chatName, members } = props.chat;
  console.log('startVideoCall: ', chatId, chatName, members);
  const ownName = user.value.substring(0, user.value.indexOf('@'));

  const peers = members
    .filter(addr => !areAddressesEqual(addr, user.value))
    .map(addr => ({
      addr,
      name: addr.substring(0, addr.indexOf('@')),
    }));
  await videoOpenerProxy.startVideoCallForChatRoom(chatId);
}

const actionsHandlers = {
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
  const handler = get(actionsHandlers, [entity, action]);
  if (handler) {
    await handler();
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
        v-ui3n-html.sanitize="chat.timestamp ? $tr('chat.header.info', { date: text }) : ''"
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
