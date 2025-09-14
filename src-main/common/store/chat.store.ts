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
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { includesAddress, toCanonicalAddress } from '@shared/address-utils';
import { areChatIdsEqual } from '@shared/chat-ids';
import { chatService } from '@main/common/services/external-services';
import { toRO } from '@main/common/utils/readonly';
import { prepareCheckAddrErrorText } from '@main/common/utils/chats.helper';
import { useAppStore } from '@main/common/store/app.store';
import { useChatsStore } from '@main/common/store/chats.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import type { ChatListItemView, GroupChatView } from '~/chat.types';
import type { ChatIdObj, RelatedMessage  } from '~/index';

export const useChatStore = defineStore('chat', () => {
  const appStore = useAppStore();
  const chatsStore = useChatsStore();

  const currentChatId = ref<ChatIdObj>();

  const currentChat = computed(() => currentChatId.value ? chatsStore.getChatView(currentChatId.value) : null);

  const isAdminOfGroupChat = computed(() => {
    const chat = currentChat.value;
    return ((chat && chat.isGroupChat) ? chat.admins.includes(appStore.user) : false);
  });

  function isMemberAdminOfGroupChat(user: string): boolean {
    return !!(currentChat.value?.isGroupChat && (currentChat.value?.admins || []).includes(user));
  }

  async function setChatAndFetchMessages(chatId: ChatIdObj) {
    if (currentChatId.value?.chatId === chatId.chatId) {
      return;
    }

    if (!chatsStore.getChatView(chatId)) {
      await chatsStore.refreshChatList();
      if (!chatsStore.getChatView(chatId)) {
        throw new Error(`Chat is not found with id ${JSON.stringify(chatId)}`);
      }
    }

    currentChatId.value = chatId;
    const messagesStore = useMessagesStore();
    await messagesStore.fetchMessages();
  }

  function resetCurrentChat(): void {
    const messagesStore = useMessagesStore();
    currentChatId.value = undefined;
    messagesStore.setCurrentChatMessages([]);
  }

  function ensureCurrentChatIsSet(expectedChatId?: ChatIdObj): void {
    let sure = false;
    if (currentChatId.value) {
      sure = expectedChatId ? areChatIdsEqual(currentChatId.value, expectedChatId) : true;
    }

    if (!sure) {
      throw new Error(`Chat referenced by it ${expectedChatId} is not set current in store`);
    }
  }

  async function ensureAllAddressesExist(members: string[]): Promise<boolean> {
    const checks = await Promise.all(members.map(async addr => {
      const { check, exc }= await chatService.checkAddressExistenceForASMail(addr)
        .then(
          check => ({ check, exc: undefined }),
          exc => ({ check: undefined, exc }),
        );
      return { addr, check, exc };
    }));

    const failedAddresses = checks.filter(({ check }) => (check !== 'found'));

    if (failedAddresses.length > 0) {
      // throw makeChatException({ failedAddresses });
      let errorText = `${appStore.$i18n.tr('chat.members.update.error')}.`
      for (const item of failedAddresses) {
        const { addr, check } = item;
        const text = prepareCheckAddrErrorText(addr, check!, appStore.$i18n.tr);
        errorText += ` ${text}.`;
      }
      appStore.$createNotice({
        type: 'error',
        content: errorText,
        duration: 5000,
      });
      return false;
    }

    return true;
  }

  async function sendMessageInChat(
    { chatId, text, files, relatedMessage, withoutCurrentChatCheck }: {
      chatId: ChatIdObj,
      text: string,
      files: web3n.files.ReadonlyFile[] | undefined,
      relatedMessage: RelatedMessage | undefined,
      withoutCurrentChatCheck?: boolean,
    }) {
    !withoutCurrentChatCheck && ensureCurrentChatIsSet(chatId);

    await chatService.sendRegularMessage(chatId, text, files ?? [], relatedMessage);
    appStore.$emitter.emit('send:message', { chatId });
  }

  async function renameChat(
    chat: ChatListItemView, newChatName: string,
  ): Promise<void> {
    const chatId = { isGroupChat: chat.isGroupChat, chatId: chat.chatId };
    ensureCurrentChatIsSet(chatId);
    await chatService.renameChat(chatId, newChatName);
  }

  async function deleteChat(chatId: ChatIdObj, withReset?: boolean): Promise<void> {
    ensureCurrentChatIsSet(chatId);
    withReset && resetCurrentChat();
    await chatService.deleteChat(chatId);
  }

  async function updateGroupMembers(
    chatId: string,
    newMembers: Record<string, { hasAccepted: boolean }>,
  ): Promise<boolean> {
    const chatIdObj = { isGroupChat: true, chatId };
    ensureCurrentChatIsSet(chatIdObj);

    if (!includesAddress(Object.keys(newMembers), appStore.user)) {
      throw new Error(`This function can't remove self from members. Own address should be among new members.`);
    }

    const { members } = (currentChat.value as GroupChatView);
    const membersToDelete = Object.keys(members).reduce((res, addr) => {
      if (!includesAddress(Object.keys(newMembers), addr)) {
        res[addr] = members[addr];
      }

      return res;
    }, {} as Record<string, { hasAccepted: boolean }>);

    const membersUntouched = Object.keys(members).reduce((res, addr) => {
      if (!includesAddress(Object.keys(membersToDelete), addr)) {
        res[addr] = members[addr];
      }

      return res;
    }, {} as Record<string, { hasAccepted: boolean }>);

    const membersToAdd = Object.keys(newMembers).reduce((res, addr) => {
      if (!includesAddress(Object.keys(members), addr)) {
        res[addr] = newMembers[addr];
      }

      return res;
    }, {} as Record<string, { hasAccepted: boolean }>);

    const checkResult = await ensureAllAddressesExist(Object.keys(membersToAdd).filter(
      member => (toCanonicalAddress(member) !== toCanonicalAddress(appStore.user)),
    ));
    if (!checkResult) {
      return false;
    }

    if (Object.keys(membersToDelete).length === 0 && Object.keys(membersToAdd).length === 0) {
      return false;
    }
    const membersAfterUpdate = { ...membersUntouched, ...membersToAdd };

    await chatService.updateGroupMembers(
      chatIdObj,
      { membersToDelete, membersToAdd, membersAfterUpdate },
    );
    return true;
  }

  async function updateGroupAdmins(chatId: string, newAdmins: string[] = []): Promise<void> {
    const chatIdObj = { isGroupChat: true, chatId };
    ensureCurrentChatIsSet(chatIdObj);

    const { admins = [] } = (currentChat.value as GroupChatView);
    const adminsToDelete = admins.reduce((res, addr) => {
      if (!includesAddress(newAdmins, addr)) {
        res.push(addr);
      }

      return res;
    }, [] as string[]);

    const adminsUntouched = admins.reduce((res, addr) => {
      if (!includesAddress(adminsToDelete, addr)) {
        res.push(addr);
      }

      return res;
    }, [] as string[]);

    const adminsToAdd = newAdmins.reduce((res, addr) => {
      if (!includesAddress(admins, addr)) {
        res.push(addr);
      }

      return res;
    }, [] as string[]);

    if (adminsToDelete.length === 0 && adminsToAdd.length === 0) {
      return;
    }

    const adminsAfterUpdate = [...adminsUntouched, ...adminsToAdd];
    await chatService.updateGroupAdmins(
      chatIdObj,
      { adminsToDelete, adminsToAdd, adminsAfterUpdate },
    );
  }

  return {
    currentChatId: toRO(currentChatId),
    currentChat,
    isAdminOfGroupChat,
    isMemberAdminOfGroupChat,
    ensureCurrentChatIsSet,
    setChatAndFetchMessages,
    resetCurrentChat,
    sendMessageInChat,
    renameChat,
    deleteChat,
    updateGroupMembers,
    updateGroupAdmins,
  };
});

export type ChatStore = ReturnType<typeof useChatStore>;
