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
import { computed, type ComputedRef, inject, onBeforeUnmount, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { DIALOGS_KEY, I18N_KEY, NOTIFICATIONS_KEY } from '@v1nt1248/3nclient-lib/plugins';
import { capitalize, prepareDateAsSting } from '@v1nt1248/3nclient-lib/utils';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { areChatIdsEqual } from '@shared/chat-ids';
import { exportChatMessages } from '@main/common/utils/chats.helper';
import { useAppStore } from '@main/common/store/app.store';
import { useUiIncomingStore } from '@main/common/store/ui.incoming.store';
import { useChatsStore } from '@main/common/store/chats.store';
import { useChatStore } from '@main/common/store/chat.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import type { ChatListItemView, ChatMessageView } from '~/chat.types';
import ConfirmationDialog from '@main/common/components/dialogs/confirmation-dialog.vue';
import ChatRenameDialog from '@main/common/components/dialogs/chat-rename-dialog.vue';
import ChatInfoDialog from '@main/common/components/dialogs/chat-info-dialog/chat-info-dialog.vue';

interface ChatActionHandlers {
  history: {
    export: () => Promise<void>;
    clean: () => Promise<void>;
  };
  chat: {
    info: () => Promise<void> | void;
    rename: () => Promise<void> | void;
    close: () => Promise<void>;
    delete: () => Promise<void> | void;
    leave: () => Promise<void> | void;
  };
}

export function useChatHeader(
  { chat, messages, goToChats, isMobileMode }:
  {
    chat: ComputedRef<ChatListItemView>;
    messages: ComputedRef<ChatMessageView[]>;
    goToChats: () => Promise<void>;
    isMobileMode?: boolean;
  },
) {
  const { $tr } = inject(I18N_KEY)!;
  const dialog = inject(DIALOGS_KEY)!;
  const notification = inject(NOTIFICATIONS_KEY)!;

  const { user } = storeToRefs(useAppStore());

  const { joinIncomingCall, dismissIncomingCall, startCall, endCall } = useUiIncomingStore();
  const { refreshChatList } = useChatsStore();

  const chatStore = useChatStore();
  const { currentChatId } = storeToRefs(chatStore);
  const { resetCurrentChat, renameChat, deleteChat } = chatStore;

  const messagesStore = useMessagesStore();
  const { deleteAllMessagesInChat } = messagesStore;

  const text = computed<string>(() => {
    if (!chat.value.lastMsg) {
      return '';
    }
    return prepareDateAsSting(chat.value.lastMsg.timestamp);
  });

  const isGroupChat = computed(() => chat.value.isGroupChat);
  const currentChatObjId = computed(() => ({ isGroupChat: isGroupChat.value, chatId: chat.value.chatId }));
  const isIncomingCall = computed(() => !!chat.value.incomingCall
    && !!chat.value.incomingCall.chatId
    && !!chat.value.incomingCall.peerAddress,
  );
  const chatWithCall = computed(() => !!chat.value.callStart);

  const callDuration = ref<Nullable<string>>(null);
  const timer = ref<NodeJS.Timeout | undefined>(undefined);

  function calculateCallDuration() {
    const diffInMinutes = Math.round((Date.now() - chat.value.callStart!) / 1000 / 60);
    const h = String(Math.floor(diffInMinutes / 60)).padStart(2, '0');
    const m = String(diffInMinutes % 60).padStart(2, '0');
    return `${h}:${m}`;
  }

  async function runChatHistoryExporting() {
    const result = await exportChatMessages({
      $tr,
      ownAddr: user.value!,
      chat: chat.value,
      messages: messages.value,
    });
    if (result !== undefined) {
      notification.$createNotice({
        type: result ? 'success' : 'error',
        content: result
          ? $tr('chat.export.result.success', { file: `${chat.value?.name}.txt` })
          : $tr('chat.export.result.error', { file: `${chat.value?.name}.txt` }),
      });
    }
  }

  async function runChatHistoryCleaning() {
    dialog.$openDialog<typeof ConfirmationDialog>({
      component: ConfirmationDialog,
      dialogProps: {
        title: $tr('chat.history.clean.dialog.title'),
        ...(isMobileMode && { width: 300 }),
        onConfirm: async () => {
          await deleteAllMessagesInChat(chat.value);
        },
      },
    });
  }

  function openChatInfoDialog() {
    dialog.$openDialog<typeof ChatInfoDialog>({
      component: ChatInfoDialog,
      dialogProps: {
        title: $tr('chat.info.dialog.title'),
        ...(isMobileMode && { width: 300 }),
        confirmButton: false,
        cancelButton: false,
      },
      componentProps: {
        chat: chat.value,
        isMobileMode,
      },
    });
  }

  function runChatRenaming() {
    dialog.$openDialog<typeof ChatRenameDialog>({
      component: ChatRenameDialog,
      componentProps: {
        chatName: chat.value.name,
      },
      dialogProps: {
        title: $tr('chat.rename.dialog.title'),
        ...(isMobileMode && { width: 300 }),
        confirmButtonText: $tr('chat.rename.dialog.button.text'),
        onConfirm: async value => {
          const { oldName, newName } = value as { oldName: string, newName: string };
          if (newName !== oldName) {
            await renameChat(chat.value, newName);
          }
        },
      },
    });
  }

  async function closeChat() {
    resetCurrentChat();
    await goToChats();
  }

  function runChatDeleting() {
    dialog.$openDialog<typeof ConfirmationDialog>({
      component: ConfirmationDialog,
      componentProps: {
        dialogText: $tr('chat.delete.dialog.text', { chatName: chat.value.name }),
      },
      dialogProps: {
        title: $tr('chat.delete.dialog.title'),
        ...(isMobileMode && { width: 300 }),
        confirmButtonText: capitalize($tr('chat.delete.dialog.button')),
        confirmButtonColor: 'var(--color-text-button-secondary-default)',
        confirmButtonBackground: 'var(--color-bg-button-secondary-default)',
        cancelButtonColor: 'var(--color-text-button-primary-default)',
        cancelButtonBackground: 'var(--color-bg-button-primary-default)',
        onConfirm: async () => {
          await deleteChat(chat.value, false);
          if (areChatIdsEqual(currentChatId.value, chat.value)) {
            resetCurrentChat();
            await goToChats();
          }
          await refreshChatList();
        },
      },
    });
  }

  const actionsHandlers: ChatActionHandlers = {
    history: {
      export: runChatHistoryExporting,
      clean: runChatHistoryCleaning,
    },
    chat: {
      info: openChatInfoDialog,
      rename: runChatRenaming,
      close: closeChat,
      delete: runChatDeleting,
      leave: runChatDeleting,
    },
  };

  async function selectAction(compositeAction: string) {
    const [entity, action] = compositeAction.split(':');
    // @ts-expect-error
    const handler: () => Promise<void> | void = actionsHandlers[entity]?.[action];
    if (handler) {
      await handler();
    } else {
      throw new Error(`No handler found for action ${action} on entity ${entity}`);
    }
  }

  onBeforeUnmount(() => {
    timer.value && clearInterval(timer.value);
    timer.value = undefined;
  });

  watch(
    [() => chat.value.chatId, () => chatWithCall.value],
    ([newChatId, newFlagVal], [oldChatId, oldFlagVal]) => {
      if (
        (newChatId === oldChatId && newFlagVal !== oldFlagVal)
        || (newChatId !== oldChatId && newFlagVal !== oldFlagVal)
        || (newChatId !== oldChatId && newFlagVal === oldFlagVal)
      ) {
        if (newFlagVal) {
          timer.value && clearInterval(timer.value);
          timer.value = setInterval(() => {
            callDuration.value = calculateCallDuration();
          }, 2000);
        } else {
          timer.value && clearInterval(timer.value);
          timer.value = undefined;
        }
      }
    }, {
      immediate: true,
    },
  );

  return {
    text,
    isGroupChat,
    currentChatObjId,
    isIncomingCall,
    chatWithCall,
    callDuration,
    selectAction,
    joinIncomingCall,
    dismissIncomingCall,
    startCall,
    endCall,
  };
}
