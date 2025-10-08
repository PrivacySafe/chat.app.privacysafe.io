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
import { computed, inject, onBeforeMount, ref } from 'vue';
import { storeToRefs } from 'pinia';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import { NOTIFICATIONS_KEY } from '@v1nt1248/3nclient-lib/plugins'
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { includesAddress } from '@shared/address-utils';
import { AUTO_DELETE_MESSAGES_BY_ID } from '@shared/constants';
import type { GroupChatView, PersonView } from '~/index';
import type { ChatInfoDialogProps, ChatInfoDialogEmits } from './types';
import { useAppStore } from '@main/common/store/app.store';
import { useContactsStore } from '@main/common/store/contacts.store';
import { useChatStore } from '@main/common/store/chat.store';

export function useChatInfo(props: ChatInfoDialogProps, emits: ChatInfoDialogEmits) {
  const { $createNotice } = inject(NOTIFICATIONS_KEY)!;
  const { user: ownAddr } = storeToRefs(useAppStore());

  const contactsStore = useContactsStore();
  const { contactList } = storeToRefs(contactsStore);
  const { fetchContacts } = contactsStore;

  const { updateGroupMembers, updateGroupAdmins } = useChatStore();

  const editMembersMode = ref(false);
  const memberSearch = ref('');
  const userSearch = ref('');
  const initialSelectedUsers = ref<(PersonView & { displayName: string })[]>([]);
  const selectedUsers = ref<(PersonView & { displayName: string })[]>([]);
  const listItemMenuProps = ref<{
    open: boolean;
    canClose: boolean;
    listItem: Nullable<{ contactId: string; mail: string; isAdmin: boolean }>;
    listItemElId: Nullable<string>;
  }>({
    open: false,
    canClose: false,
    listItem: null,
    listItemElId: null,
  });

  const dialogWidth = computed(() => props.isMobileMode ? '300px' : '380px');

  const autoDeleteMessageInfo = computed(() => {
    const { settings } = props.chat;
    const autoDeleteMessagesSetting = (settings?.autoDeleteMessages || '0') as '0' | '1' | '2' | '3' | '4';
    return AUTO_DELETE_MESSAGES_BY_ID[autoDeleteMessagesSetting];
  });

  const allContacts = computed(() => {
    const value = cloneDeep(contactList.value);
    if (props.chat.isGroupChat) {
      for (const addr of Object.keys(props.chat.members)) {
        const isThereUser = value.find(c => c.mail === addr);

        if (!isThereUser) {
          value.push({
            id: addr,
            mail: addr,
            displayName: addr,
          });
        }
      }
    } else {
      const addr = props.chat.peerAddr.toLowerCase().trim();
      const isThereUser = value.find(c => c.mail === addr);
      if (!isThereUser) {
        value.push({
          id: addr,
          mail: addr,
          displayName: addr,
        });
      }
    }

    return value;
  });

  const members = computed<(PersonView & { displayName: string })[]>(() => {
    const addrsInChat = props.chat.isGroupChat
      ? Object.keys(props.chat.members)
      : [ownAddr.value, props.chat.peerAddr];

    return allContacts.value.filter(c => includesAddress(addrsInChat, c.mail));
  });

  const filteredMembers = computed(() => members.value
    .filter(m => m.displayName.toLowerCase().includes(memberSearch.value.toLowerCase())),
  );

  const nonDeletableUsers = computed(() => {
    const me = contactList.value.find(c => c.mail === ownAddr.value);
    return me
      ? [{
        ...me,
        displayName: 'Me',
      }]
      : [];
  });

  const addBtnDisable = computed(() => isEqual(
    initialSelectedUsers.value.slice().sort(),
    selectedUsers.value.slice().sort(),
  ));

  function isUserAdmin(addr: string): boolean {
    if (props.chat.isGroupChat) {
      return includesAddress(props.chat.admins, addr);
    }

    return addr === ownAddr.value;
  }

  function isUserPending(addr: string): boolean {
    if (props.chat.isGroupChat) {
      return !props.chat.members[addr].hasAccepted;
    }

    return addr !== ownAddr.value && props.chat.status !== 'on';
  }

  function closeDialog() {
    emits('close');
  }

  async function openEditMode() {
    await fetchContacts();
    editMembersMode.value = true;
    userSearch.value = memberSearch.value;
    selectedUsers.value = cloneDeep(members.value);
    initialSelectedUsers.value = cloneDeep(selectedUsers.value);
  }

  function back() {
    editMembersMode.value = false;
    userSearch.value = '';
  }

  function isContactSelected(contact: PersonView & { displayName: string }): boolean {
    const userIndex = selectedUsers.value.findIndex(u => u.mail === contact.mail);
    return userIndex !== -1;
  }

  function selectUsers(user: PersonView & { displayName: string }) {
    const userIndex = selectedUsers.value.findIndex(u => u.mail === user.mail);
    if (userIndex === -1) {
      selectedUsers.value.push(user);
    } else {
      selectedUsers.value.splice(userIndex, 1);
    }
  }

  function updateMembers() {
    const { members } = props.chat as GroupChatView;
    const updatedMembers = allContacts.value.reduce((res, c) => {
      const { mail } = c;
      if (isContactSelected(c)) {
        res[mail] = {
          hasAccepted: members[mail] ? members[mail].hasAccepted : false,
        };
      }
      return res;
    }, {} as Record<string, { hasAccepted: boolean }>);

    updateGroupMembers(props.chat.chatId, updatedMembers).then(canClose => {
      canClose && closeDialog();
    });
  }

  function openListItemMenu({ contactId, mail }: { contactId: string; mail: string }) {
    if (!props.chat.isGroupChat) {
      return;
    }

    if (!isUserAdmin(ownAddr.value)) {
      return;
    }

    if (props.chat.isGroupChat && !props.chat.members[mail].hasAccepted) {
      return;
    }

    if (props.chat.isGroupChat && mail === ownAddr.value && props.chat.admins.length === 1) {
      return;
    }

    const listItemMailParts = mail.split('@');
    const listItemElId = listItemMailParts && listItemMailParts[0]
      ? `item-${listItemMailParts[0]}`
      : null;
    listItemMenuProps.value.listItem = {
      contactId,
      mail,
      isAdmin: isUserAdmin(mail),
    };
    listItemMenuProps.value.listItemElId = listItemElId;
    listItemMenuProps.value.open = true;

    setTimeout(() => {
      listItemMenuProps.value.canClose = true;
    }, 500);
  }

  function closeListItemMenu() {
    if (!listItemMenuProps.value.canClose) {
      return;
    }

    listItemMenuProps.value = {
      open: false,
      canClose: false,
      listItem: null,
      listItemElId: null,
    };
  }

  function handleAction(
    { action, user }:
    { action: 'make:admin' | 'remove:admin', user: { contactId: string; mail: string } },
  ) {
    if (!props.chat.isGroupChat) {
      return;
    }

    const updatedAdmins = cloneDeep(props.chat.admins);
    const ind = updatedAdmins.indexOf(user.mail);

    switch (action) {
      case 'make:admin':
        if (ind > -1) {
          $createNotice({
            type: 'error',
            content: `The user ${user.mail} is already an admin in the chat ${props.chat.chatId}`,
          });
          return;
        }
        updatedAdmins.push(user.mail);
        break;
      case 'remove:admin':
        if (ind === -1) {
          $createNotice({
            type: 'error',
            content: `The user ${user.mail} is already removed from admins in the chat ${props.chat.chatId}`,
          });
          return;
        }

        if (updatedAdmins.length === 1) {
          $createNotice({
            type: 'error',
            content: `The user ${user.mail} is the only admin. We can't remove them from admins in the chat ${props.chat.chatId}`,
          });
          return;
        }

        updatedAdmins.splice(ind, 1);
        break;
      default:
        break;
    }

    updateGroupAdmins(props.chat.chatId, updatedAdmins);
    closeDialog();
  }

  onBeforeMount(async () => {
    await fetchContacts();
  });

  return {
    ownAddr,
    nonDeletableUsers,
    dialogWidth,
    userSearch,
    memberSearch,
    editMembersMode,
    listItemMenuProps,
    autoDeleteMessageInfo,
    members,
    filteredMembers,
    allContacts,
    addBtnDisable,
    selectedUsers,
    isUserAdmin,
    isUserPending,
    openEditMode,
    selectUsers,
    openListItemMenu,
    closeListItemMenu,
    back,
    updateMembers,
    handleAction,
    closeDialog,
  };
}
