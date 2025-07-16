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

/* eslint-disable @typescript-eslint/triple-slash-reference, @typescript-eslint/no-explicit-any */
import { OutgoingMessageStatus } from '../../types/chat.types.ts';
import type { AddressCheckResult } from '../../types/services.types.ts';

export interface MessageDeliveryInfo {
  msgId: string;
  status: OutgoingMessageStatus;
  value: string | number;
}

export interface SendingMessageStatus {
  msgId?: string;
  status: web3n.asmail.DeliveryProgress | undefined;
  info: MessageDeliveryInfo | undefined;
}

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

export interface SendingError {
  mail: string;
  text: string;
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
  msgId: string, status: web3n.asmail.DeliveryProgress | undefined,
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

  // XXX this should produce more precise status values

  const { recipients, msgSize } = status;
  const hasError = Object.keys(recipients).every(address => !!recipients[address].err);
  if (hasError) {
    const errors = checkSendingErrors(status);
    const isCanceled = Object.values(errors).every(error => error.text.includes('Canceled'));
    return {
      msgId,
      status: isCanceled ? 'sent:canceled' : 'sent:all-failed',
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

type ASMailSendException = web3n.asmail.ASMailSendException;
type ServLocException = web3n.asmail.ServLocException;
type ConnectException = web3n.ConnectException;

export async function checkAddressExistenceForASMail(
  addr: string
): Promise<AddressCheckResult> {
  try {
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
