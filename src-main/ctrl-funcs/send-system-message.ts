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

import { getRandomId } from '@v1nt1248/3nclient-lib/utils';
import { appChatsSrvProxy, appDeliverySrvProxy } from '@main/services/services-provider';
import { msgIdLength } from '@main/constants';
import type { ChatOutgoingMessage, ChatSystemEvent } from '~/index';

export async function sendSystemMessage(
  { chatId, chatMessageId, recipients, event, value, displayable = false }:
    {
      chatId: string, chatMessageId: string, recipients: string[],
      event: ChatSystemEvent, value: any, displayable?: boolean
    },
): Promise<string> {
  const chat = await appChatsSrvProxy.getChat(chatId);
  const { members = [], admins = [], name } = chat || {};

  const msgId = getRandomId(msgIdLength);
  const msgData: ChatOutgoingMessage = {
    msgId,
    msgType: 'chat',
    recipients,
    jsonBody: {
      chatId,
      chatMessageType: 'system',
      ...(chat && name && { chatName: name }),
      members,
      admins,
      chatMessageId,
      chatSystemData: { event, value, displayable },
    },
  };
  appDeliverySrvProxy.addMessageToDeliveryList(msgData, `chat:${chatId}:${msgId}:system`);
  return msgId;
}
