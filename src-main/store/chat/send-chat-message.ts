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

import { msgIdLength } from "@main/constants";
import { createAttachmentsContainer, getAttachmentFilesInfo } from "@main/utils/chats.helper";
import { appDeliverySrv, fileLinkStoreSrv } from "@main/services/services-provider";
import { getRandomId } from "@v1nt1248/3nclient-lib/utils";
import { AttachmentsContainer, FileWithId } from "~/app.types";
import { ChatMessageLocalMeta, ChatMessageView, ChatOutgoingMessage } from "~/chat.types";

export async function sendChatMessage(
  ownAddr: string,
  {
    chatId, chatName, text, recipients, chatMembers, chatAdmins, files,
    initialMessageId
  }: {
    chatId: string, chatName: string, text: string, recipients: string[],
    chatMembers: string[], chatAdmins: string[],
    files?: web3n.files.ReadonlyFile[] | undefined, initialMessageId?: string
  },
  recordOutgoingMsg: (msg: ChatMessageView<'outgoing'>) => Promise<void>
) {
  const messages = [];
  if (text) {
    const messageWithText = prepareOutgoingMessage({
    chatId, chatName, recipients, text,
    chatMembers, chatAdmins, initialMessageId,
    });
    messages.push(messageWithText);
  }

  if (files && (files.length > 0)) {
    for (const file of files!) {
    const fileId = await fileLinkStoreSrv.saveLink(file);
    (file as FileWithId).fileId = fileId;

    const attachments = createAttachmentsContainer([file]);
    const messageWithAttachment = prepareOutgoingMessage({
      chatId, chatName, recipients, text: '',
      chatMembers, chatAdmins, attachments,
    });
    messages.push(messageWithAttachment);
    }
  }

  for (const message of messages) {
    await sendMessage(ownAddr, message, recordOutgoingMsg);
  }
}

function prepareOutgoingMessage({
  chatId, chatName, recipients, text, chatMembers, chatAdmins, attachments, initialMessageId
}: {
  chatId: string, chatName: string, recipients: string[], text: string,
  chatMembers: string[], chatAdmins: string[],
  attachments?: AttachmentsContainer, initialMessageId?: string
}): ChatOutgoingMessage {
  const msgId = getRandomId(msgIdLength);
  const chatMessageId = `${chatId}-${getRandomId(msgIdLength)}`;
  return {
    msgId,
    msgType: 'chat',
    recipients,
    plainTxtBody: text,
    ...(attachments && { attachments }),
    jsonBody: {
    chatId,
    ...((chatMembers.length > 2) && { chatName: chatName }),
    chatMessageType: 'regular',
    chatMessageId,
    members: chatMembers,
    admins: chatAdmins,
    initialMessageId,
    },
    status: 'sending',
  };
}

async function sendMessage(
  ownAddr: string, msg: ChatOutgoingMessage,
  recordOutgoingMsg: (msg: ChatMessageView<'outgoing'>) => Promise<void>
): Promise<void> {
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
    sender: ownAddr,
    body: plainTxtBody! || htmlTxtBody! || '',
    attachments: await getAttachmentFilesInfo({ outgoingAttachments: attachments! }),
    chatId: chatId!,
    chatMessageType: chatMessageType || 'regular',
    initialMessageId: initialMessageId || null,
    status,
    timestamp: Date.now(),
  };

  await recordOutgoingMsg(msgView);

  await appDeliverySrv.addMessageToDeliveryList(msg, metaPath);
}
