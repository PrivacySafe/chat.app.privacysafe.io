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
import { appContactsSrv } from '@main/store/external-services';
import { ref } from 'vue';
import { toRO } from '@main/utils/readonly';
import { areAddressesEqual } from '@shared/address-utils';
import { ensureASMailAddressExists, makeContactsException } from './contacts/contact-checks';

export const useContactsStore = defineStore('contacts', () => {

  const contactList = ref<(PersonView & { displayName: string })[]>([]);

  async function fetchContacts() {
    try {
      contactList.value = (await appContactsSrv.getContactList())
      .map(contact => ({
        ...contact,
        displayName: contact.name || contact.mail || ' ',
      }))
      .sort((a, b) => (a.displayName > b.displayName ? 1 : -1));  
    } catch (e) {
      console.error(e);
    }
    return contactList.value;
  }

  async function addContact(mail: string): Promise<void> {
    const known = await appContactsSrv.isThereContactWithTheMail(mail);
    if (known) {
      throw makeContactsException({ contactAlreadyExists: true });
    }
    await ensureASMailAddressExists(mail);
    const person: Person = {
      id: 'new',
      name: '',
      mail,
      notice: '',
      phone: '',
    };
    await appContactsSrv.upsertContact(person);
    await fetchContacts();
  }

  function getContactName(mail: string): string {
    const contact = contactList.value.find(
      c => areAddressesEqual(c.mail, mail)
    );
    return contact ? contact.displayName : mail;
  }

  return {
    contactList: toRO(contactList),

    initialize: fetchContacts,
    fetchContacts,
    addContact,

    getContactName
  };
});

export type ContactsStore = ReturnType<typeof useContactsStore>;
