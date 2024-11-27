import { defineAsyncComponent, inject, onBeforeMount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DIALOGS_KEY, DialogsPlugin, I18N_KEY, I18nPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { useChatsStore, useContactsStore } from '@main/store';

export default function useChatsPage() {
  const route = useRoute();
  const router = useRouter();
  const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
  const dialog = inject<DialogsPlugin>(DIALOGS_KEY)!;
  const contactsStore = useContactsStore();
  const chatsStore = useChatsStore();

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
        onConfirm: async (chatId: string) => {
          await closeNewChatDialog(chatId);
        },
        onCancel: async () => {
          await closeNewChatDialog();
        },
      },
    });
  }

  async function closeNewChatDialog(chatId?: string) {
    if (chatId) {
      await contactsStore.fetchContactList();
      await router.push(`/chats/${chatId}`);
    } else {
      await router.push('/chats');
      await chatsStore.getChat(null);
    }
  }

  onBeforeMount(async () => {
    await contactsStore.fetchContactList();
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
