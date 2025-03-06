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
import { ChatsStore } from '@main/store/chats';
import { ContactsStore } from '@main/store/contacts';
import { includesAddress, toCanonicalAddress } from '@shared/address-utils';
import { storeToRefs } from 'pinia';
import { ChatIncomingMessage, ChatMessageView, ChatSystemMessageData, SystemMessageHandlerParams } from '~/index';
import { getAttachmentFilesInfo } from '@main/helpers/chats.helper';
import { Nullable } from '@v1nt1248/3nclient-lib';
import { handleAddChatMembers } from './system-message-handlers/handle-add-chat-members';
import { handleRemoveChatMembers } from './system-message-handlers/handle-remove-chat-members';
import { handleDeleteChatMembers } from './system-message-handlers/handle-delete-chat-members';
import { handleUpdateMessageStatus } from './system-message-handlers/handle-update-message-status';
import { handleDeleteChatMessage } from './system-message-handlers/handle-delete-chat-message';
import { handleUpdateChatName } from './system-message-handlers/handle-update-chat-name';
import { sendSystemMessage } from './send-system-message';
import { createChat } from './create-chat';

export type HandleChatIncomingMessage = (
  msg: ChatIncomingMessage
) => Promise<void>;

export function makeIncomingMessageHandler(
  chatsStore: ChatsStore, contactsStore: ContactsStore, ownAddr: string
): HandleChatIncomingMessage {

  const { currentChatId, chatList } = storeToRefs(chatsStore);

  return async msg => {

    const { jsonBody, msgId } = msg;
    const { chatMessageType, chatId, members = [] } = jsonBody;

    const membersFromDb = chatList.value[chatId]?.members;
    const realMembers = membersFromDb || members;
    if (
      chatMessageType === 'system' ||
      (chatMessageType === 'regular' && includesAddress(realMembers, ownAddr))
    ) {
      processMessage(
        chatsStore, contactsStore, ownAddr, msg, currentChatId.value
      );
    } else {
      appDeliverySrvProxy.removeMessageFromInbox([msgId]);
    }

  };
}

function isGroupChat(members: string[], ownAddr: string): boolean {
  const all = members.map(toCanonicalAddress);
  const canonOwnAddr = toCanonicalAddress(ownAddr);
  const other = all.filter(addr => (addr !== canonOwnAddr));
  return (other.length > 1);
}

async function processMessage(
  chatsStore: ChatsStore, contactsStore: ContactsStore, me: string,
  msg: ChatIncomingMessage, currentChatId: Nullable<string>
): Promise<void> {
  await contactsStore.fetchContactList();

  const {
    jsonBody,
    msgId,
    attachments,
    plainTxtBody,
    htmlTxtBody,
    sender,
  } = msg;
  const {
    chatId,
    chatMessageType = 'regular',
    chatMessageId,
    members,
    admins = [],
    chatName,
    initialMessageId,
    chatSystemData = {} as ChatSystemMessageData,
  } = jsonBody;
  const isChatPresent = Object.keys(chatsStore.chatList).includes(chatId!);

  if (!isChatPresent) {
    const name = isGroupChat(members, me)
      ? chatName || 'Group chat'
      : chatName || sender;
    await createChat(chatsStore, { chatId, members, admins, name });
  }

  switch (chatMessageType) {
    case 'system':
      const { event, value, displayable = false } = chatSystemData;
      const params: SystemMessageHandlerParams = {
        chatId, msgId, sender, chatMessageId, value, displayable,
      };
      switch (event) {
        case 'add:members':
          return await handleAddChatMembers(chatsStore, params);
        case 'remove:members':
          return await handleRemoveChatMembers(chatsStore, params);
        case 'delete:members':
          return await handleDeleteChatMembers(chatsStore, params);
        case 'update:status':
          return await handleUpdateMessageStatus(chatsStore, params);
        case 'delete:message':
          return await handleDeleteChatMessage(chatsStore, params);
        case 'update:chatName':
          return await handleUpdateChatName(chatsStore, params);
        default:
          return await w3n.log(
            'error', `No handler found to handle chat system event ${event}`
          );
      }
    default:
      const msgView: ChatMessageView<'incoming'> = {
        msgId,
        attachments: await getAttachmentFilesInfo({
          incomingAttachments: attachments
        }),
        messageType: 'incoming',
        sender,
        body: plainTxtBody! || htmlTxtBody! || '',
        chatId,
        chatMessageType,
        chatMessageId,
        initialMessageId: initialMessageId || null,
        timestamp: Date.now(),
        status: 'received',
      };

      await appChatsSrvProxy.upsertMessage(msgView);
      if (chatId === currentChatId) {
        chatsStore.currentChatMessages.push(msgView);
      }
      await chatsStore.fetchChatList();
      sendSystemMessage({
        chatId,
        chatMessageId,
        recipients: [sender],
        event: 'update:status',
        value: 'received',
      });
      if (!attachments) {
        appDeliverySrvProxy.removeMessageFromInbox([msgId]);
      }
      break;
  }
}
