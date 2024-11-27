import { computed, defineAsyncComponent, inject, onBeforeMount, ref, watch } from 'vue';
import { onBeforeRouteUpdate, useRoute } from 'vue-router';
import { storeToRefs } from 'pinia';
import get from 'lodash/get';
import size from 'lodash/size';
import without from 'lodash/without';
import isEmpty from 'lodash/isEmpty';
import { I18N_KEY, I18nPlugin, DIALOGS_KEY, DialogsPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { transformFileToWeb3NFile } from '@v1nt1248/3nclient-lib/utils';
import { useAppStore, useChatsStore } from '@main/store';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { getAttachmentFilesInfo, sendChatMessage } from '@main/helpers/chats.helper';
import type { ChatMessageAttachmentsInfo, ChatMessageView, MessageType, Ui3nTextEnterEvent } from '~/index';

export default function useChatPage() {
  const route = useRoute();
  const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
  const dialog = inject<DialogsPlugin>(DIALOGS_KEY)!;

  const appStore = useAppStore();
  const chatsStore = useChatsStore();
  const { user } = storeToRefs(appStore);
  const { currentChat, currentChatMessages } = storeToRefs(chatsStore);
  const { getChat, getChatMessage } = chatsStore;

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
    const value = currentChat.value();
    return get(value, 'name', '');
  });

  const readonly = computed(() => {
    const { members = [] } = currentChat.value() || {};
    return !members.includes(user.value);
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
    const chatMembers = currentChat.value()?.members || [];
    if (disabled.value || readonly.value || !chatMembers.includes(user.value)) {
      return;
    }

    const { shiftKey } = ev ?? { shiftKey: false };

    if (!force && shiftKey) {
      msgText.value += '\n';
    } else if (force || (!force && !shiftKey)) {
      const { chatId } = route.params as { chatId: string };
      const chatAdmins = currentChat.value()?.admins || [];
      const recipients = without(chatMembers, user.value);

      if (recipients.length) {
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
        chatId: route.params.chatId,
        peerAddress: peerAddress.value,
        onClose: () => {
          peerAddress.value = '';
        },
      },
    });
  }

  onBeforeMount(async () => {
    const { chatId } = route.params as { chatId: string };
    chatId && await getChat(chatId);
    const { initialMsgId } = route.query as { initialMsgId?: string };
    await prepareInfoFromForwardingMessage(initialMsgId);
  });

  onBeforeRouteUpdate(async (to, from, next) => {
    const chatIdFrom = from.params.chatId as string;
    const chatIdTo = to.params.chatId as string;
    if (chatIdTo && chatIdTo !== chatIdFrom) {
      await getChat(chatIdTo);
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
