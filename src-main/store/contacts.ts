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
import { Person, PersonView } from '~/contact.types';
import { appContactsSrvProxy } from '@main/services/services-provider';
import { getRandomId } from '@v1nt1248/3nclient-lib/utils';

export interface ContactsStoreState {
  contactList: Array<PersonView & { displayName: string }>;
}

export const useContactsStore = defineStore('contacts', {

  state: () => ({
    contactList: [],
  } as ContactsStoreState),

  actions: {

    async fetchContactList() {
      try {
        this.contactList = (await appContactsSrvProxy.getContactList())
        .map(contact => ({
          ...contact,
          displayName: contact.name || contact.mail || ' ',
        }))
        .sort((a, b) => (a.displayName > b.displayName ? 1 : -1));  
      } catch (e) {
        console.error(e);
      }
      return this.contactList;
    },

    async addContact(mail: string): Promise<void> {
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

  }

});

export type ContactsStore = ReturnType<typeof useContactsStore>;
