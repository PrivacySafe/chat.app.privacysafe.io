import { get } from 'lodash';
import { getRandomId } from '@v1nt1248/3nclient-lib/utils';
import type { ContactsActions } from './types';
import { appContactsSrvProxy } from '@main/services/services-provider';
import type { PersonView, Person } from '~/index';

export const actions: ContactsActions = {
  async fetchContactList(): Promise<Array<PersonView & { displayName: string }>> {
    let contactList: PersonView[] | undefined;
    try {
      contactList = await appContactsSrvProxy.getContactList();
    } catch (e) {
      console.error(e);
    }

    this.contactList = contactList!
      .map(contact => ({
        ...contact,
        displayName: get(contact, 'name') || get(contact, 'mail') || ' ',
      }))
      .sort((a, b) => (a.displayName > b.displayName ? 1 : -1));

    return this.contactList;
  },

  async addContact(this, mail: string): Promise<void> {
    const person: Person = {
      id: getRandomId(6),
      name: '',
      mail,
      notice: '',
      phone: '',
    };
    await appContactsSrvProxy.upsertContact(person);
    await this.fetchContactList();
  },
};
