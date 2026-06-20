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

/// <reference path="../../@types/platform-defs/injected-w3n.d.ts" />
/// <reference path="../../@types/platform-defs/test-stand.d.ts" />

import { generateOutgoingMsgId } from '../../shared-libs/chat-ids.ts';
import type {
  ChatIdObj,
  ChatInvitationMsgV1,
  ChatOutgoingMessage,
  ChatRegularMsgV1,
  ChatSyncMsgV1,
  ChatSystemMsgV1,
  LocalMetadataInDelivery,
  RelatedMessage,
} from '../../types/index.ts';

interface SendingMessageResult {
  sending: 'success' | 'error';
  errors: Record<string, Error | web3n.RuntimeException | web3n.asmail.DeliveryException>;
}

async function getSendingMsgResult(deliveryId: string): Promise<SendingMessageResult> {
  let isDone = false;
  const result: SendingMessageResult = {
    sending: 'success',
    errors: {},
  };

  return await new Promise<SendingMessageResult>(resolve => {
    w3n.mail!.delivery.observeDelivery(deliveryId, {
      next: progress => {
        if (isDone) {
          return;
        }

        if (progress.allDone) {
          isDone = true;

          if (progress.allDone === 'all-ok') {
            result.sending = 'success';
          } else if (progress.allDone === 'with-errors') {
            result.sending = 'error';
            Object.keys(progress.recipients).forEach(addr => {
              const { err } = progress.recipients[addr];
              if (err) {
                result.errors[addr] = err;
              }
            });
          }

          resolve(result);
        }
      },
      complete: () => {
        if (!isDone) {
          isDone = true;
          resolve(result);
        }
      },
      error: () => {
        if (!isDone) {
          isDone = true;
          resolve(result);
        }
      },
    });
  });
}

async function addMessageToDeliveryList(
  message: ChatOutgoingMessage,
  recipients: string[],
  localMeta: LocalMetadataInDelivery,
): Promise<string> {
  const deliveryId = generateOutgoingMsgId();

  try {
    await w3n.mail!.delivery.addMsg(recipients, message, deliveryId, {
      sendImmediately: !message.attachments,
      localMeta,
    });
    return deliveryId;
  } catch (err) {
    await w3n.log('error', `Fail to add system message to delivery`, err);
    throw new Error('Fail to add system message to delivery', { cause: err });
  }
}

export async function deleteSentMessage(deliveryId: string, deleteIfErrorSending?: boolean): Promise<void> {
  let isDone = false;
  let hasError = false;

  try {
    await new Promise<void>((resolve, reject) => {
      w3n.mail!.delivery.observeDelivery(deliveryId, {
        next: p => {
          if (isDone) {
            return;
          }

          if (p.allDone) {
            isDone = true;
            if (p.allDone === 'all-ok') {
              resolve();
            } else if (p.allDone === 'with-errors') {
              const errs = Object.keys(p.recipients).reduce((res, peerAddr) => {
                const { err } = p.recipients[peerAddr];

                if (err) {
                  res.push(err);
                }
                return res;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              }, [] as any[]);

              reject(errs);
            }
          }
        },
        complete: () => {
          if (!isDone) {
            isDone = true;
            resolve();
          }
        },
        error: err => {
          if (!isDone) {
            isDone = true;
            hasError = true;
            reject(err);
          }
        },
      });
    });
  } finally {
    if (!deleteIfErrorSending || (deleteIfErrorSending && hasError)) {
      w3n.mail!.delivery.rmMsg(deliveryId).catch(err => w3n.log('error', JSON.stringify(err), err));
    }
  }
}

export async function sendSystemMessage({
  chatId,
  recipients,
  chatMessageId,
  chatSystemData,
}: {
  chatId: ChatIdObj;
  recipients: string[];
} & Pick<ChatSystemMsgV1, 'chatMessageId' | 'chatSystemData'>): Promise<string> {
  const jsonBody: ChatSystemMsgV1 = {
    v: 1,
    chatMessageType: 'system',
    groupChatId: chatId.isGroupChat ? chatId.chatId : undefined,
    chatMessageId,
    chatSystemData,
  };
  const outMsg: ChatOutgoingMessage = {
    msgType: 'chat',
    jsonBody,
  };
  const deliveryMetadata: LocalMetadataInDelivery = {
    chatId,
    chatMessageType: 'system',
    chatSystemData,
  };

  return await addMessageToDeliveryList(outMsg, recipients, deliveryMetadata);
}

export async function sendSystemDeletableMessage({
  chatId,
  recipients,
  chatMessageId,
  chatSystemData,
}: {
  chatId: ChatIdObj;
  recipients: string[];
} & Pick<ChatSystemMsgV1, 'chatMessageId' | 'chatSystemData'>): Promise<void> {
  const deliveryId = await sendSystemMessage({
    chatId,
    recipients,
    chatMessageId,
    chatSystemData,
  });

  await deleteSentMessage(deliveryId);
}

export async function sendChatInvitation(
  chatId: ChatIdObj,
  recipients: string[],
  invitationMsgData: Pick<ChatInvitationMsgV1, 'chatMessageId' | 'inviteData'>,
): Promise<void> {
  const { chatMessageId, inviteData } = invitationMsgData;
  const jsonBody: ChatInvitationMsgV1 = {
    v: 1,
    chatMessageType: 'invitation',
    chatMessageId,
    inviteData,
  };
  const outMsg: ChatOutgoingMessage = {
    msgType: 'chat',
    jsonBody,
  };
  const deliveryMetadata: LocalMetadataInDelivery = {
    chatId,
    chatMessageType: 'invitation',
  };

  const deliveryId = await addMessageToDeliveryList(outMsg, recipients, deliveryMetadata);
  await deleteSentMessage(deliveryId);
}

export async function sendSysMsgsAboutRemovalFromChat(
  chatId: ChatIdObj,
  recipients: string[],
  chatDeleted?: true,
): Promise<void> {
  await Promise.allSettled(
    recipients.map(recipient =>
      sendSystemDeletableMessage({
        chatId,
        recipients: [recipient],
        chatSystemData: {
          event: 'member-removed',
          chatDeleted,
        },
      }),
    ),
  );
}

export async function sendSysMsgToLeaveChat(
  chatId: ChatIdObj,
  chatMessageId: string,
  recipients: string[],
): Promise<void> {
  await sendSystemMessage({
    chatId,
    chatMessageId,
    recipients,
    chatSystemData: {
      event: 'member-left',
    },
  });
}

export async function sendRegularMessage(
  chatId: ChatIdObj,
  chatMessageId: string,
  recipients: string[],
  text: string,
  attachments: ChatOutgoingMessage['attachments'],
  relatedMessage: RelatedMessage | undefined,
): Promise<void> {
  const jsonBody: ChatRegularMsgV1 = {
    v: 1,
    chatMessageType: 'regular',
    groupChatId: chatId.isGroupChat ? chatId.chatId : undefined,
    chatMessageId,
    relatedMessage,
  };

  const outMsg: ChatOutgoingMessage = {
    msgType: 'chat',
    jsonBody,
    plainTxtBody: text,
    attachments,
  };

  const deliveryMetadata: LocalMetadataInDelivery = {
    chatId,
    chatMessageType: 'regular',
    chatMessageId,
  };

  addMessageToDeliveryList(outMsg, recipients, deliveryMetadata);
}

export async function sendChatSyncMsg({
  ownAddr,
  chatId,
  data,
}: {
  ownAddr: string;
  chatId: ChatIdObj;
  data: ChatSyncMsgV1;
}): Promise<string> {
  const { value } = data;
  const { chatMessageId } = value;

  const chatOutgoingMessage: ChatOutgoingMessage = {
    msgType: 'chat',
    jsonBody: data,
  };

  const deliveryMetadata: LocalMetadataInDelivery = {
    chatMessageType: 'synchronization',
    chatId,
    chatMessageId,
  };

  return await addMessageToDeliveryList(chatOutgoingMessage, [ownAddr], deliveryMetadata);
}
