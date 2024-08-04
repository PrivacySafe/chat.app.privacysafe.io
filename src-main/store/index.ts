import { appStore } from './app'
import { AppStore } from './app/types'
import { contactsStore } from './contacts'
import { ContactsStore } from './contacts/types'
import { chatsStore } from './chats'
import { ChatsStore } from './chats/types'

export const useAppStore: () => AppStore = () => appStore()
export const useContactsStore: () => ContactsStore = () => contactsStore()
export const useChatsStore: () => ChatsStore = () => chatsStore()
