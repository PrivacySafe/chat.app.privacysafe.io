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
import { computed, inject, nextTick, ref, toRaw, watch } from 'vue';
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
import { I18N_KEY } from '@v1nt1248/3nclient-lib/plugins';
import { transformFileToWeb3NFile } from '@v1nt1248/3nclient-lib/utils';
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
import { useAppStore } from '@main/common/store/app.store';
import { useChatsStore } from '@main/common/store/chats.store';
import { useChatStore } from '@main/common/store/chat.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import { areChatIdsEqual } from '@shared/chat-ids';
import { getAttachmentFilesInfo } from '@main/common/utils/chats.helper';

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
  const { $tr } = inject(I18N_KEY)!;

  const {
    route,
    router,
    getChatIdFromRoute,
    getForwardedMsgIdFromRoute,
    getIncomingCallParamsFromRoute,
  } = navigationUtils();

  const { user } = storeToRefs(useAppStore());

  const chatsStore = useChatsStore();
  const { updateChatItemInList } = chatsStore;

  const chatStore = useChatStore();
  const { currentChat, currentChatId } = storeToRefs(chatStore);
  const { setChatAndFetchMessages, sendMessageInChat } = chatStore;

  const messagesStore = useMessagesStore();
  const { currentChatMessages } = storeToRefs(messagesStore);
  const { getChatMessage } = messagesStore;

  let files: web3n.files.ReadonlyFile[] | undefined;

  const inputEl = ref<Nullable<HTMLTextAreaElement>>(null);
  const msgText = ref<string>('');
  const disabled = ref(false);
  const attachmentsInfo = ref<ChatMessageAttachmentsInfo[] | undefined>(undefined);
  const initialMessage = ref<Nullable<RegularMsgView>>(null);
  const initialMessageType = ref<'reply' | 'forward'>('reply');
  const isEmoticonsDialogOpen = ref(false);

  const readonly = computed(() => {
    return !currentChat.value
      || currentChat.value?.status === 'no-members'
      || (currentChat.value && ['initiated', 'invited'].includes(currentChat.value.status))
      || (currentChat.value && currentChat.value.isGroupChat && !get(currentChat.value, ['members', user.value, 'hasAccepted']));
  });

  const sendBtnDisabled = computed<boolean>(() => {
    return !(msgText.value.trim() || attachmentsInfo.value) || disabled.value || readonly.value;
  });

  const textOfInitialMessage = computed(() => {
    if (!initialMessage.value) {
      return '';
    }

    const body = initialMessage.value?.body;
    const attachments = (initialMessage.value as RegularMsgView)?.attachments;
    const attachmentsText = (attachments || []).map(a => a.name).join(', ');
    return body || `<i>${$tr('text.receive.file')}: ${attachmentsText}</i>`;
  });

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

  function prepareReplyMessage(msg: RegularMsgView) {
    initialMessageType.value = 'reply';
    initialMessage.value = msg;
    inputEl.value!.focus();
  }

  async function sendMessage(ev?: Ui3nTextEnterEvent, force = false) {
    if (disabled.value || readonly.value) {
      return;
    }

    const { shiftKey } = ev ?? { shiftKey: false };

    if (!force && shiftKey) {
      msgText.value += '\n';
    } else if (force || (!force && !shiftKey)) {
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
        const messagesElement = document.getElementById('chat-messages');
        messagesElement && messagesElement.scrollTo({
          top: 1e12,
          left: 0,
          behavior: 'smooth',
        });

        msgText.value = '';
        files = undefined;
        attachmentsInfo.value = undefined;
        initialMessage.value = null;
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


  async function doBeforeMount() {
    const chatId = getChatIdFromRoute();

    if (chatId) {
      await setChatAndFetchMessages(chatId);
      await setStateFollowingRouteQuery();
    }
  }

  function doBeforeUnMount() {
    routeQueryWatching.stop();
  }

  async function doBeforeRouteUpdate(
    to: RouteLocationNormalized,
    from: RouteLocationNormalizedLoaded,
    next: NavigationGuardNext,
  ) {
    const chatIdFrom = getChatIdFromRoute(from.params as ChatRouteType['params']);
    const chatIdTo = getChatIdFromRoute(to.params as ChatRouteType['params']);
    if (chatIdTo && !areChatIdsEqual(chatIdFrom, chatIdTo)) {
      await setChatAndFetchMessages(chatIdTo);
      await setStateFollowingRouteQuery(to.query as ChatWithFwdMsgRef['query']);
      msgText.value = '';
    }
    next();
  }

  return {
    currentChat,
    currentChatMessages,
    disabled,
    readonly,
    isEmoticonsDialogOpen,
    msgText,
    inputEl,
    initialMessage,
    initialMessageType,
    textOfInitialMessage,
    attachmentsInfo,
    sendBtnDisabled,
    addFilesViaDnD,
    addFiles,
    prepareReplyMessage,
    onEmoticonSelect,
    clearInitialInfo,
    clearAttachments,
    deleteAttachment,
    sendMessage,

    doBeforeRouteUpdate,
    doBeforeMount,
    doBeforeUnMount,
  };
}
