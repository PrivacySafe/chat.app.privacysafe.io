/*
 Copyright (C) 2020 - 2025 3NSoft Inc.

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

/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
  ASMailSendException,
  ServLocException,
  ConnectException,
  SendingError,
  MessageDeliveryInfo,
} from '../../types';
import type { AddressCheckResult } from '../../types/services.types.ts';

function getErrorText(address: string, error: any): string {
  const {
    domainNotFound,
    noServiceRecord,
    unknownRecipient,
    inboxIsFull,
    msgCancelled,
  } = error;

  if (domainNotFound) {
    return `Unknown domain in the address ${address}`;
  }

  if (noServiceRecord) {
    return `The address ${address} is not 3NWeb`;
  }

  if (unknownRecipient) {
    return `Unknown recipient ${address}.`;
  }

  if (inboxIsFull) {
    return `Mailbox of ${address} is full.`;
  }

  if (msgCancelled) {
    return 'Canceled. Internal error.';
  }

  return 'Unknown error.';
}

export function checkSendingErrors(status: web3n.asmail.DeliveryProgress): Record<string, SendingError> {
  const { recipients } = status;
  return Object.keys(recipients).reduce((res, mail: string) => {
    const { err } = recipients[mail];
    if (err) {
      res[mail] = {
        mail,
        text: getErrorText(mail, err),
      };
    }

    return res;
  }, {} as Record<string, SendingError>);
}

export function prepareMessageDeliveryInfo(
  msgId: string,
  status: web3n.asmail.DeliveryProgress | undefined,
): MessageDeliveryInfo | undefined {
  if (!status) {
    return undefined;
  }

  if (status.allDone) {
    return {
      msgId,
      status: 'sent',
      value: 100,
    };
  }

  // TODO this should produce more precise status values

  const { recipients, msgSize } = status;
  const hasError = Object.keys(recipients).every(address => !!recipients[address].err);
  if (hasError) {
    const errors = checkSendingErrors(status);
    const isCanceled = Object.values(errors).every(error => error.text.includes('Canceled'));
    return {
      msgId,
      status: isCanceled ? 'canceled' : 'error',
      value: isCanceled ? 'canceled' : Object.values(errors).map(err => err.text).join(' '),
    };
  }

  const currentSentSize = Object.keys(recipients).reduce((res, mail) => {
    const { bytesSent = 0 } = recipients[mail];
    res += bytesSent;
    return res;
  }, 0);

  return {
    msgId,
    status: 'sending',
    value: currentSentSize / (Object.keys(recipients).length * msgSize),
  };
}

export async function checkAddressExistenceForASMail(addr: string): Promise<AddressCheckResult> {
  try {
    await w3n.mail!.delivery.preFlight(addr);
    return 'found';
  } catch (err) {
    if ((err as ASMailSendException).type === 'asmail-delivery') {
      const exc = err as ASMailSendException;

      if (exc.unknownRecipient) {
        return 'not-present-at-domain';
      }

      if (exc.inboxIsFull) {
        return 'found';
      }

      if (exc.senderNotAllowed) {
        return 'found-but-access-restricted';
      }

      if (exc.recipientPubKeyFailsValidation) {
        return 'not-valid-public-key';
      }

      throw exc;
    }

    if ((err as ConnectException).type === 'connect') {
      throw err;
    }

    if ((err as ServLocException).type === 'service-locating') {
      return 'no-service-for-domain';
    }

    throw err;
  }
}

export async function ensureAllAddressesExist(members: Record<string, { hasAccepted: boolean }>): Promise<{
  status: 'success' | 'error';
  errorData?: {
    addr: string;
    check: AddressCheckResult | undefined;
    exc: any;
  }[];
}> {
  const checks = await Promise.all(Object.keys(members).map(async addr => {
    const { check, exc } = await checkAddressExistenceForASMail(addr).then(
      check => ({ check, exc: undefined }),
      exc => ({ check: undefined, exc }),
    );
    return { addr, check, exc };
  }));

  const failedAddresses = checks.filter(({ check }) => (check !== 'found'));

  return {
    status: failedAddresses.length ? 'error' : 'success',
    ...(failedAddresses.length && { errorData: failedAddresses }),
  };
}
