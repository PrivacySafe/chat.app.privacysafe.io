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

import { computed, defineAsyncComponent, inject, onBeforeMount, ref, watch } from 'vue';
import { onBeforeRouteUpdate, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import get from 'lodash/get';
import size from 'lodash/size';
import isEmpty from 'lodash/isEmpty';
import { I18N_KEY, I18nPlugin, DIALOGS_KEY, DialogsPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { transformFileToWeb3NFile } from '@v1nt1248/3nclient-lib/utils';
import { useAppStore } from '@main/store/app';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { getAttachmentFilesInfo, sendChatMessage } from '@main/helpers/chats.helper';
import type { ChatMessageAttachmentsInfo, ChatMessageView, MessageType, Ui3nTextEnterEvent } from '~/index';
import { includesAddress, areAddressesEqual } from '@shared/address-utils';
import { useChatsStore } from '@main/store/chats';

export default function useChatPage() {
  const route = useRoute();
  const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
  const dialog = inject<DialogsPlugin>(DIALOGS_KEY)!;

  const appStore = useAppStore();
  const chatsStore = useChatsStore();
  const { user } = storeToRefs(appStore);
  const { currentChat, currentChatMessages } = storeToRefs(chatsStore);
  const { fetchChat: refreshChat, getChatMessage } = chatsStore;

  const inputEl = ref<Nullable<HTMLTextAreaElement>>(null);
  const msgText = ref<string>('');
  const disabled = ref(false);
  let files: web3n.files.ReadonlyFile[] | undefined;
  const attachmentsInfo = ref<Nullable<ChatMessageAttachmentsInfo[]>>(null);
  const initialMessage = ref<Nullable<ChatMessageView<MessageType>>>(null);
  const initialMessageType = ref<'reply' | 'forward'>('reply');
  const isEmoticonsDialogOpen = ref(false);
  const peerAddress = ref('');

  const chatName = computed<string>(() => {
    const value = currentChat.value;
    return get(value, 'name', '');
  });

  const readonly = computed(() => {
    const { members = [] } = currentChat.value || {};
    return !includesAddress(members, user.value);
  });

  const sendBtnDisabled = computed<boolean>(() => {
    return !(msgText.value.trim() || attachmentsInfo.value) || disabled.value;
  });

  const textOfInitialMessage = computed(() => {
    if (!initialMessage.value) {
      return '';
    }

    const { body, attachments } = initialMessage.value || {};
    const attachmentsText = (attachments || []).map(a => a.name).join(', ');
    return body || `<i>${$tr('text.receive.file')}: ${attachmentsText}</i>`;
  });


  function onEmoticonSelect(emoticon: { id: string, value: string }) {
    msgText.value += emoticon.value;
  }

  async function prepareInfoFromForwardingMessage(initialMsgId?: string) {
    if (initialMsgId) {
      const msg = await getChatMessage({ chatMessageId: initialMsgId });
      if (msg) {
        initialMessageType.value = 'forward';
        initialMessage.value = msg;
        inputEl.value!.focus();
      }
    }
  }

  async function addFiles(): Promise<void> {
    files = await w3n.shell?.fileDialogs?.openFileDialog!('Select file(s)', '', true);
    if (!isEmpty(files)) {
      attachmentsInfo.value = await getAttachmentFilesInfo({ files });
    }
  }

  const addFilesViaDnD = async (fileList: FileList): Promise<void> => {
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
      attachmentsInfo.value = null;
    }
  }

  function clearAttachments() {
    files = undefined;
    attachmentsInfo.value = null;
  }

  function clearInitialInfo() {
    initialMessage.value = null;
  }

  function prepareReplyMessage(msg: ChatMessageView<MessageType>) {
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
      const { chatId } = route.params as { chatId: string };
      const chatAdmins = currentChat.value?.admins || [];
      const chatMembers = currentChat.value?.members || [];
      const recipients = chatMembers.filter(
        addr => !areAddressesEqual(addr, user.value)
      );

      if (recipients.length > 0) {
        disabled.value = true;
        sendChatMessage({
          chatId,
          chatName: size(chatMembers) > 2 ? chatName.value : '',
          text: (msgText.value || '').trim(),
          recipients,
          chatMembers,
          chatAdmins,
          ...(initialMessage.value && {
            initialMessageId: initialMessage.value!.chatMessageId,
          }),
          files: files,
        });

        setTimeout(() => {
          msgText.value = '';
          files = undefined;
          attachmentsInfo.value = null;
          initialMessage.value = null;
          disabled.value = false;
        }, 400);
      }
    }
  }

  function openIncomingCallDialog() {
    const component = defineAsyncComponent(() => import('../../components/dialogs/incoming-call-dialog.vue'));
    dialog.$openDialog({
      component,
      dialogProps: {
        confirmButton: false,
        cancelButton: false,
        closeOnClickOverlay: false,
      },
      componentProps: {
        chatId: route.params.chatId as string,
        peerAddress: peerAddress.value,
        onClose: () => {
          peerAddress.value = '';
        },
      },
    });
  }

  onBeforeMount(async () => {
    const { chatId } = route.params as { chatId: string };
    chatId && await refreshChat(chatId);
    const { initialMsgId } = route.query as { initialMsgId?: string };
    await prepareInfoFromForwardingMessage(initialMsgId);
  });

  onBeforeRouteUpdate(async (to, from, next) => {
    const chatIdFrom = from.params.chatId as string;
    const chatIdTo = to.params.chatId as string;
    if (chatIdTo && chatIdTo !== chatIdFrom) {
      await refreshChat(chatIdTo);
      msgText.value = '';

      const { initialMsgId } = to.query as { initialMsgId?: string };
      await prepareInfoFromForwardingMessage(initialMsgId);
    }
    next();
  });

  watch(
    () => route.query?.peerAddress as string,
    (val, oldVal) => {
      if (val && val !== oldVal) {
        peerAddress.value = decodeURIComponent(val);
        openIncomingCallDialog();
      }
    },
    { immediate: true },
  );

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
  };
}
