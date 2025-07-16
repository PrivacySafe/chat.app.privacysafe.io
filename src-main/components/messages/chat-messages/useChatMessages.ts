/*
Copyright (C) 2024 - 2025 3NSoft Inc.

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

import { defineAsyncComponent, inject, nextTick, onMounted, onBeforeUnmount, ref } from 'vue';
import { storeToRefs } from 'pinia';
import {
  DIALOGS_KEY,
  I18N_KEY,
  NOTIFICATIONS_KEY,
  VUEBUS_KEY,
  VueBusPlugin,
} from '@v1nt1248/3nclient-lib/plugins';
import type { AppGlobalEvents, ChatIdObj, ChatMessageAction, ChatMessageActionType, ChatMessageId, ChatMessageView, RegularMsgView } from '~/index';
import {
  copyMessageToClipboard,
  downloadFile,
} from '@main/utils/chat-message-actions.helpers';
import { getMessageActions } from '@main/utils/chats.helper';
import { capitalize } from '@v1nt1248/3nclient-lib/utils';
import type { ChatMessagesEmits } from './types';
import { useChatsStore } from '@main/store/chats.store';
import { useChatStore } from '@main/store/chat.store';
import { useRouting } from '@main/composables/useRouting';

export default function useChatMessages(emit: ChatMessagesEmits) {
  const { goToChatRoute } = useRouting();

  const { $tr } = inject(I18N_KEY)!;
  const dialog = inject(DIALOGS_KEY)!;
  const notifications = inject(NOTIFICATIONS_KEY);
  const bus = inject<VueBusPlugin<AppGlobalEvents>>(VUEBUS_KEY)!;

  const { createNewOneToOneChat } = useChatsStore();
  const chatStore = useChatStore();
  const { currentChatId } = storeToRefs(chatStore);
  const { deleteMessageInChat, currentChatMessages } = chatStore;

  const listElement = ref<HTMLDivElement | null>(null);
  const msgActionsMenuProps = ref<{
    open: boolean;
    actions: Omit<ChatMessageAction, 'conditions'>[];
    msg: ChatMessageView | null;
  }>({
    open: false,
    actions: [],
    msg: null,
  });

  async function scrollList({ chatId }: AppGlobalEvents['send:message']) {
    if (listElement.value && currentChatId.value === chatId) {
      await nextTick(() => {
        listElement.value!.scrollTop = 1e9;
      });
    }
  }

  function handleClick(ev: MouseEvent): ChatMessageView | undefined {
    ev.preventDefault();
    const { target } = ev;
    const { id, classList } = target as Element;

    return classList.contains('chat-message__content') && id
      ? getMessageFromCurrentChat(id)
      : undefined;
  }

  function goToMessage(ev: MouseEvent) {
    const msg = handleClick(ev);
    if ((msg?.chatMessageType === 'regular') && msg.relatedMessage) {
      const initialMessageElement = document.getElementById(`msg-${msg.relatedMessage}`);
      initialMessageElement && initialMessageElement.scrollIntoView(false);
    }
  }

  function openMessageMenu(ev: MouseEvent) {
    const msg = handleClick(ev);
    if (msg && (msg.chatMessageType !== 'system')) {
      // const messageElement = document.getElementById(`msg-${msg.chatMessageId}`)
      // messageElement && messageElement.scrollIntoView();

      msgActionsMenuProps.value = {
        open: true,
        actions: getMessageActions(msg, $tr),
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

  function getMessageFromCurrentChat(
    chatMessageId: string,
  ): RegularMsgView|undefined {
    return currentChatMessages.find(
      m => (m.chatMessageId === chatMessageId)
    ) as RegularMsgView|undefined;
  }

  async function copyMsgText(chatMessageId: string) {
    const msg = getMessageFromCurrentChat(chatMessageId);
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
        onConfirm: (
          (deleteForEveryone?: boolean) => deleteMessageInChat(
            chatMessageId, deleteForEveryone
          )
      ) as any,
      },
    });
  }

  async function downloadAttachment(chatMessageId: string) {
    const msg = getMessageFromCurrentChat(chatMessageId);
    if (msg?.chatMessageType !== 'regular') {
      return;
    }
    const res = await downloadFile(msg);
    if (res === false) {
      notifications?.$createNotice({
        type: 'error',
        content: $tr('chat.message.file.download.error'),
      });
    }
  }

  function replyMsg(chatMessageId: string) {
    const msg = getMessageFromCurrentChat(chatMessageId);
    msg && emit('reply', msg);
  }

  function forwardMsg(chatMessageId: ChatMessageId) {
    const messageForwardDialog = defineAsyncComponent(() => import('../../dialogs/message-forward-dialog.vue'));
    dialog.$openDialog({
      component: messageForwardDialog,
      componentProps: {},
      dialogProps: {
        title: $tr('chat.message.forward.dialog.title'),
        confirmButton: false,
        cancelButton: false,
        onConfirm: (async (
          { chatId, contact }: {
            chatId?: ChatIdObj; contact?: { mail: string; name: string; }
          }
        ) => {
          if (!chatId) {
            chatId = await createNewOneToOneChat(
              contact!.name, contact!.mail
            );
          }
          goToChatRoute(chatId, { forwardedMsg: chatMessageId });
        }) as any,
      },
    });
  }

  const messageActions: Partial<Record<ChatMessageActionType, Function>> = {
    copy: copyMsgText,
    delete_message: deleteMsg,
    download: downloadAttachment,
    reply: replyMsg,
    forward: forwardMsg,
  };

  function handleAction({ action, chatMessageId }: {
    action: ChatMessageActionType, chatMessageId: ChatMessageId
  }) {
    const messageAction = messageActions[action]
    if (messageAction) {
      messageAction(chatMessageId);
    }
  }

  onMounted(() => {
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
