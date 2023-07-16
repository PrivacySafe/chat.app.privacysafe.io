import { appStore } from '@/store/app'
import { AppStore } from '@/store/app/types'
import { contactsStore } from '@/store/contacts'
import { ContactsStore } from '@/store/contacts/types'
import { chatsStore } from '@/store/chats'
import { ChatsStore } from '@/store/chats/types'

export const useAppStore: () => AppStore = () => appStore()
export const useContactsStore: () => ContactsStore = () => contactsStore()
export const useChatsStore: () => ChatsStore = () => chatsStore()
