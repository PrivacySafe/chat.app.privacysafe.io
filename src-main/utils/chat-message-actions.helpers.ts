import { get } from 'lodash';
import { useChatsStore } from '../store/chats.store';
import { fileLinkStoreSrv } from '../services/services-provider';
import type { ChatMessageView, MessageType } from '~/index';
import { useChatStore } from '@main/store/chat.store';

export function getMessageFromCurrentChat(
  { msgId, chatMessageId }: { msgId?: string | null, chatMessageId?: string | null },
): ChatMessageView<MessageType> | undefined {
  if (!msgId && !chatMessageId) {
    return undefined;
  }

  const { currentChatMessages } = useChatStore();

  if (chatMessageId) {
    return currentChatMessages.find(m => m.chatMessageId === chatMessageId);
  }

  if (msgId) {
    return currentChatMessages.find(m => m.msgId === msgId);
  }
}

export async function copyMessageToClipboard(message: ChatMessageView<MessageType> | undefined) {
  if (!message) {
    return;
  }

  const { body, attachments } = message;
  let copiedText = body;
  if (attachments) {
    copiedText += `${copiedText ? '\n' : ''}file('${get(attachments, [0, 'name'])}')`;
  }

  await navigator.clipboard.writeText(copiedText);
}

export async function downloadFile(message: ChatMessageView<MessageType> | undefined): Promise<boolean | undefined> {
  if (!message) {
    return;
  }

  const { getMessage } = useChatsStore();
  const { messageType, msgId } = message;
  let file: web3n.files.ReadonlyFile | web3n.files.Linkable | null | undefined;
  let fileName = '';

  if (messageType === 'incoming') {
    const incomingMessage = await getMessage(msgId);
    const { attachments } = incomingMessage!;
    if (attachments) {
      const folder = await attachments.readonlySubRoot('');
      const fileList = await folder.listFolder('');
      fileName = get(fileList, [0, 'name'], '');
      file = await folder.readonlyFile(fileName);
    }
  } else {
    const { attachments } = message;
    const linkId = get(attachments, [0, 'id']);
    file = await fileLinkStoreSrv.getFile(linkId!);
    fileName = get(file, 'name', '');
  }

  if (file) {
    const outFile = await w3n.shell?.fileDialogs?.saveFileDialog!('Save file', '', fileName);
    if (outFile) {
      await outFile.copy(file as web3n.files.File);
      return true;
    }
  } else {
    return false;
  }
}
