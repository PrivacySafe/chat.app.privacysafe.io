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

import { ContactsStore, useContactsStore } from '@main/common/store/contacts.store.ts';
import { itCond } from '../libs-for-tests/jasmine-utils.js';
import { includesAddress } from '@shared/address-utils.js';
import { TestSetupContainer } from '@tests/setups.js';
import { ContactsException } from '~/contact.types.js';

declare const w3n: web3n.testing.CommonW3N;

function isAddressIn(
  contactsStore: ContactsStore, addr: string
): boolean {
  const lst = contactsStore.contactList.map(({ mail }) => mail);
  return includesAddress(lst, addr);
}

describe(`contacts store`, () => {

  let contactsStore: ContactsStore;
  let fstUserAddr: string;
  let sndUserAddr: string;

  beforeAll(async () => {
    ({
      fstUserAddr, sndUserAddr
    } = (window as any as TestSetupContainer).testSetup);
    contactsStore = useContactsStore();
  });

  itCond(`lists and adds addresses`, async () => {
    expect(isAddressIn(contactsStore, fstUserAddr))
    .withContext(`own address is present by default`)
    .toBeTrue();

    if (!isAddressIn(contactsStore, sndUserAddr)) {
      await contactsStore.addContact(sndUserAddr);
      expect(isAddressIn(contactsStore, sndUserAddr))
      .withContext(`address is present after addition`)
      .toBeTrue();
    }

    // second adding of existing address should be fail
    await contactsStore.addContact(sndUserAddr).then(
      () => fail(`adding account second time should fail`),
      (exc: ContactsException) => {
        expect(exc.contactAlreadyExists).toBeTrue();
      }
    );

  });

  itCond(`adding non-existing address should fail`, async () => {
    const nonexistingAddr = `non-existing user @example.com`;
    await contactsStore.addContact(nonexistingAddr).then(
      () => fail(`adding non-existing address should've failed`),
      (exc: ContactsException) => {
        expect(exc.failASMailCheck).toBeTrue();
      }
    );
  });

});
