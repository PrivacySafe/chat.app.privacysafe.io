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

import { defineStore } from 'pinia';
import { computed, inject, ref } from 'vue';
import { useChatsStore } from './chats.store';
import { toRO } from '@main/utils/readonly';
import { ChatIdObj, ChatMessageId } from '~/asmail-msgs.types';
import { ChatListItemView, ChatMessageAttachmentsInfo, ChatMessageView, GroupChatView } from '~/chat.types';
import { chatService, fileLinkStoreSrv } from '@main/store/external-services';
import { includesAddress, toCanonicalAddress } from '@shared/address-utils';
import { VUEBUS_KEY, VueBusPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { AppGlobalEvents } from '~/app.types';
import { areChatIdsEqual } from '@shared/chat-ids';
import { RelatedMessage } from '~/asmail-msgs.types';
import { AddressCheckResult, ChatMessageEvent } from '~/services.types';
import { DbRecordException } from '@bg/utils/exceptions';
import { setTemplateIteratorKeyIn } from '@main/utils/template-iterator-keys';

type ReadonlyFile = web3n.files.ReadonlyFile;

export const useChatStore = defineStore('chat', () => {

  const chatsStore = useChatsStore();
  const { refreshChatList, getChatView } = chatsStore;
  const $emitter = inject<VueBusPlugin<AppGlobalEvents>>(VUEBUS_KEY)!.$emitter;

  const currentChatId = ref<ChatIdObj>();
  const currentChatMessages = ref<ChatMessageView[]>([]);

  const currentChat = computed(() => {
    if (currentChatId.value) {
      return getChatView(currentChatId.value);
    }
  });

  const isAdminOfGroupChat = computed(() => {
    const chat = currentChat.value;
    return ((chat && chat.isGroupChat) ? chat.admins.includes(ownAddr) : false);
  });

  async function absorbMessageUpdateEvent(
    event: ChatMessageEvent
  ): Promise<void> {
    if (event.event === 'added') {
      await handleAddedMsg(event.msg);
    } else if (event.event === 'updated') {
      await handleUpdatedMsg(event.msg);
    } else if (event.event === 'removed') {
      await handleRemovedMsg(event.msgId);
    } else {
      console.log(`Unknown update event from ChatService:`, event);
    }
  }

  async function handleAddedMsg(
    msg: ChatMessageView
  ): Promise<void> {
    const msgInd = findIndexOfMessageListOfCurrentChat(msg);
    if (msgInd === undefined) {
      // XXX
      console.warn(`Message added in chat that isn't current. Should we increase unread counter/flag in message's chat?`);
    } else if (msgInd < 0) {
      setTemplateIteratorKeyIn(msg, msg.chatMessageId);
      currentChatMessages.value.push(msg);
      // XXX
      console.warn(`do we want to scroll, or when to scroll when new messages is added`);
    } else {
      await fetchMessages();
    }
  }

  function findIndexOfMessageListOfCurrentChat({
    chatId, chatMessageId
  }: ChatMessageId): number|undefined {
    if (areChatIdsEqual(currentChatId.value, chatId)) {
      return currentChatMessages.value.findIndex(
        m => (m.chatMessageId === chatMessageId)
      );
    }
  }

  async function handleUpdatedMsg(
    msg: ChatMessageView
  ): Promise<void> {
      const msgInd = findIndexOfMessageListOfCurrentChat(msg);
      if ((msgInd !== undefined) && (msgInd >= 0)) {
        setTemplateIteratorKeyIn(msg, currentChatMessages.value[msgInd]);
        currentChatMessages.value[msgInd] = msg;
      } else {
        await fetchMessages();
      }
  }

  async function handleRemovedMsg(
    msgId: ChatMessageId
  ): Promise<void> {
    const msgInd = findIndexOfMessageListOfCurrentChat(msgId);
    if ((msgInd !== undefined) && (msgInd >= 0)) {
      currentChatMessages.value.splice(msgInd, 1);
      // XXX
      console.warn(`we may want to replace message item with placeholder "Message deleted" instead of unexpected removal of it from user's view`);
    } else {
      await fetchMessages();
    }
  }

  async function setChatAndFetchMessages(chatId: ChatIdObj) {
    if (currentChatId.value?.chatId === chatId.chatId) {
      return;
    }
    if (!getChatView(chatId)) {
      await refreshChatList();
      if (!getChatView(chatId)) {
        throw new Error(`Chat is not found with id ${JSON.stringify(chatId)}`);
      }
    }
    currentChatId.value = chatId;
    await fetchMessages();
  }

  function resetCurrentChat(): void {
    currentChatId.value = undefined;
    currentChatMessages.value = [];
  }

  async function fetchMessages(): Promise<void> {
    const lst = (currentChatId.value ?
      await chatService.getMessagesByChat(currentChatId.value) :
      []
    );
    for (const item of lst) {
      const initItem = currentChatMessages.value.find(
        m => (item.chatMessageId === m.chatMessageId)
      );
      setTemplateIteratorKeyIn(item, initItem ?? item.chatMessageId);
    }
    currentChatMessages.value = lst
  }

  function getMessageInCurrentChat(
    chatMsgId: string
  ): ChatMessageView|undefined {
    if (!chatMsgId) {
      return;
    }
    return currentChatMessages.value.find(
      m => m.chatMessageId === chatMsgId
    );
  }

  function ensureCurrentChatIsSet(expectedChatId?: ChatIdObj): void {
    let sure = false;
    if (currentChatId.value) {
      sure = (expectedChatId ?
        areChatIdsEqual(currentChatId.value, expectedChatId) :
        true
      );
    }
    if (!sure) {
      throw new Error(`Chat referenced by it ${expectedChatId} is not set current in store`);
    }
  }

  async function deleteMessageInChat(
    chatMsgId: string, deleteForEveryone?: boolean
  ): Promise<void> {
    const message = getMessageInCurrentChat(chatMsgId);
    if (message) {
      const { chatId, chatMessageId } = message;
      await chatService.deleteMessage(
        { chatId, chatMessageId }, !!deleteForEveryone
      ).catch(async (exc: DbRecordException) => {
        if (exc.chatNotFound) {
          await refreshChatList();
        } else {
          await fetchMessages();
        }
      }); 
    }
  }

  async function deleteAllMessagesInChat(
    chatId: ChatIdObj, deleteForEveryone?: boolean
  ): Promise<void> {
    ensureCurrentChatIsSet(chatId);
    await chatService.deleteMessagesInChat(chatId, !!deleteForEveryone);
  }

  async function sendMessageInChat(
    chatId: ChatIdObj, text: string,
    files: web3n.files.ReadonlyFile[] | undefined,
    relatedMessage: RelatedMessage | undefined
  ) {
    ensureCurrentChatIsSet(chatId);
    await chatService.sendRegularMessage(chatId, text, files, relatedMessage);
    $emitter.emit('send:message', { chatId });
  }

  async function renameChat(
    chat: ChatListItemView, newChatName: string
  ): Promise<void> {
    const chatId = { isGroupChat: chat.isGroupChat, chatId: chat.chatId };
    ensureCurrentChatIsSet(chatId);
    await chatService.renameChat(chatId, newChatName);
  }

  async function leaveChat(chatId: ChatIdObj): Promise<void> {
    ensureCurrentChatIsSet(chatId);
    resetCurrentChat();
    await chatService.leaveChat(chatId);
  }

  async function deleteChat(chatId: ChatIdObj): Promise<void> {
    ensureCurrentChatIsSet(chatId);
    resetCurrentChat();
    await chatService.deleteChat(chatId);
  }

  let ownAddr: string;
  let ownCAddr: string;

  async function updateGroupMembers(
    chatId: string, newMembers: string[]
  ): Promise<void> {
    const chatIdObj = { isGroupChat: true, chatId };
    ensureCurrentChatIsSet(chatIdObj);

    if (!includesAddress(newMembers, ownAddr)) {
      throw new Error(`This function can't remove self from members. Own address should be among new members.`);
    }

    const { members } = (currentChat.value as GroupChatView);
    const membersToDelete = members.filter(
      addr => !includesAddress(newMembers, addr)
    );
    const membersUntouched = members.filter(
      addr => !membersToDelete.includes(addr)
    );
    const membersToAdd = newMembers.filter(addr => !includesAddress(members, addr));

    await ensureAllAddressesExist(membersToAdd.filter(
      member => (toCanonicalAddress(member) !== ownCAddr)
    ));

    if ((membersToDelete.length === 0) && (membersToAdd.length === 0)) {
      return;
    }
    const membersAfterUpdate = [...membersUntouched, ...membersToAdd];

    await chatService.updateGroupMembers(
      chatIdObj,
      { membersToDelete, membersToAdd, membersAfterUpdate }
    );
  }

  async function ensureAllAddressesExist(members: string[]): Promise<void> {
    const checks = await Promise.all(members.map(async addr => {
      const {
        check, exc
      } = await chatService.checkAddressExistenceForASMail(addr).then(
        check => ({ check, exc: undefined }),
        exc => ({ check: undefined, exc })
      );
      return { addr, check, exc }
    }));
    const failedAddresses = checks.filter(({ check }) => (check !== 'found'));
    if (failedAddresses.length > 0) {
      throw makeChatException({ failedAddresses });
    }
  }

  async function updateGroupAdmins(
    chatId: string, newAdmins: string[]
  ): Promise<void> {

    // XXX

    throw new Error(`chatStore updateGroupAdmins() function is not implemented, yet`);

  }

  async function markMessageAsRead(
    chatId: ChatIdObj, chatMessageId: string
  ): Promise<void> {
    await chatService.markMessageAsReadNotifyingSender({
      chatId, chatMessageId
    });
  }

  async function getChatMessage(
    id: ChatMessageId
  ): Promise<ChatMessageView|undefined> {
    return await chatService.getMessage(id);
  }

  async function getMessageAttachments(
    info: ChatMessageAttachmentsInfo[], incomingMsgId?: string
  ): Promise<ReadonlyFile[]> {
    const files: ReadonlyFile[] = [];
    if (incomingMsgId) {
      const msg = await chatService.getIncomingMessage(incomingMsgId);
      if (msg && msg.attachments) {
        for (const { name } of info) {
          const file = await msg.attachments.readonlyFile(name);
          files.push(file);
        }
      }
    } else {
      for (const { id } of info) {
        if (id) {
          const file = await fileLinkStoreSrv.getFile(id);
          if (file) {
            files.push(file as ReadonlyFile);
          }
        }
      }
    }
    return files;
  }

  function initialize(userOwnAddr: string) {
    ownAddr = userOwnAddr;
    ownCAddr = toCanonicalAddress(ownAddr);
  }

  return {
    currentChatId: toRO(currentChatId),
    currentChatMessages: toRO(currentChatMessages),

    currentChat,
    isAdminOfGroupChat,

    absorbMessageUpdateEvent,

    setChatAndFetchMessages,
    resetCurrentChat,

    deleteAllMessagesInChat,

    sendMessageInChat,
    markMessageAsRead,
    getChatMessage,
    getMessageAttachments,
    deleteMessageInChat,

    renameChat,
    leaveChat,
    deleteChat,
    updateGroupMembers,
    updateGroupAdmins,

    initialize
  };
});

export type ChatStore = ReturnType<typeof useChatStore>;

export interface ChatException extends web3n.RuntimeException {
  type: 'chat';
  failedAddresses?: {
    addr: string;
    check?: AddressCheckResult;
    exc?: any;
  }[];
}

function makeChatException(fields: Partial<ChatException>): ChatException {
  return {
    ...fields,
    runtimeException: true,
    type: 'chat'
  };
}
