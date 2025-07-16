/*
 Copyright (C) 2020 - 2025 3NSoft Inc.

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

/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from 'dayjs';
import { isEmpty, size } from 'lodash';
import { html2text } from '@v1nt1248/3nclient-lib/utils';
import { messageActions } from '../constants';
import type {
  AttachmentsContainer,
  ChatMessageAction,
  ChatMessageAttachmentsInfo,
  ChatMessageView,
  FileWithId,
  MessageStatus,
} from '~/index';
import { useContactsStore } from '@main/store/contacts.store';
import { getTextForChatInvitationMessage, getTextForChatSystemMessage } from './chat-ui.helper';

export async function getAttachmentFilesInfo(
  { files, incomingAttachments, outgoingAttachments }:
    {
      files?: web3n.files.ReadonlyFile[],
      incomingAttachments?: web3n.files.ReadonlyFS,
      outgoingAttachments?: AttachmentsContainer
    },
): Promise<ChatMessageAttachmentsInfo[] | undefined> {
  if (isEmpty(files) && isEmpty(incomingAttachments) && isEmpty(outgoingAttachments)) {
    return;
  }

  const filesInfo = [] as ChatMessageAttachmentsInfo[];
  if (!isEmpty(incomingAttachments)) {
    const fileList = await incomingAttachments.listFolder('/');
    for (const file of fileList) {
      const fileStat = await incomingAttachments.stat(file.name);
      const size = fileStat.size!;
      filesInfo.push({ name: file.name, size });
    }
  } else {
    const processedFiles = !isEmpty(files)
      ? files!
      : Object.values(outgoingAttachments!.files!);
    for (const file of processedFiles!) {
      const fileStat = await file.stat();
      const size = fileStat.size!;

      filesInfo.push({
        name: file.name,
        size,
        ...((file as FileWithId).fileId && { id: (file as FileWithId).fileId }),
      });
    }
  }

  return filesInfo;
}

export async function exportChatMessages(
  { chatName, isGroupChat, messages = [] }:
    { chatName: string, isGroupChat: boolean, messages: ChatMessageView[] },
): Promise<boolean | undefined> {
  const { getContactName } = useContactsStore();
  const chatContent = messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(m => {
      const dateValue = dayjs(m.timestamp);
      const dateTime = dateValue.format('YYYY-MM-DD HH:mm:ss');
      const author = getContactName(m.sender);
      const { chatMessageType: type } = m;
      const text = ((type === 'system') ? getTextForChatSystemMessage(m) :
        (type === 'invitation') ? getTextForChatInvitationMessage(m) :
        html2text(m.body)
      );
      const attachInfo = (
        (m.chatMessageType !== 'regular') || isEmpty(m.attachments)
      ) ? '' : m.attachments!.map(i => i.name).join(', ');
      let value = `${dateTime} ${author}(${m.sender})`;
      if (text) {
        value += `\n${text}`;
      }
      if (attachInfo) {
        value += `\n[${attachInfo}]`;
      }
      value += '\n';
      return value;
    })
    .join('\n');

  const fileName = isGroupChat ? chatName : getContactName(chatName);
  if (w3n.shell?.fileDialogs?.saveFileDialog) {
    const outFile = await w3n.shell?.fileDialogs?.saveFileDialog(
      'Export chat history',
      '',
      `${fileName}.txt`,
    );
    if (outFile) {
      try {
        await (outFile as web3n.files.WritableFile).writeTxt(chatContent);
        return true;
      } catch (e) {
        console.error(e);
        return false;
      }
    }
  }
}

function checkAction({ 
  messageType, status, hasAttachments, condition
}: {
  messageType: 'incoming' | 'outgoing',
  status: MessageStatus | undefined, hasAttachments: boolean, condition: string
}): boolean {
  const [msgType, msgStatusAsString, areAttachmentsPresent] = condition.split(':');
  // messageType
  const typeMatches = messageType === msgType;
  let statusMatches;
  let attachmentsMatche;

  if (!msgStatusAsString || !status) {
    statusMatches = true;
  } else {
    const statuses = msgStatusAsString.split(',');
    statusMatches = statuses.includes(status);
  }

  if (!areAttachmentsPresent) {
    attachmentsMatche = true;
  } else {
    attachmentsMatche = (hasAttachments && areAttachmentsPresent === 'true')
      || (!hasAttachments && areAttachmentsPresent === 'false');
  }

  return typeMatches && statusMatches && attachmentsMatche;
}

export function getMessageActions(
  msg: ChatMessageView, $tr: (txt: string) => string
): Omit<ChatMessageAction, 'conditions'>[] {
  const { incomingMsgId, status } = msg;
  const messageType = (incomingMsgId ? 'incoming' : 'outgoing');
  return messageActions
  .filter(action => {
    const { conditions, disabled = false } = action;
    if (disabled) {
      return false;
    }

    if (isEmpty(conditions)) {
      return true;
    }

    let isAllowedAction = false;
    for (const condition of conditions) {
      const hasAttachments = (msg.chatMessageType === 'regular') && !!size(msg.attachments);
      isAllowedAction = isAllowedAction
        || checkAction({ messageType, status, hasAttachments, condition });
      if (isAllowedAction) {
        break;
      }
    }
    return isAllowedAction;
  })
  .map(item => ({
    ...item,
    title: $tr(item.title)
  }));
}
