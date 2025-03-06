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

import { appChatsSrvProxy, appDeliverySrvProxy } from '@main/services/services-provider';
import { useAppStore } from '@main/store/app';
import { getAttachmentFilesInfo } from '@main/helpers/chats.helper';
import type { ChatMessageLocalMeta, ChatMessageView, ChatOutgoingMessage } from '~/index';
import { useChatsStore } from '@main/store/chats';

export async function sendMessage(msg: ChatOutgoingMessage): Promise<void> {
  const { user, $emitter } = useAppStore();
  const chatsStore = useChatsStore();
  const {
    msgId,
    attachments,
    jsonBody,
    plainTxtBody,
    htmlTxtBody,
    status,
  } = msg;
  const {
    chatId,
    chatMessageType,
    chatMessageId,
    initialMessageId,
  } = jsonBody;
  const metaPath: ChatMessageLocalMeta = `chat:${chatId}:${msgId}`;

  const msgView: ChatMessageView<'outgoing'> = {
    chatMessageId,
    msgId: msgId!,
    messageType: 'outgoing',
    sender: user,
    body: plainTxtBody! || htmlTxtBody! || '',
    attachments: await getAttachmentFilesInfo({ outgoingAttachments: attachments! }),
    chatId: chatId!,
    chatMessageType: chatMessageType || 'regular',
    initialMessageId: initialMessageId || null,
    status,
    timestamp: Date.now(),
  };

  await appChatsSrvProxy.upsertMessage(msgView);
  chatsStore.currentChatMessages.push(msgView);
  $emitter.emit('send:message', { chatId });
  await chatsStore.fetchChatList();

  appDeliverySrvProxy.addMessageToDeliveryList(msg, metaPath);
}