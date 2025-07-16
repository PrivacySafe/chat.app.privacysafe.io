/*
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
*/

import { defineAsyncComponent, inject, watch, WatchHandle } from 'vue';
import { DIALOGS_KEY, DialogsPlugin, I18N_KEY, I18nPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { useContactsStore } from '@main/store/contacts.store';
import { useChatStore } from '@main/store/chat.store';
import { ChatIdObj } from '~/asmail-msgs.types';
import { useRouting } from './useRouting';
import { useRoute } from 'vue-router';

export default function useChatsView() {
  const route = useRoute();
  const {
    goToChatRoute, goToChatsRoute, hasCreateNewChatFlagInRoute
  } = useRouting();
  const { $tr } = inject(I18N_KEY)!;
  const dialog = inject(DIALOGS_KEY)!;
  const contactsStore = useContactsStore();
  const { resetCurrentChat } = useChatStore();

  function openCreateChatDialog() {
    const component = defineAsyncComponent(() => import('@main/components/dialogs/chat-create-dialog.vue'));
    dialog.$openDialog({
      component,
      dialogProps: {
        title: $tr('chat.create.dialog.title'),
        confirmButton: false,
        cancelButton: false,
        closeOnClickOverlay: false,
        onClose: async () => {
          await closeNewChatDialog();
        },
        onConfirm: (async (chatId: ChatIdObj) => {
          await closeNewChatDialog(chatId);
        }) as any,
        onCancel: async () => {
          await closeNewChatDialog();
        },
      },
    });
  }

  async function closeNewChatDialog(chatId?: ChatIdObj) {
    if (chatId) {
      await contactsStore.fetchContacts();
      await goToChatRoute(chatId);
    } else {
      resetCurrentChat();
      await goToChatsRoute();
    }
  }

  let routeQueryWatching: WatchHandle;

  async function doBeforeMount() {
    await contactsStore.fetchContacts();
    routeQueryWatching = watch(
      () => route.query,
      val => {
        if (hasCreateNewChatFlagInRoute(val)) {
          openCreateChatDialog();
        }
      },
      { immediate: true },
    );
  }

  function doBeforeUnmount() {
    routeQueryWatching.stop();
  }

  return {
    openCreateChatDialog,

    doBeforeMount,
    doBeforeUnmount
  };
}
