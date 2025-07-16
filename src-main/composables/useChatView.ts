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

import { computed, defineAsyncComponent, inject, ref, toRaw, watch, WatchHandle } from 'vue';
import { NavigationGuardNext, RouteLocationNormalized, RouteLocationNormalizedLoaded, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import size from 'lodash/size';
import isEmpty from 'lodash/isEmpty';
import { I18N_KEY, DIALOGS_KEY } from '@v1nt1248/3nclient-lib/plugins';
import { transformFileToWeb3NFile } from '@v1nt1248/3nclient-lib/utils';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { getAttachmentFilesInfo } from '@main/utils/chats.helper';
import type { ChatIdObj, ChatMessageAttachmentsInfo, ChatMessageId, ChatMessageView, RegularMsgView, RelatedMessage, Ui3nTextEnterEvent } from '~/index';
import { useChatStore } from '@main/store/chat.store';
import { ChatRouteType, ChatWithFwdMsgRef } from '@main/router';
import { areChatIdsEqual } from '@shared/chat-ids';
import { useRouting } from './useRouting';

export default function useChatView() {
  const route = useRoute();
  const {
    getChatIdFromRoute, getForwardedMsgIdFromRoute,
    getIncomingCallParamsFromRoute
  } = useRouting();
  const { $tr } = inject(I18N_KEY)!;
  const dialog = inject(DIALOGS_KEY)!;

  const chatStore = useChatStore();
  const {
    currentChat, currentChatMessages, currentChatId
  } = storeToRefs(chatStore);
  const {
    setChatAndFetchMessages, sendMessageInChat, getChatMessage
  } = chatStore;

  const inputEl = ref<Nullable<HTMLTextAreaElement>>(null);
  const msgText = ref<string>('');
  const disabled = ref(false);
  let files: web3n.files.ReadonlyFile[] | undefined;
  const attachmentsInfo = ref<ChatMessageAttachmentsInfo[]|undefined>(undefined);
  const initialMessage = ref<Nullable<RegularMsgView>>(null);
  const initialMessageType = ref<'reply' | 'forward'>('reply');
  const isEmoticonsDialogOpen = ref(false);

  const readonly = computed(() => {
    return !currentChat.value;
  });

  const sendBtnDisabled = computed<boolean>(() => {
    return !(msgText.value.trim() || attachmentsInfo.value) || disabled.value;
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
  };

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

  async function sendMessage(ev?:Ui3nTextEnterEvent, force = false) {
    if (disabled.value || readonly.value) {
      return;
    }

    const { shiftKey } = ev ?? { shiftKey: false };

    if (!force && shiftKey) {
      msgText.value += '\n';
    } else if (force || (!force && !shiftKey)) {
      const relatedMessage = (initialMessage.value ?
        packRelatedMessageToSend(
          initialMessage.value, initialMessageType.value
        ) :
        undefined
      );
      disabled.value = true;
      sendMessageInChat(
        toRaw(currentChatId.value!),
        (msgText.value || '').trim(),
        files,
        relatedMessage
      );
      setTimeout(() => {
        msgText.value = '';
        files = undefined;
        attachmentsInfo.value = undefined;
        initialMessage.value = null;
        disabled.value = false;
      }, 400);
    }
  }

  function openIncomingCallDialog(chatId: ChatIdObj, peerAddress: string) {
    const component = defineAsyncComponent(() => import('@main/components/dialogs/incoming-call-dialog.vue'));
    dialog.$openDialog({
      component,
      dialogProps: {
        confirmButton: false,
        cancelButton: false,
        closeOnClickOverlay: false,
      },
      componentProps: {
        chatId,
        peerAddress
      },
    });
  }

  let routeQueryWatching: WatchHandle;

  async function doBeforeMount() {
    const chatId = getChatIdFromRoute();
    if (chatId) {
      await setChatAndFetchMessages(chatId);
      await setStateFollowingRouteQuery();
    }
    routeQueryWatching = watch(
      () => route.query,
      (val) => {
        const callParams = getIncomingCallParamsFromRoute(route as any);
        if (callParams) {
          const { chatId, peerAddress } = callParams;
          openIncomingCallDialog(chatId, peerAddress);
        }
      },
      { immediate: true },
    );
  }

  function doBeforeUnMount() {
    routeQueryWatching.stop();
  }

  async function setStateFollowingRouteQuery(
    query?: ChatWithFwdMsgRef['query']
  ) {
    const fwdMsgId = getForwardedMsgIdFromRoute(query);
    if (fwdMsgId) {
      await prepareInfoFromForwardedMessage(fwdMsgId);
    }
  }

  async function doBeforeRouteUpdate(
    to: RouteLocationNormalized, from: RouteLocationNormalizedLoaded,
    next: NavigationGuardNext
  ) {
    const chatIdFrom = getChatIdFromRoute(
      from.params as ChatRouteType['params']
    );
    const chatIdTo = getChatIdFromRoute(
      to.params as ChatRouteType['params']
    );
    if (chatIdTo && !areChatIdsEqual(chatIdFrom, chatIdTo)) {
      await setChatAndFetchMessages(chatIdTo);
      await setStateFollowingRouteQuery(to.query as any);
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
    doBeforeUnMount
  };
}

function packRelatedMessageToSend(
  msg: ChatMessageView, relationType: 'reply' | 'forward'
): RelatedMessage {
  if (relationType === 'reply') {
    return {
      replyTo: {
        chatMessageId: msg.chatMessageId
      }
    };
  } else if (relationType === 'forward') {
    const { chatId, chatMessageId } = msg;
    return {
      forwardingOf: { chatId, chatMessageId }
    };
  } else {
    throw new Error(`Unknown relation type: ${relationType}`);
  }
}
