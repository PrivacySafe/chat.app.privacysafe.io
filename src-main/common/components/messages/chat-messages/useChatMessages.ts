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
import { inject, nextTick, onMounted, onBeforeUnmount, ref, useTemplateRef } from 'vue';
import { storeToRefs } from 'pinia';
import isEmpty from 'lodash/isEmpty';
import {
  DIALOGS_KEY,
  I18N_KEY,
  NOTIFICATIONS_KEY,
  VUEBUS_KEY,
  VueBusPlugin,
} from '@v1nt1248/3nclient-lib/plugins';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import type {
  AppGlobalEvents,
  ChatIdObj,
  ChatMessageAction,
  ChatMessageActionType,
  ChatMessageView,
  RegularMsgView,
} from '~/index';
import {
  copyMessageToClipboard,
  downloadAttachments,
} from '@main/common/utils/chat-message-actions.helpers';
import { getMessageActions } from '@main/common/utils/chats.helper';
import { capitalize } from '@v1nt1248/3nclient-lib/utils';
import { useAppStore } from '@main/common/store/app.store';
import { useChatStore } from '@main/common/store/chat.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import { useRouting } from '@main/desktop/composables/useRouting';
import type { ChatMessagesEmits } from './chat-messages.vue';
import MessageDeleteDialog from '@main/common/components/dialogs/message-delete-dialog.vue';
import MessageForwardDialog from '@main/common/components/dialogs/message-forward-dialog.vue';

export default function useChatMessages(emits: ChatMessagesEmits) {
  const { goToChatRoute } = useRouting();

  const { $tr } = inject(I18N_KEY)!;
  const dialog = inject(DIALOGS_KEY)!;
  const notifications = inject(NOTIFICATIONS_KEY)!;
  const bus = inject<VueBusPlugin<AppGlobalEvents>>(VUEBUS_KEY)!;

  const { user: ownAddr, isMobileMode } = storeToRefs(useAppStore());

  const chatStore = useChatStore();
  const { currentChatId } = storeToRefs(chatStore);
  const { sendMessageInChat } = chatStore;

  const messagesStore = useMessagesStore();
  const { currentChatMessages, selectedMessages } = storeToRefs(messagesStore);
  const {
    changeMessageReaction,
    getMessageInCurrentChat,
    deleteMessageInChat,
    getMessageAttachments,
    selectMessage,
  } = messagesStore;

  const listElement = useTemplateRef<HTMLDivElement>('list-element');

  const msgActionsMenuProps = ref<{
    open: boolean;
    actions: Omit<ChatMessageAction, 'conditions'>[];
    msg: ChatMessageView | null;
  }>({
    open: false,
    actions: [],
    msg: null,
  });

  const recentReactionsLimit = 5;
  const recentReactions = ref<string[]>([]);
  const msgReactionsMenuProps = ref<{
    open: boolean;
    msg: ChatMessageView | null;
  }>({
    open: false,
    msg: null,
  });

  async function scrollList({ chatId }: AppGlobalEvents['message:sent']) {
    if (listElement.value && currentChatId.value?.chatId === chatId.chatId) {
      await nextTick(() => {
        listElement.value!.scrollTo({
          top: 1e12,
          left: 0,
          behavior: 'smooth',
        });
      });
    }
  }

  function openMessageMenu(msg: ChatMessageView | undefined) {
    if (msg && (msg.chatMessageType !== 'system' && msg.chatMessageType !== 'invitation')) {
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
    msgReactionsMenuProps.value = {
      open: false,
      msg: null,
    };
  }

  function getMessageFromCurrentChat(chatMessageId: string): RegularMsgView | undefined {
    return currentChatMessages.value.find(
      m => (m.chatMessageId === chatMessageId),
    ) as RegularMsgView | undefined;
  }

  function getMessageByElement(ev: MouseEvent, isNestedElement?: boolean): ChatMessageView | undefined {
    const { target } = ev;

    if (isNestedElement) {
      const getMsg = (el: Element): ChatMessageView | undefined => {
        const { parentElement } = el;
        const { id, classList } = parentElement as Element;
        if (classList.contains('chat-message')) {
          return undefined;
        }

        if (classList.contains('chat-message__content') && id) {
          return getMessageFromCurrentChat(id);
        }

        return getMsg(parentElement as Element);
      };

      return getMsg(target as Element);
    }

    const { id, classList } = target as Element;
    return classList.contains('chat-message__content') && id
      ? getMessageFromCurrentChat(id)
      : undefined;
  }

  function goToMessage(ev: MouseEvent) {
    const msg = getMessageByElement(ev);
    if (
      msg?.chatMessageType === 'regular'
      && msg.relatedMessage
      && msg.relatedMessage.replyTo
      && msg.relatedMessage.replyTo.chatMessageId
    ) {
      const initialMessageElement = document.getElementById(`msg-${msg.relatedMessage.replyTo.chatMessageId}`);
      initialMessageElement && initialMessageElement.scrollIntoView(false);
    }
  }

  function handleClickOnMessagesBlock(ev: MouseEvent) {
    clearMessageMenu();
    nextTick(() => {
      ev.preventDefault();
      const msg = getMessageByElement(ev);
      openMessageMenu(msg);
    });
  }

  function handleRightClickOnAttachmentElement(ev: MouseEvent) {
    const msg = getMessageByElement(ev, true);
    openMessageMenu(msg);
  }

  function openReactionDialog(chatMessageId: string) {
    const msg = getMessageInCurrentChat(chatMessageId);
    if (msg && (msg.chatMessageType !== 'system' && msg.chatMessageType !== 'invitation')) {
      nextTick(() => {
        msgReactionsMenuProps.value = {
          open: true,
          msg,
        };
      });
    }
  }

  async function handleSelectionReaction(
    { msg, reaction }: {
      msg: ChatMessageView; reaction: Nullable<{ id: string; value: string }>;
    }) {
    await changeMessageReaction({ msg, reaction });

    if (!reaction) {
      return;
    }

    const isReactionInRecentList = recentReactions.value.includes(reaction.id);
    if (isReactionInRecentList) {
      return;
    }

    if (recentReactions.value.length === recentReactionsLimit) {
      recentReactions.value.shift();
    }
    recentReactions.value.push(reaction.id);
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
    dialog.$openDialog<typeof MessageDeleteDialog>({
      component: MessageDeleteDialog,
      componentProps: {},
      dialogProps: {
        title: $tr('chat.message.delete.dialog.title'),
        ...(isMobileMode.value && { width: 300 }),
        confirmButtonText: capitalize($tr('btn.text.delete')),
        confirmButtonColor: 'var(--color-text-button-secondary-default)',
        confirmButtonBackground: 'var(--color-bg-button-secondary-default)',
        cancelButtonColor: 'var(--color-text-button-primary-default)',
        cancelButtonBackground: 'var(--color-bg-button-primary-default)',
        onConfirm: deleteForEveryone => deleteMessageInChat(chatMessageId, !!deleteForEveryone),
      },
    });
  }

  function startSelectionMode(chatMessageId: string) {
    selectMessage(chatMessageId);
  }

  function showMsgInfo(chatMessageId: string) {
    const msg = getMessageFromCurrentChat(chatMessageId);
    msg && emits('show:info', msg);
  }

  async function downloadAttachment(chatMessageId: string) {
    const msg = getMessageFromCurrentChat(chatMessageId);
    if (msg?.chatMessageType !== 'regular') {
      return;
    }
    const res = await downloadAttachments(msg, $tr);
    if (res === false) {
      notifications?.$createNotice({
        type: 'error',
        content: $tr('chat.message.file.download.error'),
      });
    }
  }

  function replyMsg(chatMessageId: string) {
    const msg = getMessageFromCurrentChat(chatMessageId);
    msg && emits('reply', msg);
  }

  function editMsg(chatMessageId: string) {
    const msg = getMessageFromCurrentChat(chatMessageId);
    msg && emits('edit', msg);
  }

  function forwardMsg(chatMessageId: string) {
    dialog.$openDialog<typeof MessageForwardDialog>({
      component: MessageForwardDialog,
      componentProps: {},
      dialogProps: {
        title: $tr('chat.message.forward.dialog.title'),
        ...(isMobileMode.value && { width: 300 }),
        confirmButton: false,
        cancelButton: false,
        onConfirm: (async data => {
          const msg = currentChatMessages.value
            .find(m => m.chatMessageId === chatMessageId) as RegularMsgView | undefined;

          if (!msg) {
            return;
          }

          const { chatId } = data as { chatId?: ChatIdObj; contact?: { mail: string; name: string; } };

          let files: Record<string, web3n.files.ReadonlyFile> = {};
          if (!isEmpty(msg.attachments)) {
            files = await getMessageAttachments(msg.attachments!, msg.incomingMsgId);
          }

          await sendMessageInChat({
            chatId: chatId!,
            text: msg.body,
            files: isEmpty(files) ? undefined : Object.values(files),
            relatedMessage: {
              forwardFrom: {
                sender: msg.sender || ownAddr.value,
              },
            },
            withoutCurrentChatCheck: true,
          });

          await goToChatRoute(chatId!);
        }),
      },
    });
  }

  async function resendMsg(chatMessageId: string) {
    const msg = currentChatMessages.value
      .find(m => m.chatMessageId === chatMessageId) as RegularMsgView | undefined;
    if (!msg) {
      return;
    }

    let files: Record<string, web3n.files.ReadonlyFile> = {};
    if (!isEmpty(msg.attachments)) {
      files = await getMessageAttachments(msg.attachments!, msg.incomingMsgId);
    }

    await sendMessageInChat({
      chatId: msg.chatId,
      chatMessageId: msg.chatMessageId,
      text: msg.body,
      files: isEmpty(files) ? undefined : Object.values(files),
      relatedMessage: undefined,
      withoutCurrentChatCheck: true,
    });
  }

  const messageActions: Partial<Record<ChatMessageActionType, (chatMessageId: string) => void | Promise<void>>> = {
    reaction: openReactionDialog,
    copy: copyMsgText,
    delete_message: deleteMsg,
    select: startSelectionMode,
    info: showMsgInfo,
    download: downloadAttachment,
    reply: replyMsg,
    forward: forwardMsg,
    edit: editMsg,
    resend: resendMsg,
  };

  function handleAction({ action, chatMessageId }: {
    action: ChatMessageActionType;
    chatMessageId: string;
  }) {
    const messageAction = messageActions[action];
    if (messageAction) {
      messageAction(chatMessageId);
    }
  }

  onMounted(() => {
    emits('init', listElement.value);

    bus.$emitter.on('message:sent', scrollList);
    bus.$emitter.on('message:added', scrollList);
  });

  onBeforeUnmount(() => {
    bus.$emitter.off('message:sent', scrollList);
    bus.$emitter.off('message:added', scrollList);
  });

  return {
    $tr,
    listElement,
    selectedMessages,
    msgActionsMenuProps,
    msgReactionsMenuProps,
    recentReactions,
    selectMessage,
    handleClickOnMessagesBlock,
    handleRightClickOnAttachmentElement,
    goToMessage,
    clearMessageMenu,
    handleAction,
    handleSelectionReaction,
  };
}
