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

import { useAppStore } from '@main/store/app';
import { sendSystemMessage } from './send-system-message';
import { ChatsStore } from '@main/store/chats';
import { ChatMessageView, MessageType } from '~/chat.types';
import { appChatsSrvProxy, appDeliverySrvProxy, fileLinkStoreSrv } from '@main/services/services-provider';
import { isEmpty } from 'lodash';
import { areAddressesEqual } from '@shared/address-utils';

export async function deleteMessage(
  chatsStore: ChatsStore, chatMsgId: string, deleteForEveryone?: boolean
): Promise<void> {
  if (!chatMsgId) {
    return;
  }

  const appStore = useAppStore();
  const message = chatsStore.currentChatMessages.find(m => m.chatMessageId === chatMsgId);

  if (!message) {
    appStore.$createNotice({
      type: 'error',
      content: appStore.$i18n.tr('chat.message.delete.error.text'),
    });
    return;
  }

  const { members = [], chatId } = chatsStore.currentChat!;
  await deleteChatMessage(chatMsgId, message);
  await chatsStore.fetchChat(chatId);

  if (!deleteForEveryone) {
    return;
  }

  const recipients = members.filter(addr => !areAddressesEqual(addr, appStore.user));
  sendSystemMessage({
    chatId,
    chatMessageId: chatMsgId,
    recipients,
    event: 'delete:message',
    value: { chatMessageId: chatMsgId },
  });
}

async function deleteChatMessage(
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
