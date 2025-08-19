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
import { defineStore, storeToRefs } from 'pinia';
import keyBy from 'lodash/keyBy';
import { chatService, fileLinkStoreSrv } from '@main/common/services/external-services';
import { useChatsStore } from '@main/common/store/chats.store';
import { useChatStore } from '@main/common/store/chat.store';
import { areChatIdsEqual } from '@shared/chat-ids';
import type {
  ChatIdObj,
  ChatMessageAttachmentsInfo,
  ChatMessageEvent,
  ChatMessageId,
  ChatMessageView,
  ReadonlyFile,
} from '~/index';
import type { DbRecordException } from '@bg/utils/exceptions.ts';

export const useMessagesStore = defineStore('messages', () => {
  const chatsStore = useChatsStore();
  const { refreshChatViewData, refreshChatList } = chatsStore;

  const chatStore = useChatStore();
  const { currentChatId } = storeToRefs(chatStore);
  const { ensureCurrentChatIsSet } = chatStore;

  const objOfCurrentChatMessages = ref<Record<string, ChatMessageView>>({});

  const currentChatMessages = computed(() =>
    Object.values(objOfCurrentChatMessages.value)
      .sort((a, b) => a.timestamp - b.timestamp),
  );

  function setCurrentChatMessages(messages: ChatMessageView[]) {
    objOfCurrentChatMessages.value = keyBy(messages, 'chatMessageId');
  }

  async function fetchMessages(): Promise<void> {
    if (!currentChatId.value) {
      setCurrentChatMessages([]);
      return;
    }

    setCurrentChatMessages(await chatService.getMessagesByChat(currentChatId.value));
  }

  function getMessageInCurrentChat(chatMsgId: string): ChatMessageView | undefined {
    if (!chatMsgId) {
      return;
    }
    return objOfCurrentChatMessages.value[chatMsgId];
  }

  async function deleteMessageInChat(chatMsgId: string, deleteForEveryone?: boolean): Promise<void> {
    const message = getMessageInCurrentChat(chatMsgId);
    if (!message) {
      return;
    }

    try {
      const { chatId, chatMessageId } = message;
      await chatService.deleteMessage({ chatId, chatMessageId }, !!deleteForEveryone);
      await refreshChatViewData(chatId);
    } catch (err) {
      if ((err as DbRecordException).chatNotFound) {
        await refreshChatList();
      } else {
        await fetchMessages();
      }
    }
  }

  async function deleteAllMessagesInChat(
    chatId: ChatIdObj, deleteForEveryone?: boolean,
  ): Promise<void> {
    ensureCurrentChatIsSet(chatId);
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
    if (areChatIdsEqual(currentChatId.value, msg.chatId)) {
      if (!objOfCurrentChatMessages.value[msg.chatMessageId]) {
        objOfCurrentChatMessages.value[msg.chatMessageId] = msg;
      }
    }
    await refreshChatViewData(msg.chatId);
  }

  async function handleUpdatedMsg(msg: ChatMessageView): Promise<void> {
    if (areChatIdsEqual(currentChatId.value, msg.chatId)) {
      objOfCurrentChatMessages.value[msg.chatMessageId] = msg;
    }
    await refreshChatViewData(msg.chatId);
  }

  async function handleRemovedMsg(msg: ChatMessageId): Promise<void> {
    if (areChatIdsEqual(currentChatId.value, msg.chatId)) {
      delete objOfCurrentChatMessages.value[msg.chatMessageId];
    }
    await refreshChatViewData(msg.chatId);
  }

  async function handleBackgroundMessageEvents(event: ChatMessageEvent) {
    console.log('### HANDLE BACKGROUND MESSAGE EVENTS ### ', event);
    switch (event.event) {
      case 'added':
        return handleAddedMsg(event.msg);
      case 'updated':
        return handleUpdatedMsg(event.msg);
      case 'removed':
        return handleRemovedMsg(event.msgId);
      default:
        console.log(`Unknown update event from ChatService:`, event);
        break;
    }
  }

  return {
    objOfCurrentChatMessages,
    currentChatMessages,
    setCurrentChatMessages,
    fetchMessages,
    getMessageInCurrentChat,
    deleteMessageInChat,
    deleteAllMessagesInChat,
    markMessageAsRead,
    getChatMessage,
    getMessageAttachments,
    handleBackgroundMessageEvents,
  };
});
