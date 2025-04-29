/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from 'dayjs';
import { isEmpty, size } from 'lodash';
import { addFileTo } from '../services/base/attachments-container';
import { html2text } from '@v1nt1248/3nclient-lib/utils';
import { getContactName } from './contacts.helper';
import { messageActions } from '../constants';
import type {
  AttachmentsContainer,
  ChatMessageAction,
  ChatMessageAttachmentsInfo,
  ChatMessageView,
  FileWithId,
  MessageType,
  MessageDeliveryStatus,
} from '~/index';

export function createAttachmentsContainer(files: web3n.files.ReadonlyFile[]): AttachmentsContainer {
  const container = {} as AttachmentsContainer;
  for (const file of files) {
    addFileTo(container, file);
  }
  return container;
}

export async function getAttachmentFilesInfo(
  { files, incomingAttachments, outgoingAttachments }:
    {
      files?: web3n.files.ReadonlyFile[],
      incomingAttachments?: web3n.files.ReadonlyFS,
      outgoingAttachments?: AttachmentsContainer
    },
): Promise<ChatMessageAttachmentsInfo[] | null> {
  if (isEmpty(files) && isEmpty(incomingAttachments) && isEmpty(outgoingAttachments)) {
    return null;
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
  { chatName, members = [], messages = [] }:
    { chatName: string, members: string[], messages: ChatMessageView<MessageType>[] },
): Promise<boolean | undefined> {
  const chatContent = messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(m => {
      const dateValue = dayjs(m.timestamp);
      const dateTime = dateValue.format('YYYY-MM-DD HH:mm:ss');
      const author = getContactName(m.sender);
      const text = html2text(m.body);
      const attachInfo = isEmpty(m.attachments)
        ? ''
        : m.attachments!.map(i => i.name).join(', ');
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

  const fileName = size(members) === 2 ? getContactName(chatName) : chatName;
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

export function chatMessagesByType(
  messages: ChatMessageView<MessageType>[]
): { incomingMessages: string[], outgoingMessages: string[] } {
  return messages.reduce(
    (res, m) => {
    const { msgId, messageType } = m;
    if (messageType === 'incoming') {
      res.incomingMessages.push(msgId);
    } else {
      res.outgoingMessages.push(msgId);
    }
    return res;
    },
    {
      incomingMessages: [] as string[],
      outgoingMessages: [] as string[]
    }
  );
}

function checkAction(
  { messageType, status, hasAttachments, condition }:
    { messageType: MessageType, status: MessageDeliveryStatus | undefined, hasAttachments: boolean, condition: string },
): boolean {
  const [msgType, msgStatusAsString, areAttachmentsPresent] = condition.split(':');
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
  msg: ChatMessageView<MessageType>, $tr: (txt: string) => string
): Omit<ChatMessageAction, 'conditions'>[] {
  const { messageType, status, attachments } = msg;
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
      isAllowedAction = isAllowedAction
        || checkAction({ messageType, status, hasAttachments: !!size(attachments), condition });
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
