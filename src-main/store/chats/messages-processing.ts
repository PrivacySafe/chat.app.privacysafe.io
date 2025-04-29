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

import { appChatsSrv, appDeliverySrv, fileLinkStoreSrv } from '@main/services/services-provider';
import { ChatsStore, useChatsStore } from '@main/store/chats.store';
import { ContactsStore, useContactsStore } from '@main/store/contacts.store';
import { includesAddress, toCanonicalAddress } from '@shared/address-utils';
import { storeToRefs } from 'pinia';
import { AppDeliveryService, ChatIncomingMessage, ChatMessageView, ChatSystemMessageData, MessageType, SystemMessageHandlerParams } from '~/index';
import { getAttachmentFilesInfo } from '@main/utils/chats.helper';
import { sendSystemMessage } from './send-system-message';
import { makeServiceCaller } from '@shared/ipc/ipc-service-caller';
import { getDeliveryErrors } from '@v1nt1248/3nclient-lib/utils';
import { isEmpty, size } from 'lodash';
import { useAppStore } from '../app.store';
import { ChatStore, useChatStore } from '../chat.store';
import { Ref } from 'vue';

export type HandleChatIncomingMessage = (
  msg: ChatIncomingMessage
) => Promise<void>;

function makeIncomingMessageHandler(
  chatsStore: ChatsStore, chatStore: ChatStore, contactsStore: ContactsStore,
  ownAddr: string
): HandleChatIncomingMessage {

  const { fetchChatList, createChat } = chatsStore;
  const { chatList } = storeToRefs(chatsStore);
  const {
    pushMsgIntoCurrentChatMessages, fetchChat,
    getWritableCurrentChatMessageView 
  } = chatStore;
  const { currentChatId, currentChatMessages } = storeToRefs(chatStore);
  const { fetchContacts } = contactsStore;

  return async msg => {

    const { jsonBody, msgId } = msg;
    const { chatMessageType, chatId, members = [] } = jsonBody;

    const membersFromDb = chatList.value[chatId]?.members;
    const realMembers = membersFromDb || members;
    if (
      chatMessageType === 'system' ||
      (chatMessageType === 'regular' && includesAddress(realMembers, ownAddr))
    ) {

      await fetchContacts();

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
      const isChatPresent = Object.keys(chatList.value).includes(chatId);
    
      if (!isChatPresent) {
        const name = isGroupChat(members, ownAddr)
          ? chatName || 'Group chat'
          : chatName || sender;
        await createChat({ chatId, members, admins, name });
      }
    
      switch (chatMessageType) {
        case 'system':
          const { event, value, displayable = false } = chatSystemData;
          const params: SystemMessageHandlerParams = {
            chatId, msgId, sender, chatMessageId, value, displayable,
          };
          switch (event) {
            case 'add:members':
              return await handleAddChatMembers(
                fetchChatList, pushMsgIntoCurrentChatMessages, params
              );
            case 'remove:members':
              return await handleRemoveChatMembers(
                fetchChatList, pushMsgIntoCurrentChatMessages, params
              );
            case 'delete:members':
              return await handleDeleteChatMembers(
                fetchChatList, pushMsgIntoCurrentChatMessages, params
              );
            case 'update:status':
              return await handleUpdateMessageStatus(
                getWritableCurrentChatMessageView, params
              );
            case 'delete:message':
              return await handleDeleteChatMessage(
                fetchChatList, currentChatId, fetchChat, params
              );
            case 'update:chatName':
              return await handleUpdateChatName(
                fetchChatList, pushMsgIntoCurrentChatMessages, params
              );
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
    
          await appChatsSrv.upsertMessage(msgView);
          pushMsgIntoCurrentChatMessages(msgView);
          await fetchChatList();
          sendSystemMessage({
            chatId,
            chatMessageId,
            recipients: [sender],
            event: 'update:status',
            value: 'received',
          });
          if (!attachments) {
            appDeliverySrv.removeMessageFromInbox([msgId]);
          }
          break;
      }

    } else {
      appDeliverySrv.removeMessageFromInbox([msgId]);
    }

  };
}

function isGroupChat(members: string[], ownAddr: string): boolean {
  const all = members.map(toCanonicalAddress);
  const canonOwnAddr = toCanonicalAddress(ownAddr);
  const other = all.filter(addr => (addr !== canonOwnAddr));
  return (other.length > 1);
}

export async function startMessagesProcessing(): Promise<() => void> {

  const chatsStore = useChatsStore();
  const chatStore = useChatStore();
  const { getWritableCurrentChatMessageView } = chatStore;
  const contactsStore = useContactsStore();
  const { user: ownAddr } = useAppStore();

  const deliverySrvConnection = await w3n.rpc!.thisApp!('ChatDeliveryService');
  const deliverSrv = makeServiceCaller(
    deliverySrvConnection,
    [],
    ['watchIncomingMessages', 'watchOutgoingMessages'],
  ) as AppDeliveryService;

  const stopIncomingMsgObservation = deliverSrv.watchIncomingMessages({
    next: makeIncomingMessageHandler(
      chatsStore, chatStore, contactsStore, ownAddr
    ),
    error: (e) => console.error(e),
    complete: () => deliverySrvConnection.close(),
  });

  const stopOutgoingMsgObservation = deliverSrv.watchOutgoingMessages({
    next: (val) => {
      const { id, progress } = val;
      const { allDone, recipients } = progress;
      if (allDone) {
        appDeliverySrv.removeMessageFromDeliveryList([id]);
        const errors = getDeliveryErrors(progress);
        const { localMeta = {} } = progress;
        const { path } = localMeta;

        if (!path.includes('system')) {
          // TODO it's necessary to change when we will add new delivery status (not only 'sent' or 'error')
          const status = (
            (size(errors) === 0) || (size(recipients) > size(errors))
          ) ? 'sent' : 'error';

          handleUpdateMessageStatus(
            getWritableCurrentChatMessageView, { msgId: id, value: status }
          );
        }
      }
    },
    error: (e) => console.error(e),
    complete: () => deliverySrvConnection.close(),
  });

  return () => {
    stopIncomingMsgObservation();
    stopOutgoingMsgObservation();
  };
}

async function handleAddChatMembers(
  fetchChatList: ChatsStore['fetchChatList'],
  pushMsgIntoCurrentChatMessages: ChatStore['pushMsgIntoCurrentChatMessages'],
  params: SystemMessageHandlerParams
): Promise<void> {
  const { sender, chatId, msgId, chatMessageId, value, displayable } = params;
  if (!chatId || (chatId && !value)) {
    return;
  }

  const chat = await appChatsSrv.getChat(chatId);
  if (chat) {
    const { membersToAdd = [], updatedMembers } = value as { membersToAdd: string[], updatedMembers: string[] };
    chat.members = updatedMembers;
    await appChatsSrv.updateChat(chat);
    await fetchChatList();

    if (displayable) {
      const msgView: ChatMessageView<'incoming'> = {
        msgId: msgId!,
        attachments: [],
        messageType: 'incoming',
        sender: sender!,
        body: `[${membersToAdd.join(', ')}]add.members.system.message`,
        chatId,
        chatMessageType: 'system',
        chatMessageId: chatMessageId!,
        initialMessageId: null,
        timestamp: Date.now(),
        status: 'received',
      };

      await appChatsSrv.upsertMessage(msgView);
      pushMsgIntoCurrentChatMessages(msgView);
    }
  }
}

async function handleDeleteChatMembers(
  fetchChatList: ChatsStore['fetchChatList'],
  pushMsgIntoCurrentChatMessages: ChatStore['pushMsgIntoCurrentChatMessages'],
  {
    msgId,
    chatId,
    chatMessageId,
    value,
    displayable,
    sender = '',
  }: SystemMessageHandlerParams
): Promise<void> {
  if (!chatId || (chatId && !value)) {
    return;
  }

  const chat = await appChatsSrv.getChat(chatId);
  if (chat) {
    const { members } = chat;
    const { users, isRemoved } = value as { users: string[], isRemoved: boolean };

    chat.members = members.filter(addr => !includesAddress(users, addr));

    await appChatsSrv.updateChat(chat);
    await fetchChatList();

    if (displayable) {
      let messageText = `[${users.join(',')}]`;
      if (!isRemoved) {
        messageText += 'leave.chat.system.message';
      } else {
        messageText = users.length > 1
          ? messageText + 'delete.members.system.message'
          : messageText + 'delete.member.system.message';
      }

      const msgView: ChatMessageView<'incoming'> = {
        msgId: msgId!,
        attachments: [],
        messageType: 'incoming',
        sender,
        body: messageText,
        chatId,
        chatMessageType: 'system',
        chatMessageId: chatMessageId!,
        initialMessageId: null,
        timestamp: Date.now(),
        status: 'received',
      };

      await appChatsSrv.upsertMessage(msgView);
      pushMsgIntoCurrentChatMessages(msgView);
    }
  }
}

async function handleDeleteChatMessage(
  fetchChatList: ChatsStore['fetchChatList'],
  currentChatId: Ref<ChatStore['currentChatId']>,
  fetchChat: ChatStore['fetchChat'],
  {
    chatId,
    value,
  }: SystemMessageHandlerParams
): Promise<void> {
  if (!chatId || (chatId && !value)) {
    return;
  }

  const { chatMessageId } = value;
  const message = await appChatsSrv.getMessage({ chatMsgId: chatMessageId });

  if (!message) {
    return;
  }

  await deleteChatMessageFromInbox(chatMessageId, message);
  if (chatId === currentChatId.value) {
    await fetchChat(chatId);
  } else {
    await fetchChatList();
  }
}

async function deleteChatMessageFromInbox(
  chatMsgId: string, message: ChatMessageView<MessageType>
): Promise<void> {
  const { messageType, attachments, msgId } = message;
  await appChatsSrv.deleteMessage({ chatMsgId });
  if (messageType === 'incoming') {
    await appDeliverySrv.removeMessageFromInbox([msgId]);
  } else {
    await appDeliverySrv.removeMessageFromDeliveryList([msgId]);
    if (!isEmpty(attachments)) {
      for (const attachment of attachments!) {
        const { id } = attachment;
        id && await fileLinkStoreSrv.deleteLink(id);
      }
    }
  }
}

async function handleRemoveChatMembers(
  fetchChatList: ChatsStore['fetchChatList'],
  pushMsgIntoCurrentChatMessages: ChatStore['pushMsgIntoCurrentChatMessages'],
  params: SystemMessageHandlerParams
): Promise<void> {
  const { sender, chatId, msgId, chatMessageId, value, displayable } = params;
  if (!chatId || (chatId && !value)) {
    return;
  }

  const chat = await appChatsSrv.getChat(chatId);
  if (chat) {
    const { membersToDelete = [], updatedMembers } = value as { membersToDelete: string[], updatedMembers: string[] };
    chat.members = updatedMembers;
    await appChatsSrv.updateChat(chat);
    await fetchChatList();

    if (displayable) {
      const msgView: ChatMessageView<'incoming'> = {
        msgId: msgId!,
        attachments: [],
        messageType: 'incoming',
        sender: sender!,
        body: `[${membersToDelete.join(', ')}]remove.members.system.message`,
        chatId,
        chatMessageType: 'system',
        chatMessageId: chatMessageId!,
        initialMessageId: null,
        timestamp: Date.now(),
        status: 'received',
      };

      await appChatsSrv.upsertMessage(msgView);
      pushMsgIntoCurrentChatMessages(msgView);
    }
  }
}

async function handleUpdateChatName(
  fetchChatList: ChatsStore['fetchChatList'],
  pushMsgIntoCurrentChatMessages: ChatStore['pushMsgIntoCurrentChatMessages'],
  {
    chatId,
    chatMessageId,
    value,
    msgId,
    sender = '',
  }: SystemMessageHandlerParams
): Promise<void> {
  if (!chatId || !msgId || !chatMessageId) {
    return;
  }

  const chat = await appChatsSrv.getChat(chatId);
  if (chat) {
    const { name } = value as { name: string };
    chat.name = name;
    await appChatsSrv.updateChat(chat);
    await fetchChatList();

    const msgView: ChatMessageView<'incoming'> = {
      msgId,
      attachments: [],
      messageType: 'incoming',
      sender,
      body: 'rename.chat.system.message',
      chatId,
      chatMessageType: 'system',
      chatMessageId,
      initialMessageId: null,
      timestamp: Date.now(),
      status: 'received',
    };

    await appChatsSrv.upsertMessage(msgView);
    pushMsgIntoCurrentChatMessages(msgView);
  }
}

export async function handleUpdateMessageStatus(
  getChatMessageView: ChatStore['getWritableCurrentChatMessageView'],
  { msgId, chatMessageId, value }: SystemMessageHandlerParams
): Promise<void> {
  const message = await appChatsSrv.getMessage({
    chatMsgId: chatMessageId, msgId
  });

  if (message && message.status !== value) {
    message.status = value;
    await appChatsSrv.upsertMessage(message);
    const msgViewToUpdate = getChatMessageView(
      message.chatId, chatMessageId!, msgId!
    )
    if (msgViewToUpdate) {
        msgViewToUpdate.status = value;
    }
  }
}
