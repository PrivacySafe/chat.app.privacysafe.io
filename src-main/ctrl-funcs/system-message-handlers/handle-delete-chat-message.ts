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

import { appChatsSrvProxy, appDeliverySrvProxy, fileLinkStoreSrv } from '@main/services/services-provider';
import { ChatsStore } from '@main/store/chats';
import type { ChatMessageView, MessageType, SystemMessageHandlerParams } from '~/index';
import { isEmpty } from 'lodash';

export async function handleDeleteChatMessage(
  chatsStore: ChatsStore,
  {
    chatId,
    value,
  }: SystemMessageHandlerParams
): Promise<void> {
  if (!chatId || (chatId && !value)) {
    return;
  }

  const { chatMessageId } = value;
  const message = await appChatsSrvProxy.getMessage({ chatMsgId: chatMessageId });

  if (!message) {
    return;
  }

  await deleteChatMessageFromInbox(chatMessageId, message);
  if (chatId === chatsStore.currentChatId) {
    await chatsStore.fetchChat(chatId);
  } else {
    await chatsStore.fetchChatList();
  }
}

async function deleteChatMessageFromInbox(
  chatMsgId: string, message: ChatMessageView<MessageType>
): Promise<void> {
  const { messageType, attachments, msgId } = message;
  await appChatsSrvProxy.deleteMessage({ chatMsgId });
  if (messageType === 'incoming') {
    await appDeliverySrvProxy.removeMessageFromInbox([msgId]);
  } else {
    await appDeliverySrvProxy.removeMessageFromDeliveryList([msgId]);
    if (!isEmpty(attachments)) {
      for (const attachment of attachments!) {
        const { id } = attachment;
        id && await fileLinkStoreSrv.deleteLink(id);
      }
    }
  }
}
