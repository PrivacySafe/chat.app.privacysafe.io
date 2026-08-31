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
import { useI18n } from 'vue-i18n';
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
import { DIALOGS_KEY, DialogsPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { capitalize } from '@v1nt1248/3nclient-lib/utils';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import type {
  ChatIdObj,
  ChatMessageAttachmentsInfo,
  ChatMessageId,
  ChatMessageView,
  GroupChatView,
  RegularMsgView,
  RelatedMessage,
  Ui3nTextEnterEvent,
} from '~/index';
import type { ChatRoute, ChatRouteType, ChatWithFwdMsgRef, ChatWithIncomingCall } from '@main/desktop/router';
import type { RouteChat } from '@main/mobile/types';
import { fileLinkStoreSrv } from '@main/common/services/external-services';
import { useTaskRunner } from '@main/common/composables/useTaskRunner';
import { useAppStore } from '@main/common/store/app.store';
import { useChatsStore } from '@main/common/store/chats.store';
import { useChatStore } from '@main/common/store/chat.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import { areChatIdsEqual } from '@shared/chat-ids';
import { toCanonicalAddress } from '@shared/address-utils';
import {
  prepareAttachmentEntityInfo,
  prepareMessageBody,
  restoreRawMessage,
} from '@main/common/utils/chats.helper';
import MessageDeleteDialog from '@main/common/components/dialogs/message-delete-dialog.vue';
import { makeLogger } from '@shared/logger';

const log = makeLogger('ChatView');

/**
 * How close to an edge of the message list counts as being at it: for the bottom
 * it decides whether the "scroll down" button is shown, for the top it triggers
 * loading of the previous page.
 */
const LIST_EDGE_THRESHOLD_PX = 64;

/**
 * How old an incoming-call command may be and still arm the incoming-call UI.
 * Well under the background service's RINGING_NO_ANSWER_TIMEOUT_MILLIS: a
 * command older than this is a re-delivery (window re-creation), not a call
 * that is still ringing.
 */
const INCOMING_CALL_CMD_MAX_AGE_MILLIS = 60_000;

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
  getForwardedMsgIdFromRoute: (
    query?: ChatWithFwdMsgRef['query'] | RouteChat['query'],
  ) => ChatMessageId | undefined;
  getIncomingCallParamsFromRoute: (route: ChatWithIncomingCall | RouteChat) =>
    | {
        chatId: ChatIdObj;
        peerAddress: string;
        callSessionId?: string;
        callSentAt?: number;
      }
    | undefined;
}

export function useChatView(navigationUtils: () => NavigationUtils) {
  const { addTask, cancelTasks } = useTaskRunner();
  provide('task-runner', { addTask });

  const { t } = useI18n();
  const dialog = inject<DialogsPlugin>(DIALOGS_KEY)!;

  const { route, router, getChatIdFromRoute, getForwardedMsgIdFromRoute, getIncomingCallParamsFromRoute } =
    navigationUtils();

  const { user, appWindowSize, isMobileMode } = storeToRefs(useAppStore());

  const chatsStore = useChatsStore();
  const { updateChatItemInList } = chatsStore;

  const chatStore = useChatStore();
  const { currentChat, currentChatId } = storeToRefs(chatStore);
  const { setChatAndFetchMessages, sendMessageInChat, updateEarlySentMessage } = chatStore;

  const messagesStore = useMessagesStore();
  const { currentChatMessages, selectedMessages, hasMoreOlder, isFetchingOlder } = storeToRefs(messagesStore);
  const { getChatMessage, clearSelectedMessages, deleteMessagesInChat, fetchOlderMessages } = messagesStore;

  const files = ref<(web3n.files.ReadonlyFile | web3n.files.ReadonlyFS)[]>([]);

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

  const mention = ref<{ startIndex: number; member: Nullable<string> }>({
    startIndex: -1,
    member: null,
  });
  const activeSuggestionIndex = ref(-1);
  const filteredMembers = computed(() =>
    currentChat.value && (currentChat.value as GroupChatView).members
      ? Object.keys((currentChat.value as GroupChatView).members).filter(addr => {
          if (mention.value.member === null) {
            return false;
          }

          const mail = toCanonicalAddress(addr.toLowerCase());
          return mail !== user.value && mail.includes(mention.value.member.toLowerCase());
        })
      : [],
  );

  watch(
    () => size(filteredMembers.value),
    val => {
      setTimeout(() => {
        if (val > 0) {
          activeSuggestionIndex.value = -1;
        }
      }, 100);
    },
    {
      immediate: true,
    },
  );

  const attachmentsTotal = computed(() => {
    if (isEmpty(attachmentsInfo.value)) {
      return 0;
    }

    return (attachmentsInfo.value || []).reduce((acc, item) => {
      acc += item.size;
      return acc;
    }, 0);
  });

  const readonly = computed(() => {
    return (
      !currentChat.value ||
      currentChat.value?.status === 'no-members' ||
      (currentChat.value && ['initiated', 'invited'].includes(currentChat.value.status)) ||
      (currentChat.value &&
        currentChat.value.isGroupChat &&
        !get(currentChat.value, ['members', user.value, 'hasAccepted']))
    );
  });

  const sendBtnDisabled = computed<boolean>(() => {
    return !(msgText.value.trim() || attachmentsInfo.value) || disabled.value || readonly.value;
  });

  function hideSuggestions() {
    mention.value = {
      startIndex: -1,
      member: null,
    };
    activeSuggestionIndex.value = -1;
  }

  function recognizeMention(text: string) {
    const cursorPosition = inputEl.value!.selectionStart;
    const lastAtSymbolIndex = text.lastIndexOf('@', cursorPosition - 1);
    if (lastAtSymbolIndex !== -1 && (lastAtSymbolIndex === 0 || /\s/.test(text[lastAtSymbolIndex - 1]))) {
      mention.value.startIndex = lastAtSymbolIndex + 1;
      mention.value.member = text.substring(lastAtSymbolIndex + 1, cursorPosition);
    }
  }

  function onInput(text: string) {
    if (currentChat.value?.isGroupChat) {
      recognizeMention(text);
    }
  }

  function getCharFromTheLeft(event: KeyboardEvent) {
    const target = event.target as HTMLTextAreaElement;
    const cursorPosition = target.selectionStart;
    if (cursorPosition !== null && cursorPosition > 0) {
      const text = target.value;
      return text[cursorPosition - 1];
    }

    return '';
  }

  function onKeydown(event: KeyboardEvent) {
    const { key } = event;
    switch (key) {
      case 'ArrowUp': {
        const char = getCharFromTheLeft(event);
        if (char !== '@') {
          return;
        }

        event.preventDefault();
        const possibleSuggestionIndex = activeSuggestionIndex.value - 1;
        activeSuggestionIndex.value =
          possibleSuggestionIndex === -1 ? size(filteredMembers.value) - 1 : possibleSuggestionIndex;
        break;
      }
      case 'ArrowDown': {
        const char = getCharFromTheLeft(event);
        if (char !== '@') {
          return;
        }

        event.preventDefault();
        const possibleSuggestionIndex = activeSuggestionIndex.value + 1;
        activeSuggestionIndex.value =
          possibleSuggestionIndex === size(filteredMembers.value) ? 0 : possibleSuggestionIndex;
        break;
      }
      default:
    }
  }

  function onEscape(event: Event) {
    event.preventDefault();
    if (initialMessage.value !== null) {
      return clearInitialInfo();
    }

    if (editableMessage.value !== null) {
      return finishEditMsgMode();
    }

    // TODO ??? Perhaps it's also worth handling the situation when a user enters a mention of another address in
    //  the text.
    // TODO ??? It might also be worthwhile to handle the situation when attachments are attached to a message.
  }

  function selectMention(index: number) {
    const member = filteredMembers.value[index];
    const parsedMember = member.split('@');
    const currentMention = `${parsedMember[0]}[${parsedMember[1]}]`;
    const newMsgText =
      msgText.value.slice(0, mention.value.startIndex) +
      currentMention +
      msgText.value.slice(mention.value.startIndex + 1) +
      ' ';
    msgText.value = newMsgText;

    activeSuggestionIndex.value = -1;
    mention.value = {
      startIndex: -1,
      member: null,
    };
    inputEl.value!.focus();
  }

  function setMessageListElementRect(el: Nullable<HTMLDivElement>) {
    messageListElementRect.value = el ? el.getBoundingClientRect() : undefined;
  }

  function onMessageListElementInit(value: Nullable<HTMLDivElement>) {
    messageListElement.value = value;
    setMessageListElementRect(value);
    messageListElement.value!.addEventListener('scroll', onMessageListScroll);
  }

  function onMessageListScroll() {
    whetherShowButtonDown.value =
      messageListElement.value!.scrollHeight - LIST_EDGE_THRESHOLD_PX >
      messageListElementRect.value!.height + messageListElement.value!.scrollTop;

    if (messageListElement.value!.scrollTop <= LIST_EDGE_THRESHOLD_PX) {
      void loadOlderMessagesKeepingPosition();
    }
  }

  /**
   * Adds the previous page at the top of the list without moving what the user
   * is looking at: prepending pushes the content down by exactly the height it
   * adds, so the same amount goes back into the scroll position.
   */
  async function loadOlderMessagesKeepingPosition(): Promise<void> {
    const el = messageListElement.value;
    if (!el || !hasMoreOlder.value || isFetchingOlder.value) {
      return;
    }

    const heightBefore = el.scrollHeight;
    await fetchOlderMessages();
    await nextTick();
    el.scrollTop += el.scrollHeight - heightBefore;
  }

  function scrollMessageListToEnd() {
    messageListElement.value && (messageListElement.value.scrollTop = 1e12);
  }

  function setMsgForWhichInfoIsDisplayed(value: Nullable<RegularMsgView>) {
    msgInfoDisplayed.value = value;
  }

  async function deleteMessages() {
    if (!selectedMessages.value.length) {
      return;
    }

    const res = await dialog.$openDialog<boolean>(MessageDeleteDialog, {
      text: t('chat.messages.bulk.delete'),
      dialogProps: {
        title: t('chat.messages.bulk.delete'),
        ...(isMobileMode.value && { width: 300 }),
        confirmButtonText: capitalize(t('app.text.delete')),
        confirmButtonColor: 'var(--color-text-button-secondary-default)',
        confirmButtonBackground: 'var(--color-bg-button-secondary-default)',
        cancelButtonColor: 'var(--color-text-button-primary-default)',
        cancelButtonBackground: 'var(--color-bg-button-primary-default)',
      },
    });

    const { event, data } = res;
    if (event === 'confirm' && currentChatId.value) {
      deleteMessagesInChat(selectedMessages.value, data);
      clearSelectedMessages();
    }
  }

  function getTextOfEditableOrInitialMsg(msg: Nullable<RegularMsgView>) {
    if (!msg) {
      return '';
    }

    const { body, attachments } = msg;
    const attachmentsText = (attachments || []).map(a => a.name).join(', ');
    return body || `<i>${t('text.receive.file')}: ${attachmentsText}</i>`;
  }

  function onEmoticonSelect(emoticon: { id: string; value: string }) {
    msgText.value += emoticon.value;
  }

  async function prepareInfoFromForwardedMessage(fwdMsgId: ChatMessageId) {
    const msg = await getChatMessage(fwdMsgId);
    if (msg && msg.chatMessageType === 'regular') {
      initialMessageType.value = 'forward';
      initialMessage.value = msg;
      inputEl.value!.focus();
    }
  }

  async function addFiles(): Promise<void> {
    if (isEmpty(attachmentsInfo.value)) {
      attachmentsInfo.value = [];
    }

    const newFiles = await w3n.shell?.fileDialogs?.openFileDialog!('Select file(s)', '', true);
    if (!newFiles) {
      return;
    }

    for (const f of newFiles) {
      files.value.push(f);
      const attachmentInfo = await prepareAttachmentEntityInfo(f);
      attachmentInfo && attachmentsInfo.value!.push(attachmentInfo);
    }

    inputEl.value && inputEl.value.focus();
  }

  async function fileTo3nFile(
    f: File,
  ): Promise<web3n.files.ReadonlyFile | web3n.files.ReadonlyFS | undefined | null> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async e => {
        const fileContent = e.target?.result;
        if (fileContent) {
          const fileId = await fileLinkStoreSrv.saveFile(fileContent as ArrayBuffer, f.name);
          const entity = (await fileLinkStoreSrv.getFile(fileId)) as web3n.files.ReadonlyFile | null | undefined;
          resolve(entity);
        }
      };

      reader.onerror = e => {
        reject(e);
      };

      reader.readAsArrayBuffer(f);
    });
  }

  async function addFilesViaDnD(fileList: FileList): Promise<void> {
    if (readonly.value) {
      return;
    }

    if (isEmpty(attachmentsInfo.value)) {
      attachmentsInfo.value = [];
    }
    // @ts-ignore
    for (const f of [...fileList]) {
      let entity: web3n.files.ReadonlyFile | web3n.files.ReadonlyFS | null | undefined;

      try {
        const fStats = await w3n.shell!.deviceFiles?.statStandardItem(f);

        entity = fStats!.isFolder
          ? await w3n.shell!.deviceFiles?.standardFileToDeviceFolder!(f)
          : await w3n.shell!.deviceFiles?.standardFileToDeviceFile!(f);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        if (e.type === 'file' && e.isInMemoryFile) {
          entity = await fileTo3nFile(f);
        } else {
          log.error('Error reading file. ', e);
        }
      }

      if (entity) {
        files.value.push(entity);
        const attachmentInfo = await prepareAttachmentEntityInfo(entity);
        attachmentInfo && attachmentsInfo.value!.push(attachmentInfo);
      }
    }

    inputEl.value && inputEl.value.focus();
  }

  async function addFilesViaPaste(ev: ClipboardEvent): Promise<void> {
    if (size(ev.clipboardData?.files) > 0) {
      const currentMsgText = msgText.value;
      await addFilesViaDnD(ev.clipboardData!.files);
      inputEl.value && inputEl.value.select();
      const selection = window.getSelection();
      if (selection) {
        selection.deleteFromDocument();
        msgText.value = currentMsgText;
      }
    }
  }

  async function deleteAttachment(index: number) {
    files.value && files.value.splice(index, 1);
    attachmentsInfo.value && attachmentsInfo.value.splice(index, 1);
    if (size(attachmentsInfo.value) === 0) {
      attachmentsInfo.value = undefined;
    }
  }

  function clearAttachments() {
    files.value = [];
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
    editableMessage.value.body = restoreRawMessage(msg.body);

    msgText.value = restoreRawMessage(msg.body);
    inputEl.value!.focus();
  }

  function isMsgEmpty() {
    if (!(msgText.value || size(files) > 0)) {
      return true;
    }

    if (size(files.value) > 0) {
      return false;
    }

    if (msgText.value === '\n') {
      msgText.value = '';
      return true;
    }

    return false;
  }

  async function sendMessage(ev?: Ui3nTextEnterEvent, force = false) {
    if (disabled.value || readonly.value || isMsgEmpty()) {
      return;
    }

    if (!isEmpty(filteredMembers.value)) {
      if (activeSuggestionIndex.value >= 0) {
        selectMention(activeSuggestionIndex.value);
        setTimeout(() => {
          const lastCharCode = msgText.value.charCodeAt(msgText.value.length - 1);
          lastCharCode === 10 && (msgText.value = msgText.value.slice(0, -1));
        }, 50);
      }
      return;
    }

    const { shiftKey } = ev ?? { shiftKey: false };

    if (force || (!force && !shiftKey)) {
      if (editableMessage.value && JSON.stringify(editableMessage.value!.body) !== JSON.stringify(msgText.value)) {
        disabled.value = true;

        updateEarlySentMessage({
          chatId: currentChatId.value!,
          chatMessageId: editableMessage.value!.chatMessageId,
          updatedBody: msgText.value ? prepareMessageBody(msgText.value) : '',
        });

        setTimeout(() => {
          msgText.value = '';
          files.value = [];
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

      msgText.value = msgText.value ? prepareMessageBody(msgText.value) : '';

      sendMessageInChat({
        chatId: toRaw(currentChatId.value!),
        text: (msgText.value || '').trim(),
        files: toRaw(files.value),
        relatedMessage,
      });

      setTimeout(() => {
        msgText.value = '';
        files.value = [];
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
        const { chatId, peerAddress, callSessionId, callSentAt } = getIncomingCallParamsFromRoute(
          route as unknown as ChatWithIncomingCall,
        )!;
        // An incoming-call command can reach this window long after it was
        // issued: getStartedCmd() re-delivers the starting command when the
        // window is re-created. Arming the UI from a stale one puts up a Join
        // button for a call that is over, so age gates it here - the command
        // now says when it was sent.
        if (callSentAt && Date.now() - callSentAt > INCOMING_CALL_CMD_MAX_AGE_MILLIS) {
          log.info(
            `Ignoring stale incoming-call command for chat ${chatId.chatId} from ` +
              `${peerAddress} (age: ${Date.now() - callSentAt}ms)`,
          );
          nextTick(() => {
            router.replace({ query: {} });
          });
          return;
        }
        const armed = await updateChatItemInList(chatId, {
          incomingCall: { chatId, peerAddress, callSessionId },
        });
        // The last link of the incoming-call chain: the background service asked
        // the shell for the incoming-call UI, the command routed here, and
        // `incomingCall` is what drives both the Join/Decline buttons and the
        // ringtone. Logged at `info` (this window never turns diagnostics on), so
        // that "it only rang on one device" can be pinned on either the signal
        // or the UI, and not left between them. The outcome is reported, not
        // assumed: the chat may not be in this window's list at all, and a line
        // claiming success there would send the next diagnosis the wrong way.
        log.info(
          armed
            ? `Incoming-call UI armed for chat ${chatId.chatId} from ${peerAddress}`
            : `Incoming-call UI NOT armed for chat ${chatId.chatId} from ${peerAddress}: ` +
                `the chat is not in this window's list`,
        );
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

    if (currentChatId.value?.isGroupChat && inputEl.value) {
      inputEl.value.addEventListener('keydown', onKeydown);
    }
  }

  function doBeforeUnMount() {
    routeQueryWatching.stop();
    messageListElement.value!.removeEventListener('scroll', onMessageListScroll);

    if (currentChatId.value?.isGroupChat && inputEl.value) {
      inputEl.value.removeEventListener('keydown', onKeydown);
    }
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
    t,
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
    files,
    attachmentsInfo,
    attachmentsTotal,
    sendBtnDisabled,
    mention,
    filteredMembers,
    activeSuggestionIndex,
    clearSelectedMessages,
    deleteMessages,
    onInput,
    onKeydown,
    onEscape,
    selectMention,
    hideSuggestions,
    onMessageListElementInit,
    scrollMessageListToEnd,
    setMsgForWhichInfoIsDisplayed,
    getTextOfEditableOrInitialMsg,
    addFilesViaDnD,
    addFiles,
    addFilesViaPaste,
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
