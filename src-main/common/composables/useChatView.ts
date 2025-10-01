/*
Copyright (C) 2025 3NSoft Inc.

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
import { computed, inject, nextTick, provide, ref, toRaw, watch } from 'vue';
import {
  NavigationGuardNext,
  RouteLocationNormalized,
  RouteLocationNormalizedLoaded,
  RouteLocationNormalizedLoadedGeneric,
  Router,
} from 'vue-router';
import { storeToRefs } from 'pinia';
import get from 'lodash/get';
import size from 'lodash/size';
import isEmpty from 'lodash/isEmpty';
import { DIALOGS_KEY, I18N_KEY } from '@v1nt1248/3nclient-lib/plugins';
import { capitalize, transformFileToWeb3NFile } from '@v1nt1248/3nclient-lib/utils';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import type {
  ChatIdObj,
  ChatMessageAttachmentsInfo,
  ChatMessageId,
  ChatMessageView,
  RegularMsgView,
  RelatedMessage,
  Ui3nTextEnterEvent,
} from '~/index';
import type { ChatRoute, ChatRouteType, ChatWithFwdMsgRef, ChatWithIncomingCall } from '@main/desktop/router';
import type { RouteChat } from '@main/mobile/types';
import { useTaskRunner } from '@main/common/composables/useTaskRunner';
import { useAppStore } from '@main/common/store/app.store';
import { useChatsStore } from '@main/common/store/chats.store';
import { useChatStore } from '@main/common/store/chat.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import { areChatIdsEqual } from '@shared/chat-ids';
import { getAttachmentFilesInfo } from '@main/common/utils/chats.helper';
import MessageDeleteDialog from '@main/common/components/dialogs/message-delete-dialog.vue';

function packRelatedMessageToSend(msg: ChatMessageView, relationType: 'reply' | 'forward'): RelatedMessage {
  switch (relationType) {
    case 'reply': {
      return {
        replyTo: {
          chatMessageId: msg.chatMessageId,
        },
      };
    }

    default:
      throw new Error(`Unknown relation type: ${relationType}`);
  }
}

interface NavigationUtils {
  route: RouteLocationNormalizedLoadedGeneric;
  router: Router;
  getChatIdFromRoute: (params?: ChatRoute['params'] | RouteChat['params']) => ChatIdObj | undefined;
  getForwardedMsgIdFromRoute: (query?: ChatWithFwdMsgRef['query'] | RouteChat['query']) => ChatMessageId | undefined;
  getIncomingCallParamsFromRoute: (route: ChatWithIncomingCall | RouteChat) => {
    chatId: ChatIdObj,
    peerAddress: string
  } | undefined;
}

export function useChatView(navigationUtils: () => NavigationUtils) {
  const { addTask, cancelTasks } = useTaskRunner();
  provide('task-runner', { addTask });

  const { $tr } = inject(I18N_KEY)!;
  const dialog = inject(DIALOGS_KEY)!;

  const {
    route,
    router,
    getChatIdFromRoute,
    getForwardedMsgIdFromRoute,
    getIncomingCallParamsFromRoute,
  } = navigationUtils();

  const { user, appWindowSize, isMobileMode } = storeToRefs(useAppStore());

  const chatsStore = useChatsStore();
  const { updateChatItemInList } = chatsStore;

  const chatStore = useChatStore();
  const { currentChat, currentChatId } = storeToRefs(chatStore);
  const { setChatAndFetchMessages, sendMessageInChat, updateEarlySentMessage } = chatStore;

  const messagesStore = useMessagesStore();
  const { currentChatMessages, selectedMessages } = storeToRefs(messagesStore);
  const { getChatMessage, clearSelectedMessages, deleteMessagesInChat } = messagesStore;

  let files: web3n.files.ReadonlyFile[] | undefined;

  const inputEl = ref<Nullable<HTMLTextAreaElement>>(null);
  const msgText = ref<string>('');
  const disabled = ref(false);
  const attachmentsInfo = ref<ChatMessageAttachmentsInfo[] | undefined>(undefined);
  const initialMessage = ref<Nullable<RegularMsgView>>(null);
  const initialMessageType = ref<'reply' | 'forward'>('reply');
  const editableMessage = ref<Nullable<RegularMsgView>>(null);
  const isEmoticonsDialogOpen = ref(false);

  const msgInfoDisplayed = ref<Nullable<RegularMsgView>>(null);

  const messageListElement = ref<Nullable<HTMLDivElement>>(null);
  const messageListElementRect = ref<DOMRect | undefined>(undefined);
  const whetherShowButtonDown = ref(false);

  const readonly = computed(() => {
    return !currentChat.value
      || currentChat.value?.status === 'no-members'
      || (currentChat.value && ['initiated', 'invited'].includes(currentChat.value.status))
      || (currentChat.value && currentChat.value.isGroupChat && !get(currentChat.value, ['members', user.value, 'hasAccepted']));
  });

  const sendBtnDisabled = computed<boolean>(() => {
    return !(msgText.value.trim() || attachmentsInfo.value) || disabled.value || readonly.value;
  });


  function setMessageListElementRect(el: Nullable<HTMLDivElement>) {
    messageListElementRect.value = el
      ? el.getBoundingClientRect()
      : undefined;
  }

  function onMessageListElementInit(value: Nullable<HTMLDivElement>) {
    messageListElement.value = value;
    setMessageListElementRect(value);
    messageListElement.value!.addEventListener('scroll', onMessageListScroll);
  }

  function onMessageListScroll() {
    whetherShowButtonDown.value = (messageListElement.value!.scrollHeight - 64)
      > (messageListElementRect.value!.height + messageListElement.value!.scrollTop);
  }

  function scrollMessageListToEnd() {
    messageListElement.value && (messageListElement.value.scrollTop = 1e12);
  }

  function setMsgForWhichInfoIsDisplayed(value: Nullable<RegularMsgView>) {
    msgInfoDisplayed.value = value;
  }

  function deleteMessages() {
    if (!selectedMessages.value.length) {
      return;
    }

    dialog.$openDialog<typeof MessageDeleteDialog>({
      component: MessageDeleteDialog,
      componentProps: {
        text: $tr('chat.messages.bulk.delete'),
      },
      dialogProps: {
        title: $tr('chat.messages.bulk.delete'),
        ...(isMobileMode.value && { width: 300 }),
        confirmButtonText: capitalize($tr('btn.text.delete')),
        confirmButtonColor: 'var(--color-text-button-secondary-default)',
        confirmButtonBackground: 'var(--color-bg-button-secondary-default)',
        cancelButtonColor: 'var(--color-text-button-primary-default)',
        cancelButtonBackground: 'var(--color-bg-button-primary-default)',
        onConfirm: deleteForEveryone => {
          if (!currentChatId.value) {
            return;
          }

          deleteMessagesInChat(selectedMessages.value, !!deleteForEveryone);
          clearSelectedMessages();
        },
      },
    });
  }

  function getTextOfEditableOrInitialMsg(msg: Nullable<RegularMsgView>) {
    if (!msg) {
      return '';
    }

    const { body, attachments } = msg;
    const attachmentsText = (attachments || []).map(a => a.name).join(', ');
    return body || `<i>${$tr('text.receive.file')}: ${attachmentsText}</i>`;
  }

  function onEmoticonSelect(emoticon: { id: string, value: string }) {
    msgText.value += emoticon.value;
  }

  async function prepareInfoFromForwardedMessage(fwdMsgId: ChatMessageId) {
    const msg = await getChatMessage(fwdMsgId);
    if (msg && (msg.chatMessageType === 'regular')) {
      initialMessageType.value = 'forward';
      initialMessage.value = msg;
      inputEl.value!.focus();
    }
  }

  async function addFiles(): Promise<void> {
    files = await w3n.shell?.fileDialogs?.openFileDialog!('Select file(s)', '', true);
    if (!isEmpty(files)) {
      attachmentsInfo.value = await getAttachmentFilesInfo({ files });
    }
  }

  async function addFilesViaDnD(fileList: FileList): Promise<void> {
    files = [];
    // @ts-ignore
    for (const f of [...fileList]) {
      const file = await transformFileToWeb3NFile(f);
      if (file) {
        files.push(file);
      }
      if (!isEmpty(files)) {
        attachmentsInfo.value = await getAttachmentFilesInfo({ files });
      }
    }
  }

  async function deleteAttachment(index: number) {
    files && files.splice(index, 1);
    attachmentsInfo.value = await getAttachmentFilesInfo({ files });
    if (size(attachmentsInfo.value) === 0) {
      attachmentsInfo.value = undefined;
    }
  }

  function clearAttachments() {
    files = undefined;
    attachmentsInfo.value = undefined;
  }

  function clearInitialInfo() {
    initialMessage.value = null;
  }

  function finishEditMsgMode() {
    editableMessage.value = null;
    msgText.value = '';
  }

  function prepareReplyMessage(msg: RegularMsgView) {
    initialMessageType.value = 'reply';
    initialMessage.value = msg;
    inputEl.value!.focus();
  }

  function startEditMsgMode(msg: RegularMsgView) {
    editableMessage.value = msg;
    msgText.value = msg.body;
    inputEl.value!.focus();
  }

  async function sendMessage(ev?: Ui3nTextEnterEvent, force = false) {
    if (disabled.value || readonly.value) {
      return;
    }

    const { shiftKey } = ev ?? { shiftKey: false };

    if (force || (!force && !shiftKey)) {
      if (editableMessage.value && JSON.stringify(editableMessage.value!.body) !== JSON.stringify(msgText.value)) {
        disabled.value = true;

        updateEarlySentMessage({
          chatId: currentChatId.value!,
          chatMessageId: editableMessage.value!.chatMessageId,
          updatedBody: msgText.value,
        });

        setTimeout(() => {
          msgText.value = '';
          files = undefined;
          attachmentsInfo.value = undefined;
          initialMessage.value = null;
          editableMessage.value = null;
          disabled.value = false;
        }, 400);

        return;
      }

      const relatedMessage = initialMessage.value
        ? packRelatedMessageToSend(initialMessage.value, initialMessageType.value)
        : undefined;
      disabled.value = true;

      sendMessageInChat({
        chatId: toRaw(currentChatId.value!),
        text: (msgText.value || '').trim(),
        files,
        relatedMessage,
      });

      setTimeout(() => {
        msgText.value = '';
        files = undefined;
        attachmentsInfo.value = undefined;
        initialMessage.value = null;
        editableMessage.value = null;
        disabled.value = false;
      }, 400);
    }
  }

  async function setStateFollowingRouteQuery(query?: ChatWithFwdMsgRef['query']) {
    const fwdMsgId = getForwardedMsgIdFromRoute(query);
    if (fwdMsgId) {
      await prepareInfoFromForwardedMessage(fwdMsgId);
    }
  }

  const routeQueryWatching = watch(
    () => route.query.call,
    async value => {
      if (value === 'yes') {
        const { chatId, peerAddress } = getIncomingCallParamsFromRoute(route as unknown as ChatWithIncomingCall)!;
        await updateChatItemInList(chatId, {
          incomingCall: { chatId, peerAddress },
        });
        nextTick(() => {
          router.replace({ query: {} });
        });
      }
    },
    { immediate: true },
  );

  function scrollToFirstUnreadMessage() {
    const unread = currentChat.value?.unread || 0;
    if (unread === 0) {
      const chatMessageListElement = document.getElementById('chat-messages');
      chatMessageListElement && (chatMessageListElement.scrollTop = 1e12);
      return;
    }

    const incomingMessages = currentChatMessages.value
      .filter(msg => msg.isIncomingMsg && msg.chatMessageType === 'regular')
      .sort((aMsg, bMsg) => bMsg.timestamp - aMsg.timestamp);

    const unreadMessages = incomingMessages.slice(0, unread);
    const firstUnreadMessage = unreadMessages[unread - 1];
    if (!firstUnreadMessage) {
      return;
    }

    const firstUnreadMessageEl = document.getElementById(`msg-${firstUnreadMessage.chatMessageId}`);
    if (!firstUnreadMessageEl) {
      return;
    }

    nextTick(() => {
      firstUnreadMessageEl.scrollIntoView(false);
    });
  }

  watch(
    () => appWindowSize.value.height,
    (val, oldVal) => {
      if (val && val !== oldVal) {
        setMessageListElementRect(messageListElement.value);
        onMessageListScroll();
      }
    },
  );

  async function doAfterMount() {
    const chatId = getChatIdFromRoute();

    if (chatId) {
      await setChatAndFetchMessages(chatId);
      await setStateFollowingRouteQuery();
    }

    scrollToFirstUnreadMessage();
  }

  function doBeforeUnMount() {
    routeQueryWatching.stop();
    messageListElement.value!.removeEventListener('scroll', onMessageListScroll);
  }

  async function doBeforeRouteUpdate(
    to: RouteLocationNormalized,
    from: RouteLocationNormalizedLoaded,
    next: NavigationGuardNext,
  ) {
    const chatIdFrom = getChatIdFromRoute(from.params as ChatRouteType['params']);
    const chatIdTo = getChatIdFromRoute(to.params as ChatRouteType['params']);

    if (chatIdTo && !areChatIdsEqual(chatIdFrom, chatIdTo)) {
      cancelTasks();
      clearSelectedMessages();
      await setChatAndFetchMessages(chatIdTo);
      await setStateFollowingRouteQuery(to.query as ChatWithFwdMsgRef['query']);
      msgText.value = '';

      scrollToFirstUnreadMessage();
      onMessageListScroll();
      setMsgForWhichInfoIsDisplayed(null);
    }

    next();
  }

  return {
    currentChat,
    currentChatMessages,
    selectedMessages,
    messageListElement,
    whetherShowButtonDown,
    msgInfoDisplayed,
    disabled,
    readonly,
    isEmoticonsDialogOpen,
    msgText,
    inputEl,
    initialMessage,
    initialMessageType,
    editableMessage,
    attachmentsInfo,
    sendBtnDisabled,

    clearSelectedMessages,
    deleteMessages,
    onMessageListElementInit,
    scrollMessageListToEnd,
    setMsgForWhichInfoIsDisplayed,
    getTextOfEditableOrInitialMsg,
    addFilesViaDnD,
    addFiles,
    prepareReplyMessage,
    startEditMsgMode,
    onEmoticonSelect,
    clearInitialInfo,
    clearAttachments,
    finishEditMsgMode,
    deleteAttachment,
    sendMessage,

    doAfterMount,
    doBeforeRouteUpdate,
    doBeforeUnMount,
  };
}
