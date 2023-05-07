/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../../@types/chat.d.ts" />

function getErrorText(address: string, error: web3n.asmail.ASMailSendException): string {
  const { unknownRecipient, inboxIsFull, msgCancelled } = error
  if (unknownRecipient) {
    return `Unknown recipient ${address}!`
  }

  if (inboxIsFull) {
    return `Mailbox of ${address} is full!`
  }

  if (msgCancelled) {
    return 'Canceled. Internal error.'
  }

  return 'Unknown error.'
}

export function checkSendingErrors(status: web3n.asmail.DeliveryProgress): Record<string, SendingError> {
  const { recipients } = status
  return Object.keys(recipients).reduce((res, mail: string) => {
    const { err } = recipients[mail]
    if (err) {
      res[mail] = {
        mail,
        text: getErrorText(mail, err),
      }
    }

    return res
  }, {} as Record<string, SendingError>)
}

export function prepareMessageDeliveryInfo(
  msgId: string, status: web3n.asmail.DeliveryProgress | undefined,
): MessageDeliveryInfo | undefined {
  if (!status) {
    return undefined
  }

  if (status.allDone) {
    return {
      msgId,
      status: 'sent',
      value: 100,
    }
  }

  const { recipients, msgSize } = status
  const hasError = Object.keys(recipients).every(address => !!recipients[address].err)
  if (hasError) {
    const errors = checkSendingErrors(status)
    const isCanceled = Object.values(errors).every(error => error.text.includes('Canceled'))
    return {
      msgId,
      status: isCanceled ? 'canceled' : 'error',
      value: isCanceled ? 'canceled' : Object.values(errors).map(err => err.text).join(' '),
    }
  }

  const currentSentSize = Object.keys(recipients).reduce((res, mail) => {
    const { bytesSent = 0 } = recipients[mail]
    res += bytesSent
    return res
  }, 0)

  return {
    msgId,
    status: 'sending',
    value: currentSentSize / (Object.keys(recipients).length * msgSize),
  }
}
