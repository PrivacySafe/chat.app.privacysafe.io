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

import { type ContactsStore, useContactsStore } from '@main/common/store/contacts.store.ts';
import { itCond, rejectionOf, skipSpecIfUnresponsive } from '../libs-for-tests/jasmine-utils.js';
import { stringifyErr } from '../lib-common/exceptions/error.js';
import { includesAddress } from '@shared/address-utils.js';
import { TestSetupContainer } from '@tests/setups.js';
import { ContactsException } from '~/contact.types.js';

declare const w3n: web3n.testing.CommonW3N;

function isAddressIn(contactsStore: ContactsStore, addr: string): boolean {
  const lst = contactsStore.contactList.map(({ mail }) => mail);
  return includesAddress(lst, addr);
}

describe(`Contacts store`, () => {
  let contactsStore: ContactsStore;
  let fstUserAddr: string;
  let sndUserAddr: string;

  // The timeout is explicit because this is the first thing in the run that
  // touches the contacts app, and that app is slow to come up: it exposes its
  // service only after its storage, database and a first synchronization with
  // the server. Jasmine's default of 5 s is a measure of nothing here.
  beforeAll(async () => {
    ({ fstUserAddr, sndUserAddr } = (window as unknown as TestSetupContainer).testSetup);
    contactsStore = useContactsStore();
    await contactsStore.initialize();
  }, 60000);

  // Adding a contact verifies the address over ASMail. Without connectivity that
  // call neither fails nor returns, so every addContact() below goes through
  // skipSpecIfUnresponsive: an unreachable server then skips the spec with a
  // reason, instead of it dying on jasmine's own timeout, which names no cause.
  // Spec timeouts are raised past ADDRESS_CHECK_WAIT_MILLIS so that the skip is
  // what happens first.
  const ASMAIL_CHECK = `the ASMail server that verifying a contact's address needs`;
  const ADDRESS_CHECK_WAIT_MILLIS = 10000;
  const SPEC_TIMEOUT_MILLIS = 25000;

  itCond(`lists and adds addresses`, async () => {
    expect(isAddressIn(contactsStore, fstUserAddr)).withContext(`own address is present by default`).toBeTrue();

    if (!isAddressIn(contactsStore, sndUserAddr)) {
      await skipSpecIfUnresponsive(
        ASMAIL_CHECK, ADDRESS_CHECK_WAIT_MILLIS, () => contactsStore.addContact(sndUserAddr),
      );
      expect(isAddressIn(contactsStore, sndUserAddr)).withContext(`address is present after addition`).toBeTrue();
    }

    // second adding of existing address should fail
    const exc = await rejectionOf(skipSpecIfUnresponsive(
      ASMAIL_CHECK, ADDRESS_CHECK_WAIT_MILLIS, () => contactsStore.addContact(sndUserAddr),
    )) as ContactsException|undefined;
    if (!exc) {
      fail(`adding account second time should fail`);
      return;
    }
    w3n.testStand.log('info', `addContact('${sndUserAddr}') rejected with: ${stringifyErr(exc)}`);
    expect(exc.type).withContext(`addContact('${sndUserAddr}') rejected with: ${stringifyErr(exc)}`).toBe('contacts');
    expect(exc.contactAlreadyExists).toBeTrue();
  }, SPEC_TIMEOUT_MILLIS);

  itCond(`adding non-existing address should fail`, async () => {
    const nonexistingAddr = `non-existing user @example.com`;
    // `failASMailCheck` is a verdict from the server; with no connectivity there
    // is no verdict to wait for, only silence.
    const exc = await rejectionOf(skipSpecIfUnresponsive(
      ASMAIL_CHECK, ADDRESS_CHECK_WAIT_MILLIS, () => contactsStore.addContact(nonexistingAddr),
    )) as ContactsException|undefined;
    if (!exc) {
      fail(`adding non-existing address should've failed`);
      return;
    }
    w3n.testStand.log('info', `addContact('${nonexistingAddr}') rejected with: ${stringifyErr(exc)}`);
    expect(exc.type).withContext(`addContact('${nonexistingAddr}') rejected with: ${stringifyErr(exc)}`).toBe('contacts');
    expect(exc.failASMailCheck).toBeTrue();
  }, SPEC_TIMEOUT_MILLIS);
});
