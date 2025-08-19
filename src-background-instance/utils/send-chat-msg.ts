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

import { generatOutgoingMsgId } from '../../shared-libs/chat-ids.ts';
import type {
  ChatIdObj,
  ChatInvitationMsgV1,
  ChatOutgoingMessage,
  ChatRegularMsgV1,
  ChatSystemMsgV1,
  LocalMetadataInDelivery,
  RelatedMessage,
} from '../../types/index.ts';

export async function sendSystemMessage(
  { chatId, recipients, chatMessageId, chatSystemData }:
    { chatId: ChatIdObj; recipients: string[] } & Pick<ChatSystemMsgV1, 'chatMessageId' | 'chatSystemData'>,
): Promise<void> {
  const jsonBody: ChatSystemMsgV1 = {
    v: 1,
    chatMessageType: 'system',
    groupChatId: (chatId.isGroupChat ? chatId.chatId : undefined),
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
  await addMessageToDeliveryList(outMsg, recipients, deliveryMetadata);
}

async function addMessageToDeliveryList(
  message: ChatOutgoingMessage,
  recipients: string[],
  localMeta: LocalMetadataInDelivery,
): Promise<void> {
  await w3n.mail!.delivery.addMsg(
    recipients,
    message,
    generatOutgoingMsgId(),
    {
      sendImmediately: !message.attachments,
      localMeta,
    },
  );
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
  await addMessageToDeliveryList(outMsg, recipients, deliveryMetadata);
}

export async function sendSysMsgsAboutRemovalFromChat(
  chatId: ChatIdObj,
  recipients: string[],
  chatDeleted?: true,
): Promise<void> {
  await Promise.allSettled(recipients.map(recipient => sendSystemMessage({
    chatId,
    recipients: [recipient],
    chatSystemData: {
      event: 'member-removed',
      chatDeleted,
    },
  })));
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
    groupChatId: (chatId.isGroupChat ? chatId.chatId : undefined),
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
    chatId, chatMessageType: 'regular', chatMessageId,
  };

  addMessageToDeliveryList(outMsg, recipients, deliveryMetadata);
}
