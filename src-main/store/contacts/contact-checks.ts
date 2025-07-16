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

import { toCanonicalAddress } from "@shared/address-utils";
import { ContactsException } from "~/contact.types";


type ASMailSendException = web3n.asmail.ASMailSendException;
type ServLocException = web3n.asmail.ServLocException;
type ConnectException = web3n.ConnectException;

export type AddressCheckResult =
  'found'
  | 'found-but-access-restricted'
  | 'not-present-at-domain'
  | 'no-service-for-domain';

export async function checkAddressExistenceForASMail(
  addr: string,
): Promise<AddressCheckResult> {
  try {
    toCanonicalAddress(addr);
    await w3n.mail!.delivery.preFlight(addr);
    return 'found';
  } catch (err) {
    if ((err as ASMailSendException).type === 'asmail-delivery') {
      const exc = err as ASMailSendException;
      if (exc.unknownRecipient) {
        return 'not-present-at-domain';
      } else if (exc.inboxIsFull) {
        return 'found';
      } else if (exc.senderNotAllowed) {
        return 'found-but-access-restricted';
      } else {
        throw exc;
      }
    } else if ((err as ConnectException).type === 'http-connect') {
      throw err;
    } else if ((err as ServLocException).type === 'service-locating') {
      return 'no-service-for-domain';
    } else {
      throw err;
    }
  }
}

export async function ensureASMailAddressExists(addr: string): Promise<void> {
  const check = await checkAddressExistenceForASMail(addr);
  if (check !== 'found') {
    throw makeContactsException({ failASMailCheck: true });
  }
}

export function makeContactsException(
  opts: Partial<ContactsException>,
): ContactsException {
  return {
    runtimeException: true,
    type: 'contacts',
    ...opts,
  };
}
