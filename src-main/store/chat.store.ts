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

import { defineStore, storeToRefs } from 'pinia';
import { computed, inject, ref } from 'vue';
import { useChatsStore } from './chats.store';
import { toRO } from '@main/utils/readonly';
import { ChatMessageView, ChatView, MessageType } from '~/chat.types';
import { appChatsSrv, appDeliverySrv } from '@main/services/services-provider';
import { areAddressesEqual, includesAddress } from '@shared/address-utils';
import { useAppStore } from './app.store';
import { sendSystemMessage } from './chats/send-system-message';
import { chatMessagesByType } from '@main/utils/chats.helper';
import { deleteChatMessage } from './chat/delete-message';
import { getRandomId } from '@v1nt1248/3nclient-lib/utils';
import { chatIdLength, msgIdLength } from '@main/constants';
import { sendChatMessage } from './chat/send-chat-message';
import { VUEBUS_KEY, VueBusPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { AppGlobalEvents } from '~/app.types';

export const useChatStore = defineStore('chat', () => {

  const { user } = storeToRefs(useAppStore());
  const chatsStore = useChatsStore();
  const { fetchChatList } = chatsStore;
  const { chatList } = storeToRefs(chatsStore);
  const $emitter = inject<VueBusPlugin<AppGlobalEvents>>(VUEBUS_KEY)!.$emitter;

  const currentChatId = ref<string|null>(null);
  const currentChatMessages = ref<ChatMessageView<MessageType>[]>([]);

  const currentChat = computed(() => {
    if (currentChatId.value) {
      const chat = chatList.value[currentChatId.value];
      return (chat ? chat : null);
    }
    return null;
  });

  function getWritableCurrentChatMessageView(
    chatId: string, chatMessageId: string, msgId: string
  ): ChatMessageView<MessageType>|undefined {
    if (chatId === currentChatId.value) {
      return currentChatMessages.value.find(
        m => ((m.chatMessageId === chatMessageId) || (m.msgId === msgId))
      );
    }
  }

  function pushMsgIntoCurrentChatMessages(
    msgView: ChatMessageView<MessageType>
  ): void {
    if (currentChatId.value && (msgView.chatId === currentChatId.value)) {
      currentChatMessages.value.push(msgView);
    }
  }

  async function fetchChat(chatId: string | null) {
    if (!chatId) {
      currentChatId.value = null;
      currentChatMessages.value = [];
    } else {

      // XXX
      // - check if id is in the list, updating it and retrying only
      await fetchChatList();

      currentChatId.value = chatId;
      await fetchMessages();
    }
  }

  async function fetchMessages(): Promise<void> {
    currentChatMessages.value = (currentChatId.value ?
      await appChatsSrv.getMessagesByChat(currentChatId.value) :
      []
    );
  }

  function getMessage(
    chatMsgId: string
  ): ChatMessageView<MessageType>|undefined {
    if (!chatMsgId) {
      return;
    }
    const message = currentChatMessages.value.find(
      m => m.chatMessageId === chatMsgId
    );
    return message;
  }

  function ensureCurrentChatIsSet(chatId?: string): void {
    let sure = false;
    if (currentChatId.value) {
      sure = (chatId ? (currentChatId.value === chatId) : true);
    }
    if (!sure) {
      throw new Error(`Chat referenced by it ${chatId} is not set current in store`);
    }
  }

  function getChatPeers(): string[] {
    ensureCurrentChatIsSet();
    return currentChat.value!.members
    .filter(addr => !areAddressesEqual(addr, user.value));
  }

  async function deleteMessageInChat(
    chatMsgId: string, deleteForEveryone?: boolean
  ): Promise<void> {
    const message = getMessage(chatMsgId);
    if (!message) {
      return;
    }
    await deleteChatMessage(
      message, (deleteForEveryone ? getChatPeers() : undefined)
    );  
    await fetchMessages();
  }

  async function deleteAllMessagesInChat(chatId: string): Promise<void> {
    ensureCurrentChatIsSet(chatId);
    const {
      incomingMessages, outgoingMessages
    } = chatMessagesByType(currentChatMessages.value);
    await appChatsSrv.deleteMessagesInChat(chatId);
    await appDeliverySrv.removeMessageFromInbox(incomingMessages);
    await appDeliverySrv.removeMessageFromDeliveryList(outgoingMessages);
    if (chatId === currentChatId.value) {
      await fetchMessages();
    } else {
      await fetchChatList();
    }
  }

  async function sendMessageInChat(msg: {
    chatId: string, text: string,
    files?: web3n.files.ReadonlyFile[] | undefined,
    initialMessageId?: string
  }) {
    ensureCurrentChatIsSet(msg.chatId);
    const {
      name: chatName, admins: chatAdmins, members: chatMembers
    } = currentChat.value!;
    await sendChatMessage(
      user.value, {
        ...msg,
        chatId: msg.chatId,
        chatName,
        recipients: getChatPeers(),
        chatAdmins,
        chatMembers
      },
      async msgView => {
        await appChatsSrv.upsertMessage(msgView);
        currentChatMessages.value.push(msgView);
        $emitter.emit('send:message', { chatId: msgView.chatId });
        await chatsStore.fetchChatList();      
      }
    );
  }

  async function renameChat(
    chat: ChatView & { unread: number } & ChatMessageView<MessageType>,
    newChatName: string
  ): Promise<void> {
    ensureCurrentChatIsSet(chat.chatId);

    const updatedChat: ChatView = {
      chatId: chat.chatId,
      name: newChatName,
      members: chat.members,
      admins: chat.admins,
      createdAt: chat.createdAt,
    };
    await appChatsSrv.updateChat(updatedChat);
    chatsStore.chatList[chat.chatId].name = newChatName;
  
    const chatMessageId = getRandomId(chatIdLength);
    const msgId = await sendSystemMessage({
      chatId: chat.chatId,
      chatMessageId,
      recipients: getChatPeers()!,
      event: 'update:chatName',
      value: { name: newChatName },
      displayable: true,
    });
    const msgView: ChatMessageView<'outgoing'> = {
      msgId,
      attachments: [],
      messageType: 'outgoing',
      sender: user.value,
      body: 'rename.chat.system.message',
      chatId: chat.chatId,
      chatMessageType: 'system',
      chatMessageId,
      initialMessageId: null,
      timestamp: Date.now(),
      status: 'received',
    };
  
    await appChatsSrv.upsertMessage(msgView);
    if (chat.chatId === currentChatId.value) {
      currentChatMessages.value.push(msgView);
    }
  }

  async function leaveChat(chatId: string, isRemoved = false): Promise<void> {
    ensureCurrentChatIsSet(chatId);

    const messages = currentChatMessages.value;
    const { incomingMessages, outgoingMessages } = chatMessagesByType(messages);
    const recipients = getChatPeers();
    const ownAddr = user.value;

    await appChatsSrv.deleteChat(chatId);
    await appDeliverySrv.removeMessageFromInbox(incomingMessages);
    await appDeliverySrv.removeMessageFromDeliveryList(outgoingMessages);

    await fetchChat(null);

    sendSystemMessage({
      chatId,
      chatMessageId: getRandomId(msgIdLength),
      recipients,
      event: 'delete:members',
      value: {
        users: [ ownAddr ],
        isRemoved
      },
      displayable: true,
    });
  }

  async function deleteChat(chatId: string): Promise<void> {
    ensureCurrentChatIsSet(chatId);
  
    const messages = currentChatMessages.value;
    const { incomingMessages, outgoingMessages } = chatMessagesByType(messages);
  
    await appChatsSrv.deleteChat(chatId);
    await appDeliverySrv.removeMessageFromInbox(incomingMessages);
    await appDeliverySrv.removeMessageFromDeliveryList(outgoingMessages);

    await fetchChat(null);
  }

  async function updateMembers(chatId: string, users: string[]): Promise<void> {
    ensureCurrentChatIsSet(chatId);

    const me = user.value;
    const members = getChatPeers();
    const {
      name: chatName, admins: chatAdmins, createdAt: chatCreatedAt
    } = currentChat.value!;

    const membersToDelete = members.filter(
      addr => !includesAddress(users, addr)
    );
    const membersUntouched = members.filter(
      addr => !membersToDelete.includes(addr)
    );
    const membersToAdd = users.filter(addr => !includesAddress(members, addr));
    const updatedMembers = [...membersUntouched, ...membersToAdd];

    const updatedChat: ChatView = {
      chatId: chatId,
      name: chatName,
      members: updatedMembers,
      admins: chatAdmins,
      createdAt: chatCreatedAt,
    };

    await appChatsSrv.updateChat(updatedChat);
    chatList.value[chatId].members = updatedMembers;

    let msgViewOne: ChatMessageView<'outgoing'> | undefined;
    let msgViewTwo: ChatMessageView<'outgoing'> | undefined;
    const recipients = [...members, ...membersToAdd];

    if (membersToAdd.length > 0) {
      const chatMessageId = getRandomId(msgIdLength);
      const msgId = await sendSystemMessage({
        chatId,
        chatMessageId,
        recipients,
        event: 'add:members',
        value: { membersToAdd, updatedMembers },
        displayable: true,
      });
      msgViewOne = {
        msgId,
        attachments: [],
        messageType: 'outgoing',
        sender: me,
        body: `[${membersToAdd.join(', ')}]add.members.system.message`,
        chatId,
        chatMessageType: 'system',
        chatMessageId,
        initialMessageId: null,
        timestamp: Date.now(),
        status: 'received',
      };
    }

    if (membersToDelete.length > 0) {
      const chatMessageId = getRandomId(msgIdLength);
      const msgId = await sendSystemMessage({
        chatId,
        chatMessageId,
        recipients,
        event: 'remove:members',
        value: { membersToDelete, updatedMembers },
        displayable: true,
      });
      msgViewTwo = {
        msgId,
        attachments: [],
        messageType: 'outgoing',
        sender: me,
        body: `[${membersToDelete.join(', ')}]remove.members.system.message`,
        chatId,
        chatMessageType: 'system',
        chatMessageId,
        initialMessageId: null,
        timestamp: Date.now(),
        status: 'received',
      };
    }

    msgViewOne && await appChatsSrv.upsertMessage(msgViewOne);
    msgViewTwo && await appChatsSrv.upsertMessage(msgViewTwo);

    if (chatId === currentChatId.value) {
      msgViewOne && currentChatMessages.value.push(msgViewOne);
      msgViewTwo && currentChatMessages.value.push(msgViewTwo);
    }
  }

  return {
    currentChatId: toRO(currentChatId),
    currentChatMessages: toRO(currentChatMessages),

    currentChat,

    getWritableCurrentChatMessageView,

    pushMsgIntoCurrentChatMessages,

    fetchChat,
    deleteMessageInChat,
    deleteAllMessagesInChat,
    sendMessageInChat,

    renameChat,
    leaveChat,
    deleteChat,
    updateMembers
  };
});

export type ChatStore = ReturnType<typeof useChatStore>;
