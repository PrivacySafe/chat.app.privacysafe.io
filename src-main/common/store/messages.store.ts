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
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import keyBy from 'lodash/keyBy';
import { chatService, fileLinkStoreSrv } from '@main/common/services/external-services';
import { useChatsStore } from '@main/common/store/chats.store';
import { useChatStore } from '@main/common/store/chat.store';
import { useUiOutgoingStore } from '@main/common/store/ui.outgoing.store';
import { areChatIdsEqual } from '@shared/chat-ids';
import {
  ChatIdObj,
  ChatMessageAttachmentsInfo,
  ChatMessageEvent,
  ChatMessageId,
  ChatMessageSendingProgressEvent,
  ChatMessageView,
  ReadonlyFile,
} from '~/index';
import type { DbRecordException } from '@bg/utils/exceptions.ts';

export const useMessagesStore = defineStore('messages', () => {
  const chatsStore = useChatsStore();
  const chatStore = useChatStore();
  const uiOutgoingStore = useUiOutgoingStore();

  const objOfCurrentChatMessages = ref<Record<string, ChatMessageView>>({});

  const currentChatMessages = computed(() =>
    Object.values(objOfCurrentChatMessages.value)
      .sort((a, b) => a.timestamp - b.timestamp),
  );

  function setCurrentChatMessages(messages: ChatMessageView[]) {
    objOfCurrentChatMessages.value = keyBy(messages, 'chatMessageId');
  }

  async function fetchMessages(): Promise<void> {
    if (!chatStore.currentChatId) {
      setCurrentChatMessages([]);
      return;
    }

    setCurrentChatMessages(await chatService.getMessagesByChat(chatStore.currentChatId));
  }

  function getMessageInCurrentChat(chatMsgId: string): ChatMessageView | undefined {
    if (!chatMsgId) {
      return;
    }
    return objOfCurrentChatMessages.value[chatMsgId];
  }

  function upsertMessageInCurrentChat(chatMsgId: string, data: Partial<ChatMessageView>) {
    const msg = getMessageInCurrentChat(chatMsgId);
    if (!msg) {
      objOfCurrentChatMessages.value[chatMsgId] = data as ChatMessageView;
      return;
    }

    // @ts-expect-error
    objOfCurrentChatMessages.value[chatMsgId] = {
      ...msg,
      ...data,
    };
  }

  async function deleteMessageInChat(chatMsgId: string, deleteForEveryone?: boolean): Promise<void> {
    const message = getMessageInCurrentChat(chatMsgId);
    if (!message) {
      return;
    }

    try {
      const { chatId, chatMessageId } = message;
      await chatService.deleteMessage({ chatId, chatMessageId }, !!deleteForEveryone);
      await chatsStore.refreshChatViewData(chatId);
    } catch (err) {
      if ((err as DbRecordException).chatNotFound) {
        await chatsStore.refreshChatList();
      } else {
        await fetchMessages();
      }
    }
  }

  async function deleteAllMessagesInChat(
    chatId: ChatIdObj, deleteForEveryone?: boolean,
  ): Promise<void> {
    chatStore.ensureCurrentChatIsSet(chatId);
    await chatService.deleteMessagesInChat(chatId, !!deleteForEveryone);
    await fetchMessages();
  }

  async function markMessageAsRead(chatId: ChatIdObj, chatMessageId: string): Promise<void> {
    await chatService.markMessageAsReadNotifyingSender({
      chatId, chatMessageId,
    });
  }

  async function getChatMessage(id: ChatMessageId): Promise<ChatMessageView | undefined> {
    return await chatService.getMessage(id);
  }

  async function getMessageAttachments(
    info: ChatMessageAttachmentsInfo[],
    incomingMsgId?: string,
  ): Promise<Record<string, ReadonlyFile>> {
    const files: Record<string, ReadonlyFile> = {};
    if (incomingMsgId) {
      const msg = await chatService.getIncomingMessage(incomingMsgId);

      if (msg && msg.attachments) {
        for (const { name } of info) {
          files[name] = await msg.attachments.readonlyFile(name);
        }
      }
    } else {
      for (const { id, name } of info) {
        if (id) {
          const file = await fileLinkStoreSrv.getFile(id);
          if (file) {
            files[name] = file;
          }
        }
      }
    }
    return files;
  }

  async function handleAddedMsg(msg: ChatMessageView): Promise<void> {
    if (areChatIdsEqual(chatStore.currentChatId, msg.chatId)) {
      if (!objOfCurrentChatMessages.value[msg.chatMessageId]) {
        upsertMessageInCurrentChat(msg.chatMessageId, msg);
      }
    }
    await chatsStore.refreshChatViewData(msg.chatId);
  }

  async function handleUpdatedMsg(msg: ChatMessageView): Promise<void> {
    if (areChatIdsEqual(chatStore.currentChatId, msg.chatId)) {
      upsertMessageInCurrentChat(msg.chatMessageId, msg);
    }
    await chatsStore.refreshChatViewData(msg.chatId);
  }

  async function handleRemovedMsg(msg: ChatMessageId): Promise<void> {
    if (areChatIdsEqual(chatStore.currentChatId, msg.chatId)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete objOfCurrentChatMessages.value[msg.chatMessageId];
    }
    await chatsStore.refreshChatViewData(msg.chatId);
  }

  async function handleBackgroundMessageEvents(event: ChatMessageEvent) {
    switch (event.event) {
      case 'added':
        return handleAddedMsg(event.msg);
      case 'updated':
        return handleUpdatedMsg(event.msg);
      case 'removed':
        return handleRemovedMsg(event.msgId);
      case 'sending-progress':
        uiOutgoingStore.updateSendingProgressesList(event as ChatMessageSendingProgressEvent);
        break;
      default:
        console.log(`Unknown update event from ChatService:`, event);
        break;
    }
  }

  return {
    objOfCurrentChatMessages,
    currentChatMessages,
    fetchMessages,
    setCurrentChatMessages,
    upsertMessageInCurrentChat,
    getMessageInCurrentChat,
    deleteMessageInChat,
    deleteAllMessagesInChat,
    markMessageAsRead,
    getChatMessage,
    getMessageAttachments,
    handleBackgroundMessageEvents,
    handleAddedMsg,
    handleUpdatedMsg,
    handleRemovedMsg,
  };
});
