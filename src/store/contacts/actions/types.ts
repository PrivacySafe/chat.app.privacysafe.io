import { PiniaActionTree } from '@/store/types'
import { ContactsStore } from '../types'

export type Actions = {
  fetchContactList(): Promise<Array<PersonView & { displayName: string }>>;
  addContact(mail: string): Promise<void>;
}

export type ContactsActions = PiniaActionTree<Actions, ContactsStore>
