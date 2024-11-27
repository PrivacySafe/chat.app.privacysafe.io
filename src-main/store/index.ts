import { appStore } from './app';
import type { AppStore } from './app/types';
import { contactsStore } from './contacts';
import type { ContactsStore } from './contacts/types';
import { chatsStore } from './chats';
import type { ChatsStore } from './chats/types';

export const useAppStore: () => AppStore = () => appStore();
export const useContactsStore: () => ContactsStore = () => contactsStore();
export const useChatsStore: () => ChatsStore = () => chatsStore();
