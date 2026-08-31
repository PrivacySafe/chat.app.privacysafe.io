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

import { ref } from 'vue';
import { defineStore } from 'pinia';
import { contactsSrv } from '@main/common/services/external-services.ts';
import { areAddressesEqual } from '@shared/address-utils.ts';
import { ensureASMailAddressExists, makeContactsException } from '../utils/contact-checks.ts';
import type { Person, PersonView } from '~/contact.types.ts';
import { makeLogger } from '@shared/logger';

const log = makeLogger('ContactsStore');

export const useContactsStore = defineStore('contacts', () => {
  const contactList = ref<(PersonView & { displayName: string })[]>([]);

  async function fetchContacts() {
    try {
      contactList.value = (await (await contactsSrv()).getContactList())
        .map(contact => ({
          ...contact,
          displayName: contact.name || contact.mail || ' ',
        }))
        .sort((a, b) => (a.displayName > b.displayName ? 1 : -1));
    } catch (e) {
      log.error('Error contacts fetching. ', e);
    }
    return contactList.value;
  }

  async function addContact(mail: string): Promise<void> {
    const isThereSuchContact = !!(await (await contactsSrv()).getContactByMail(mail));
    if (isThereSuchContact) {
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
    // The contacts service RETURNS {errorType, errorMessage} instead of
    // throwing (e.g. 'exists') — discarding the result silently swallowed
    // those failures while the UI showed nothing.
    const result = await (await contactsSrv()).upsertContact(person);
    if (result && 'errorType' in result) {
      throw makeContactsException(
        result.errorType === 'exists'
          ? { contactAlreadyExists: true, message: result.errorMessage }
          : { invalidValue: true, message: result.errorMessage },
      );
    }
    await fetchContacts();
  }

  function getContactName(mail: string): string {
    const contact = contactList.value.find(c => areAddressesEqual(c.mail, mail));
    return contact ? contact.displayName : mail;
  }

  return {
    contactList,
    initialize: fetchContacts,
    fetchContacts,
    addContact,
    getContactName,
  };
});

export type ContactsStore = ReturnType<typeof useContactsStore>;
