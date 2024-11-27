import type { PiniaActionTree } from '@v1nt1248/3nclient-lib/plugins';
import type { ContactsStore } from '../types';
import type { PersonView } from '~/index';

export type Actions = {
  fetchContactList(): Promise<Array<PersonView & { displayName: string }>>;
  addContact(mail: string): Promise<void>;
}

export type ContactsActions = PiniaActionTree<Actions, ContactsStore>;
