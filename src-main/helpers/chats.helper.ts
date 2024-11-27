/* eslint-disable @typescript-eslint/no-explicit-any */
import dayjs from 'dayjs';
import { isEmpty, size } from 'lodash';
import { useChatsStore } from '../store';
import { fileLinkStoreSrv } from '../services/services-provider';
import { addFileTo } from '../services/base/attachments-container';
import { getRandomId, html2text } from '@v1nt1248/3nclient-lib/utils';
import { getContactName } from './contacts.helper';
import { messageActions, msgIdLength } from '../constants';
import type {
  AttachmentsContainer,
  ChatMessageAction,
  ChatMessageAttachmentsInfo,
  ChatMessageView,
  ChatOutgoingMessage,
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

function prepareOutgoingMessage(
  { chatId, chatName, recipients, text, chatMembers, chatAdmins, attachments, initialMessageId }:
    {
      chatId: string, chatName: string, recipients: string[], text: string,
      chatMembers: string[], chatAdmins: string[], attachments?: AttachmentsContainer, initialMessageId?: string
    },
): ChatOutgoingMessage {
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
      ...(size(chatMembers) > 2 && { chatName: chatName }),
      chatMessageType: 'regular',
      chatMessageId,
      members: chatMembers,
      admins: chatAdmins,
      initialMessageId,
    },
    status: 'sending',
  };
}

export async function sendChatMessage(
  { chatId, chatName, text, recipients, chatMembers, chatAdmins, files, initialMessageId }:
    {
      chatId: string, chatName: string, text: string, recipients: string[],
      chatMembers: string[], chatAdmins: string[],
      files?: web3n.files.ReadonlyFile[] | undefined, initialMessageId?: string
    },
) {
  const { sendMessage } = useChatsStore();
  const messages = [];
  if (text) {
    const messageWithText = prepareOutgoingMessage({
      chatId, chatName, recipients, text,
      chatMembers, chatAdmins, initialMessageId,
    });
    messages.push(messageWithText);
  }

  if (!isEmpty(files)) {
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
    sendMessage(message);
  }
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

export function chatMessagesByType(messages: ChatMessageView<MessageType>[]):
  { incomingMessages: string[], outgoingMessages: string[] } {
  return messages.reduce((res, m) => {
    const { msgId, messageType } = m;
    if (messageType === 'incoming') {
      res.incomingMessages.push(msgId);
    } else {
      res.outgoingMessages.push(msgId);
    }
    return res;
  }, { incomingMessages: [] as string[], outgoingMessages: [] as string[] });
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

export function getMessageActions(msg: ChatMessageView<MessageType>): Omit<ChatMessageAction, 'conditions'>[] {
  const { messageType, status, attachments } = msg;
  return messageActions.filter(action => {
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
  });
}
