/*
 Copyright (C) 2026 3NSoft Inc.

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
/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  ChatIdObj,
  ChatIncomingMessage,
  ChatMessageJsonBody,
  ChatSystemMessageData,
  InvitationProcessMsgData,
  StoredInvitationParams,
  UpdatedMembersInvitationData,
} from '../../../../types/asmail-msgs.types.ts';
import type { ChatMessageAttachmentsInfo, ChatMessageView, RegularMsgView } from '../../../../types/chat.types.ts';
import type {
  ChatDbEntry,
  FileStoreService,
  GroupChatDbEntry,
  MsgDbEntry,
  RefsToMsgsDataNoInDB,
} from '../../../types/index.ts';
import { toCanonicalAddress } from '../../../../shared-libs/address-utils.ts';
import { inviteChatId, isString } from './_common.ts';

export function msgDbEntryToChatMessageView(data: MsgDbEntry): ChatMessageView {
  const {
    groupChatId,
    otoPeerCAddr,
    chatMessageId,
    isIncomingMsg,
    incomingMsgId,
    groupSender,
    body,
    attachments,
    chatMessageType,
    status,
    timestamp,
  } = data;

  const isGroupChat = !!groupChatId;

  return {
    chatId: { isGroupChat, chatId: isGroupChat ? groupChatId! : otoPeerCAddr! },
    chatMessageId,
    timestamp,
    isIncomingMsg,
    incomingMsgId: incomingMsgId || undefined,
    sender: isIncomingMsg ? groupSender || otoPeerCAddr! : '',
    chatMessageType,
    status: status || undefined,
    attachments: attachments || undefined,
    ...(chatMessageType === 'regular' && { body }),
    ...(chatMessageType === 'system' && body && { systemData: JSON.parse(body!) as ChatSystemMessageData }),
    ...(chatMessageType === 'invitation' && body && { inviteData: JSON.parse(body) as StoredInvitationParams }),
  } as ChatMessageView;
}

export function msgDbEntryForIncomingSysMsg(
  sender: string,
  chatId: ChatIdObj,
  chatMessageId: string,
  timestamp: number,
  chatSystemData: ChatSystemMessageData,
): MsgDbEntry {
  return {
    isIncomingMsg: true,
    chatMessageId,
    chatMessageType: 'system',
    otoPeerCAddr: chatId.isGroupChat ? null : chatId.chatId,
    groupChatId: chatId.isGroupChat ? chatId.chatId : null,
    status: null,
    groupSender: chatId.isGroupChat ? sender : null,
    timestamp,
    removeAfter: 0,
    body: JSON.stringify(chatSystemData),
    attachments: null,
    history: null,
    incomingMsgId: null,
    reactions: null,
    settings: null,
    relatedMessage: null,
  };
}

export function msgViewFromDbEntry(
  msgDbEntry: MsgDbEntry,
  relatedMessage: RegularMsgView['relatedMessage'],
  ownAddr: string,
): ChatMessageView {
  const {
    attachments,
    body,
    chatMessageId,
    chatMessageType,
    groupChatId,
    groupSender,
    incomingMsgId,
    isIncomingMsg,
    otoPeerCAddr,
    status,
    timestamp,
    removeAfter,
    history,
    reactions,
    settings,
  } = msgDbEntry;

  const chatId: ChatIdObj = {
    isGroupChat: !!groupChatId,
    chatId: groupChatId ? groupChatId : otoPeerCAddr!,
  };
  const sender = chatId.isGroupChat ? groupSender! : isIncomingMsg ? otoPeerCAddr! : ownAddr;

  switch (chatMessageType) {
    case 'regular':
      return {
        chatId,
        chatMessageId,
        isIncomingMsg,
        incomingMsgId: incomingMsgId ?? undefined,
        chatMessageType,
        timestamp,
        removeAfter,
        sender,
        body: body ?? '',
        attachments: attachments ?? undefined,
        relatedMessage,
        status: status!,
        history: history ?? undefined,
        reactions: reactions ?? undefined,
        settings: (settings ?? {}) as RegularMsgView['settings'],
      } as RegularMsgView;

    case 'system': {
      let systemData: ChatSystemMessageData;

      try {
        systemData = JSON.parse(body!);
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        systemData = {} as any;
      }

      return {
        chatId,
        chatMessageId,
        isIncomingMsg,
        chatMessageType,
        timestamp,
        sender,
        systemData,
      };
    }

    default: {
      let inviteData: Exclude<InvitationProcessMsgData, UpdatedMembersInvitationData>;
      try {
        inviteData = JSON.parse(body!);
      } catch (err) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        inviteData = {} as any;
      }
      return {
        chatId,
        chatMessageId,
        isIncomingMsg,
        chatMessageType,
        timestamp,
        sender,
        inviteData,
      };
    }
  }
}

export function makeMsgDbEntry(
  chatMessageType: MsgDbEntry['chatMessageType'],
  chatMessageId: string,
  params: Partial<MsgDbEntry>,
): MsgDbEntry {
  return {
    isIncomingMsg: false,
    incomingMsgId: null,
    groupChatId: null,
    otoPeerCAddr: null,
    attachments: null,
    body: null,
    groupSender: null,
    history: null,
    reactions: null,
    relatedMessage: null,
    status: chatMessageType === 'regular' ? (params.isIncomingMsg ? 'unread' : 'sending') : null,
    settings: null,
    removeAfter: 0,
    timestamp: 0,
    ...params,
    chatMessageType,
    chatMessageId,
  };
}

export async function removeAttachmentsOfOutgoingMsg(
  attachments: ChatMessageAttachmentsInfo[],
  filesStore: FileStoreService,
): Promise<void> {
  for (const { id } of attachments) {
    if (id) {
      await filesStore.deleteLink(id);
    }
  }
}

export async function removeMessageFromInbox(msgId: string, logInfo?: string): Promise<void> {
  if (logInfo) {
    await w3n.log('info', logInfo);
  }

  await w3n.mail!.inbox.removeMsg(msgId).catch(async (e: web3n.asmail.InboxException) => {
    if (!e.msgNotFound) {
      await w3n.log('error', `Error deleting message ${msgId} from INBOX. `, e);
    }
  });
}

export async function removeMsgFromDelivery(id: string): Promise<void> {
  await w3n.mail!.delivery.rmMsg(id).catch(async err => {
    await w3n.log('error', `Error deleting message ${id} from delivery. `, err);
  });
}

export async function removeMsgDataNotInDB(
  refs: RefsToMsgsDataNoInDB,
  filesStore: FileStoreService,
): Promise<void> {
  for (const msgId of refs.inboxMsgs) {
    await removeMessageFromInbox(msgId);
  }

  for (const { attachments } of refs.outgoingMsgs) {
    await removeAttachmentsOfOutgoingMsg(attachments, filesStore);
  }
}

export function canReceiveRegularMessages(chat: ChatDbEntry, ownAddr: string): boolean {
  const { isGroupChat, status } = chat;
  if (isGroupChat) {
    const { members } = chat as GroupChatDbEntry;
    const { hasAccepted } = members[ownAddr];
    return hasAccepted && ['on', 'partially-on', 'accepted'].includes(status);
  }

  return ['on', 'accepted'].includes(status);
}

export function checkV1(jbV1: ChatMessageJsonBody, sender: string): ChatIdObj | undefined {
  const { groupChatId, chatMessageType } = jbV1;

  switch (chatMessageType) {
    case 'invitation': {
      const { chatMessageId, inviteData } = jbV1;
      if (!isString(chatMessageId)) {
        return;
      }
      return inviteChatId(sender, inviteData);
    }

    case 'system': {
      const { chatSystemData } = jbV1;
      if (!chatSystemData || typeof chatSystemData !== 'object') {
        return;
      }
      break;
    }

    case 'regular': {
      const { chatMessageId } = jbV1;
      if (!isString(chatMessageId)) {
        return;
      }
      break;
    }

    default:
      return;
  }

  if (typeof groupChatId === 'string' && groupChatId) {
    return !groupChatId.includes('@') ? { isGroupChat: true, chatId: groupChatId } : undefined;
  }

  return { isGroupChat: false, chatId: toCanonicalAddress(sender) };
}

export function checkChatMessageJSON(msg: ChatIncomingMessage):
  | {
      chatMsgBody: ChatMessageJsonBody;
      chatId: ChatIdObj;
    }
  | undefined {
  const { sender, jsonBody } = msg;
  if (jsonBody.v === 1) {
    const chatId = checkV1(jsonBody, sender);
    return chatId ? { chatId, chatMsgBody: jsonBody } : undefined;
  }
}

export async function getIncomingMessage(msgId: string): Promise<ChatIncomingMessage | undefined> {
  try {
    return (await w3n.mail!.inbox.getMsg(msgId)) as ChatIncomingMessage;
  } catch (e) {
    await w3n.log('error', `Error getting the message ${msgId}.`, e);
  }
}
