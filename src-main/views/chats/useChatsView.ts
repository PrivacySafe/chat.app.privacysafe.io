/*
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
*/

import { defineAsyncComponent, inject, onBeforeMount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DIALOGS_KEY, DialogsPlugin, I18N_KEY, I18nPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { useContactsStore } from '@main/store/contacts.store';
import { useChatStore } from '@main/store/chat.store';

export default function useChatsView() {
  const route = useRoute();
  const router = useRouter();
  const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
  const dialog = inject<DialogsPlugin>(DIALOGS_KEY)!;
  const contactsStore = useContactsStore();
  const { fetchChat } = useChatStore();

  function openCreateChatDialog() {
    const component = defineAsyncComponent(() => import('../../components/dialogs/chat-create-dialog.vue'));
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
        onConfirm: (async (chatId: string) => {
          await closeNewChatDialog(chatId);
        }) as any,
        onCancel: async () => {
          await closeNewChatDialog();
        },
      },
    });
  }

  async function closeNewChatDialog(chatId?: string) {
    if (chatId) {
      await contactsStore.fetchContacts();
      await router.push(`/chats/${chatId}`);
    } else {
      await router.push('/chats');
      await fetchChat(null);
    }
  }

  onBeforeMount(async () => {
    await contactsStore.fetchContacts();
  });

  watch(
    () => route.query,
    val => {
      const { createNewChat = '' } = val;
      if (createNewChat === 'true') {
        openCreateChatDialog();
      }
    },
    { immediate: true },
  );

  return {
    openCreateChatDialog,
  };
}
