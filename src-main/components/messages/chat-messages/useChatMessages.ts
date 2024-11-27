import { defineAsyncComponent, inject, nextTick, onBeforeMount, onBeforeUnmount, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import {
  DIALOGS_KEY,
  DialogsPlugin,
  I18N_KEY,
  I18nPlugin,
  NOTIFICATIONS_KEY,
  NotificationsPlugin,
  VUEBUS_KEY,
  VueBusPlugin,
} from '@v1nt1248/3nclient-lib/plugins';
import { useAppStore, useChatsStore } from '@main/store';
import type { AppGlobalEvents, ChatMessageAction, ChatMessageActionType, ChatMessageView, MessageType } from '~/index';
import {
  copyMessageToClipboard,
  downloadFile,
  getMessageFromCurrentChat,
} from '@main/helpers/chat-message-actions.helpers';
import { getMessageActions } from '@main/helpers/chats.helper';
import { capitalize } from '@v1nt1248/3nclient-lib/utils';
import type { ChatMessagesEmits } from './types';

export default function useChatMessages(emit: ChatMessagesEmits) {
  const router = useRouter();

  const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
  const dialog = inject<DialogsPlugin>(DIALOGS_KEY)!;
  const notifications = inject<NotificationsPlugin>(NOTIFICATIONS_KEY);
  const bus = inject<VueBusPlugin<AppGlobalEvents>>(VUEBUS_KEY)!;

  const chatsStore = useChatsStore();
  const { currentChatId } = storeToRefs(chatsStore);
  const { createChat, deleteMessage } = chatsStore;
  const { user } = storeToRefs(useAppStore());

  const listElement = ref<HTMLDivElement | null>(null);
  const msgActionsMenuProps = ref<{
    open: boolean;
    actions: Omit<ChatMessageAction, 'conditions'>[];
    msg: ChatMessageView<MessageType> | null;
  }>({
    open: false,
    actions: [],
    msg: null,
  });

  async function scrollList({ chatId }: { chatId: string }) {
    if (listElement.value && currentChatId.value === chatId) {
      await nextTick(() => {
        listElement.value!.scrollTop = 1e9;
      });
    }
  }

  function handleClick(ev: MouseEvent): ChatMessageView<MessageType> | undefined {
    ev.preventDefault();
    const { target } = ev;
    const { id, classList } = target as Element;

    return classList.contains('chat-message__content') && id
      ? getMessageFromCurrentChat({ chatMessageId: id })
      : undefined;
  }

  function goToMessage(ev: MouseEvent) {
    const msg = handleClick(ev);
    if (msg && msg.initialMessageId) {
      const initialMessageElement = document.getElementById(`msg-${msg.initialMessageId}`);
      initialMessageElement && initialMessageElement.scrollIntoView(false);
    }
  }

  function openMessageMenu(ev: MouseEvent) {
    const msg = handleClick(ev);
    if (msg && msg.chatMessageType !== 'system') {
      // const messageElement = document.getElementById(`msg-${msg.chatMessageId}`)
      // messageElement && messageElement.scrollIntoView();

      msgActionsMenuProps.value = {
        open: true,
        actions: getMessageActions(msg!),
        msg,
      };
    }
  }

  function clearMessageMenu() {
    msgActionsMenuProps.value = {
      open: false,
      actions: [] as Omit<ChatMessageAction, 'conditions'>[],
      msg: null,
    };
  }

  async function copyMsgText(chatMessageId: string) {
    const msg = getMessageFromCurrentChat({ chatMessageId });
    await copyMessageToClipboard(msg);
    notifications?.$createNotice({
      type: 'success',
      content: $tr('chat.message.clipboard.copy.text'),
    });
  }

  function deleteMsg(chatMessageId: string) {
    const messageDeleteDialog = defineAsyncComponent(() => import('../../dialogs/message-delete-dialog.vue'));
    dialog.$openDialog({
      component: messageDeleteDialog,
      componentProps: {},
      dialogProps: {
        title: $tr('chat.message.delete.dialog.title'),
        confirmButtonText: capitalize($tr('btn.text.delete')),
        confirmButtonColor: 'var(--blue-main)',
        confirmButtonBackground: 'var(--system-white)',
        cancelButtonColor: 'var(--system-white)',
        cancelButtonBackground: 'var(--blue-main)',
        onConfirm: (deleteForEveryone?: boolean) => deleteMessage(chatMessageId, deleteForEveryone),
      },
    });
  }

  async function downloadAttachment(chatMessageId: string) {
    const msg = getMessageFromCurrentChat({ chatMessageId });
    const res = await downloadFile(msg);
    if (res === false) {
      notifications?.$createNotice({
        type: 'error',
        content: $tr('chat.message.file.download.error'),
      });
    }
  }

  function replyMsg(chatMessageId: string) {
    const msg = getMessageFromCurrentChat({ chatMessageId });
    msg && emit('reply', msg);
  }

  function forwardMsg(chatMessageId: string) {
    const messageForwardDialog = defineAsyncComponent(() => import('../../dialogs/message-forward-dialog.vue'));
    dialog.$openDialog({
      component: messageForwardDialog,
      componentProps: {},
      dialogProps: {
        title: $tr('chat.message.forward.dialog.title'),
        confirmButton: false,
        cancelButton: false,
        onConfirm: async ({ type, data }: { type: 'chat' | 'contact', data: string }) => {
          let chatId = type === 'chat' ? data : undefined;
          if (type === 'contact') {
            chatId = await createChat({ members: [user.value, data], admins: [user.value] });
          }

          router.push(`/chats/${chatId}?initialMsgId=${chatMessageId}`);
        },
      },
    });
  }

  const messageActions: Partial<Record<ChatMessageActionType, Function>> = {
    copy: copyMsgText,
    'delete_message': deleteMsg,
    download: downloadAttachment,
    reply: replyMsg,
    forward: forwardMsg,
  };

  function handleAction({ action, chatMessageId }: { action: ChatMessageActionType, chatMessageId: string }) {
    messageActions[action] && messageActions[action]!(chatMessageId);
  }

  onBeforeMount(() => {
    bus.$emitter.on('send:message', scrollList);
  });

  onBeforeUnmount(() => {
    bus.$emitter.off('send:message', scrollList);
  });

  return {
    $tr,
    listElement,
    msgActionsMenuProps,
    goToMessage,
    openMessageMenu,
    clearMessageMenu,
    handleAction,
  };
}
