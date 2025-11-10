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
import { type ComputedRef, inject, nextTick, onMounted, onBeforeUnmount, ref, useTemplateRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import isEmpty from 'lodash/isEmpty';
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
import type { Nullable } from '@v1nt1248/3nclient-lib';
import type {
  AppGlobalEvents,
  ChatIdObj,
  ChatMessageAction,
  ChatMessageActionType,
  ChatMessageId,
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
import { useChatsStore } from '@main/common/store/chats.store';
import { useChatStore } from '@main/common/store/chat.store';
import { useContactsStore } from '@main/common/store/contacts.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import { useUiOutgoingStore } from '@main/common/store/ui.outgoing.store';
import { APP_ROUTES } from '@main/mobile/constants';
import { toCanonicalAddress } from '@shared/address-utils';
import type { ChatMessagesEmits } from './chat-messages.vue';
import MessageDeleteDialog from '@main/common/components/dialogs/message-delete-dialog.vue';
import MessageForwardDialog from '@main/common/components/dialogs/message-forward-dialog.vue';

export default function useChatMessages(
  chatId: ComputedRef<string>,
  readonly: ComputedRef<boolean>,
  emits: ChatMessagesEmits,
) {
  const router = useRouter();

  const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
  const dialog = inject<DialogsPlugin>(DIALOGS_KEY)!;
  const notifications = inject<NotificationsPlugin>(NOTIFICATIONS_KEY)!;
  const bus = inject<VueBusPlugin<AppGlobalEvents>>(VUEBUS_KEY)!;

  const { user: ownAddr, isMobileMode } = storeToRefs(useAppStore());

  const contactsStore = useContactsStore();
  const { contactList } = storeToRefs(contactsStore);
  const chatsStore = useChatsStore();
  const { chatList } = storeToRefs(chatsStore);
  const { createNewOneToOneChat } = chatsStore;
  const chatStore = useChatStore();
  const { currentChatId } = storeToRefs(chatStore);
  const { sendMessageInChat } = chatStore;

  const messagesStore = useMessagesStore();
  const { currentChatMessages, selectedMessages, recentReactions } = storeToRefs(messagesStore);
  const {
    cancelSendingMessage,
    changeMessageReaction,
    getMessageInCurrentChat,
    deleteMessageInChat,
    getMessageAttachments,
    selectMessage,
    addReactionInRecentList,
  } = messagesStore;

  const uiOutgoingStore = useUiOutgoingStore();
  const { msgsSendingProgress } = storeToRefs(uiOutgoingStore);
  const { removeRecordFromSendingProgressesList } = uiOutgoingStore;

  const showMessages = ref(false);

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
  const messagesAreProcessing = ref<string[]>([]);

  const msgReactionsMenuProps = ref<{
    open: boolean;
    msg: ChatMessageView | null;
  }>({
    open: false,
    msg: null,
  });

  async function scrollList({ chatId }: AppGlobalEvents['message:sent'], motSmoothly?: boolean) {
    if (listElement.value && currentChatId.value?.chatId === chatId.chatId) {
      await nextTick(() => {
        listElement.value!.scrollTo({
          top: 1e12,
          left: 0,
          behavior: motSmoothly ? 'auto' : 'smooth',
        });
      });
    }
  }

  function openMessageMenu(msg: ChatMessageView | undefined) {
    if (msg && (msg.chatMessageType !== 'system' && msg.chatMessageType !== 'invitation')) {
      msgActionsMenuProps.value = {
        open: true,
        actions: getMessageActions(msg, $tr, readonly.value),
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

  function addMsgToProcessingInfoList(chatMessageId: string) {
    if (!messagesAreProcessing.value.includes(chatMessageId)) {
      messagesAreProcessing.value.push(chatMessageId);
    }
  }

  function removeMsgFromProcessingInfoList(chatMessageId: string) {
    const index = messagesAreProcessing.value.indexOf(chatMessageId);
    if (index > -1) {
      messagesAreProcessing.value.splice(index, 1);
    }
  }

  function getMessageFromCurrentChat(chatMessageId: string): RegularMsgView | undefined {
    return currentChatMessages.value.find(
      m => (m.chatMessageId === chatMessageId),
    ) as RegularMsgView | undefined;
  }

  function getMessageByElement(ev: MouseEvent): ChatMessageView | undefined {
    const { target } = ev;

    const getMsg = (el: HTMLElement): ChatMessageView | undefined => {
      const { parentElement, classList, id } = el;

      if (!parentElement) {
        return undefined;
      }

      if (classList.contains('chat-message')) {
        return undefined;
      }

      if (classList.contains('chat-message__content') && id) {
        return getMessageFromCurrentChat(id);
      }

      return getMsg(parentElement as HTMLElement);
    };

    return getMsg(target as HTMLElement);
  }

  async function onMsgClick(ev: PointerEvent) {
    if (msgActionsMenuProps.value.open) {
      return;
    }

    const element = ev.target as Nullable<HTMLElement>;

    if (element && element.nodeName === 'A') {
      if (element.classList.contains('mention')) {
        const dataMention = element.dataset.mention;
        if (!dataMention) {
          return;
        }

        const dataMentionSplitted = dataMention.replace('@', '').split('[');
        const user = `${dataMentionSplitted[0]}@${dataMentionSplitted[1]}`.slice(0, -1);
        if (user === ownAddr.value) {
          return;
        }

        const isTargetChatPresent = !!chatList.value.find(chat => chat.chatId === user);

        if (!isTargetChatPresent) {
          const contact = contactList.value.find(c => c.mail === user);
          await createNewOneToOneChat(contact?.displayName || user, toCanonicalAddress(user));
        }

        return await router.push({
          name: APP_ROUTES.CHAT,
          params: {
            chatType: 's',
            chatId: toCanonicalAddress(user),
          },
        });
      }

      if (element.classList.contains('url')) {
        let dataHref = element.dataset.href;
        if (!dataHref) {
          return;
        }

        if (!/^https?:\/\//i.test(dataHref)) {
          dataHref = `https://${dataHref}`;
        }

        return w3n.shell!.openURL!(dataHref);
      }

      return;
    }

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
    ev.preventDefault();
    ev.stopImmediatePropagation();

    clearMessageMenu();
    nextTick(() => {
      const msg = getMessageByElement(ev);
      openMessageMenu(msg);
    });
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

    addReactionInRecentList(reaction.id);
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
        onConfirm: deleteForEveryone => {
          addMsgToProcessingInfoList(chatMessageId);
          deleteMessageInChat(chatMessageId, !!deleteForEveryone)
            .finally(() => removeMsgFromProcessingInfoList(chatMessageId));
        },
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

    addMsgToProcessingInfoList(chatMessageId);
    const res = await downloadAttachments(msg, $tr)
      .finally(() => removeMsgFromProcessingInfoList(chatMessageId));

    if (res === undefined) {
      return;
    }

    notifications?.$createNotice({
      type: res ? 'success' : 'error',
      content: res ? $tr('chat.message.file.download.success') : $tr('chat.message.file.download.error'),
    });
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

          let entities: Record<string, web3n.files.ReadonlyFile | web3n.files.ReadonlyFS> = {};
          if (!isEmpty(msg.attachments)) {
            entities = await getMessageAttachments(msg.attachments!, msg.incomingMsgId);
          }

          await sendMessageInChat({
            chatId: chatId!,
            text: msg.body,
            files: isEmpty(entities) ? undefined : Object.values(entities),
            relatedMessage: {
              forwardFrom: {
                sender: msg.sender || ownAddr.value,
              },
            },
            withoutCurrentChatCheck: true,
          });

          await router.push({
            name: APP_ROUTES.CHAT,
            params: {
              chatType: chatId!.isGroupChat ? 'g' : 's',
              chatId: chatId!.chatId,
            },
          });
        }),
      },
    });
  }

  async function cancelSending(chatMessageId: string) {
    const msg = currentChatMessages.value
      .find(m => m.chatMessageId === chatMessageId) as RegularMsgView | undefined;
    if (!msg) {
      return;
    }

    const chatMsgInfo = JSON.stringify([msg.chatId.chatId, msg.chatMessageId]);
    const progressData = msgsSendingProgress.value[chatMsgInfo];
    if (!progressData) {
      return;
    }

    const chatMsgId: ChatMessageId = {
      chatId: msg.chatId,
      chatMessageId: chatMessageId,
    }
    await cancelSendingMessage({ deliveryId: progressData.deliveryId, chatMsgId });
    removeRecordFromSendingProgressesList(chatMsgInfo);
  }

  async function resendMsg(chatMessageId: string) {
    const msg = currentChatMessages.value
      .find(m => m.chatMessageId === chatMessageId) as RegularMsgView | undefined;
    if (!msg) {
      return;
    }

    let entities: Record<string, web3n.files.ReadonlyFile | web3n.files.ReadonlyFS> = {};
    if (!isEmpty(msg.attachments)) {
      entities = await getMessageAttachments(msg.attachments!, msg.incomingMsgId);
    }

    await sendMessageInChat({
      chatId: msg.chatId,
      chatMessageId: msg.chatMessageId,
      text: msg.body,
      files: isEmpty(entities) ? undefined : Object.values(entities),
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
    'cancel_sending': cancelSending,
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

  watch(
    chatId,
    (val, oldVal) => {
      if (val && val !== oldVal) {
        showMessages.value = false;
        messagesAreProcessing.value = [];
        setTimeout(() => {
          showMessages.value = true;
          scrollList({ chatId: currentChatId.value! }, true);
        }, 100);
      }
    }, {
      immediate: true,
    },
  );

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
    showMessages,
    listElement,
    selectedMessages,
    messagesAreProcessing,
    msgActionsMenuProps,
    msgReactionsMenuProps,
    recentReactions,
    selectMessage,
    cancelSending,
    handleClickOnMessagesBlock,
    onMsgClick,
    clearMessageMenu,
    handleAction,
    handleSelectionReaction,
  };
}
