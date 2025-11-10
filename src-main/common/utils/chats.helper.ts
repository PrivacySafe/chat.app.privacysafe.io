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
import dayjs from 'dayjs';
import { isEmpty, size } from 'lodash';
import { html2text } from '@v1nt1248/3nclient-lib/utils';
import { messageActions } from '../constants';
import type {
  AddressCheckResult,
  AttachmentsContainer,
  ChatException,
  ChatListItemView,
  ChatMessageAction,
  ChatMessageAttachmentsInfo,
  ChatMessageView,
  FileWithId,
  ReadonlyFsWithId,
  MessageStatus, ReadonlyFS,
} from '~/index';
import { useContactsStore } from '@main/common/store/contacts.store';
import { getTextForChatInvitationMessage, getTextForChatSystemMessage } from './chat-ui.helper';

export async function prepareAttachmentEntityInfo(
  entity: web3n.files.ReadonlyFile | web3n.files.ReadonlyFS,
): Promise<ChatMessageAttachmentsInfo | undefined> {
  if (!entity) {
    return;
  }

  return {
    name: entity.name,
    size: (entity as ReadonlyFS).listFolder
      ? 0
      : (await (entity as FileWithId).stat()).size!,
    isFolder: !!(entity as ReadonlyFS).listFolder,
    ...((entity as ReadonlyFsWithId).id && { id: (entity as ReadonlyFsWithId).id }),
    ...((entity as FileWithId).fileId && { id: (entity as FileWithId).fileId }),
  };
}

export async function getAttachmentFilesInfo(
  { files, incomingAttachments, outgoingAttachments }:
  {
    files?: (web3n.files.ReadonlyFile | web3n.files.ReadonlyFS)[],
    incomingAttachments?: web3n.files.ReadonlyFS,
    outgoingAttachments?: AttachmentsContainer
  },
): Promise<ChatMessageAttachmentsInfo[] | undefined> {
  if (isEmpty(files) && isEmpty(incomingAttachments) && isEmpty(outgoingAttachments)) {
    return;
  }

  const attachmentsInfo = [] as ChatMessageAttachmentsInfo[];
  if (!isEmpty(incomingAttachments)) {
    const entities = await incomingAttachments.listFolder('/');
    for (const entity of entities) {
      const entityStat = await incomingAttachments.stat(entity.name);
      const size = entityStat.isFolder ? 0 : entityStat.size;
      attachmentsInfo.push({ name: entity.name, size: size || 0 });
    }
  } else {
    const processedEntities = !isEmpty(files)
      ? files
      : [...Object.values(outgoingAttachments!.files!), ...Object.values(outgoingAttachments!.folders!)];
    for (const entity of processedEntities!) {
      const entityStat = (entity as ReadonlyFsWithId).listFolder
        ? {
          name: entity.name,
          size: 0,
          isFolder: true,
          ...((entity as ReadonlyFsWithId).id && { id: (entity as ReadonlyFsWithId).id }),
        } : {
          name: entity.name,
          size: (await (entity as FileWithId).stat()).size!,
          isFolder: false,
          ...((entity as FileWithId).fileId && { id: (entity as FileWithId).fileId }),
        };

      attachmentsInfo.push(entityStat);
    }
  }

  return attachmentsInfo;
}

function prepareMsgDataToExport(
  msg: ChatMessageView,
  ownAddr: string,
  getContactName: (val: string) => string,
): string {
  const {
    chatMessageType: type,
    isIncomingMsg,
    timestamp,
    sender,
  } = msg;

  const dateValue = dayjs(timestamp);

  const dateTime = dateValue.format('YYYY-MM-DD HH:mm:ss');

  const author = getContactName(isIncomingMsg ? sender : ownAddr);

  const text = type === 'system'
    ? getTextForChatSystemMessage(msg, msg.chatId.isGroupChat, ownAddr)
    : type === 'invitation' ? getTextForChatInvitationMessage(msg) : html2text(msg.body);

  const attachInfo = type !== 'regular' || isEmpty(msg.attachments)
    ? ''
    : msg.attachments!.map(i => i.name).join(', ');

  let value = type === 'regular'
    ? `${dateTime} ${author}(${isIncomingMsg ? sender : ownAddr})`
    : `${dateTime}`;

  if (text) {
    value += `\n${text}`;
  }

  if (attachInfo) {
    value += `\n[${attachInfo}]`;
  }

  value += '\n';

  return value;
}

export async function exportChatMessages(
  { $tr, chat, messages = [], ownAddr }:
  {
    $tr: (key: string, placeholders?: Record<string, string>) => string,
    chat: ChatListItemView,
    messages: ChatMessageView[],
    ownAddr: string,
  },
): Promise<boolean | undefined> {
  const { name: chatName } = chat;

  const { getContactName } = useContactsStore();
  const chatContent = messages
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(m => prepareMsgDataToExport(m, ownAddr, getContactName))
    .join('\n');

  if (w3n.shell?.fileDialogs?.saveFileDialog) {
    const outFile = await w3n.shell?.fileDialogs?.saveFileDialog(
      $tr('chat.export.dialog.title'),
      '',
      `${chatName}.txt`,
    );
    if (outFile) {
      try {
        await (outFile as web3n.files.WritableFile).writeTxt(chatContent);
        return true;
      } catch (e) {
        w3n.log('error', 'Error chat messages content saving. ', e);
        return false;
      }
    }
  }
}

function checkAction(
  { messageType, status, hasAttachments, condition, timestamp }: {
    messageType: 'incoming' | 'outgoing';
    status: MessageStatus | undefined;
    hasAttachments: boolean;
    condition: string;
    timestamp: number;
  }): boolean {
  const [msgType, msgStatusAsString, areAttachmentsPresent, lifetime] = condition.split(':') as ['incoming' | 'outgoing' | '', string, 'true' | 'false' | '', string];

  const typeMatches = msgType ? messageType === msgType : true;
  let statusMatches = false;
  let attachmentsMatches = false;
  let timestampMatches = false;

  if (!msgStatusAsString || !status) {
    statusMatches = true;
  } else {
    const statuses = msgStatusAsString.split(',') as MessageStatus[];
    statusMatches = statuses.includes(status);
  }

  if (!areAttachmentsPresent) {
    attachmentsMatches = true;
  } else {
    attachmentsMatches = (hasAttachments && areAttachmentsPresent === 'true')
      || (!hasAttachments && areAttachmentsPresent === 'false');
  }

  if (
    !lifetime
    || (
      lifetime
      && (!lifetime.includes('>') && !lifetime.includes('<'))
    )
  ) {
    timestampMatches = true;
  } else {
    const timestampCondition = lifetime[0] as '>' | '<';
    const timestampValueAsString = lifetime.slice(1);
    const timestampValue = isNaN(Number(timestampValueAsString)) ? Date.now() : Number(timestampValueAsString);
    const timestampDiff = Date.now() - timestamp;
    timestampMatches = timestampCondition === '>'
      ? timestampDiff > timestampValue
      : timestampDiff < timestampValue;
  }

  return typeMatches && statusMatches && attachmentsMatches && timestampMatches;
}

export function getMessageActions(
  msg: ChatMessageView,
  $tr: (txt: string) => string,
  readonly?: boolean,
): Omit<ChatMessageAction, 'conditions'>[] {
  const { isIncomingMsg, status, timestamp } = msg;
  const messageType = isIncomingMsg ? 'incoming' : 'outgoing';
  return messageActions
    .filter(action => {
      const { conditions, allowInReadonlyMode, disabled = false } = action;
      if (disabled) {
        return false;
      }

      if (readonly && !allowInReadonlyMode) {
        return false;
      }

      if (isEmpty(conditions)) {
        return true;
      }

      let isAllowedAction = false;
      for (const condition of conditions) {
        const hasAttachments = (msg.chatMessageType === 'regular') && !!size(msg.attachments);
        isAllowedAction = isAllowedAction
          || checkAction({ messageType, status, hasAttachments, condition, timestamp });
        if (isAllowedAction) {
          break;
        }
      }

      return isAllowedAction;
    })
    .map(item => ({
      ...item,
      title: $tr(item.title),
    }));
}

export function makeChatException(fields: Partial<ChatException>): ChatException {
  return {
    ...fields,
    runtimeException: true,
    type: 'chat',
  };
}

export function prepareCheckAddrErrorText(
  addr: string,
  cause: AddressCheckResult,
  $tr: (txt: string, placeholder?: Record<string, string>) => string,
) {
  if (cause === 'not-present-at-domain') {
    return $tr('check.addr.error.unknownRecipient', { addr });
  }

  if (cause === 'found') {
    return $tr('check.addr.error.inboxIsFull', { addr });
  }

  if (cause === 'found-but-access-restricted') {
    return $tr('check.addr.error.senderNotAllowed', { addr });
  }

  if (cause === 'not-valid-public-key') {
    return $tr('check.addr.error.recipientPubKeyFailsValidation', { addr });
  }

  if (cause === 'no-service-for-domain') {
    return $tr('check.addr.error.serviceLocating', { addr });
  }

  return $tr('check.addr.error.unknown', { addr });
}
