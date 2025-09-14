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
import size from 'lodash/size';
import { useChatStore } from '@main/common/store/chat.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import type { RegularMsgView } from '~/index';

export async function copyMessageToClipboard(message: RegularMsgView | undefined) {
  if (!message) {
    return;
  }

  const { body } = message;
  let copiedText = body;
  if ((message.chatMessageType === 'regular') && message.attachments) {
    copiedText += `${copiedText ? '\n' : ''}file('${message.attachments[0]['name']}')`;
  }

  await navigator.clipboard.writeText(copiedText);
}

export async function downloadAttachments(
  message: RegularMsgView | undefined,
  $tr: (key: string, placeholders?: Record<string, string>) => string,
): Promise<boolean | undefined> {
  if (!message || !message.attachments) {
    return;
  }

  const chatStore = useChatStore();
  const messagesStore = useMessagesStore();

  const { incomingMsgId, attachments, sender, timestamp } = message;
  const files = await messagesStore.getMessageAttachments(attachments, incomingMsgId);

  if (files && size(files) > 0) {
    const targetFolderName = `${chatStore.currentChat?.name}_${sender}_${dayjs(timestamp).format('YYYY-MM-DD')}`;
    const targetFs = await w3n.shell?.fileDialogs?.saveFolderDialog!(
      $tr('chat.message.attachments.download.title'),
      $tr('app.ok'),
      targetFolderName,
    );

    if (!targetFs) {
      return false;
    }

    for (const fileName of Object.keys(files)) {
      await targetFs.saveFile(files[fileName], fileName);
    }

    return true;
  } else {
    return false;
  }
}
