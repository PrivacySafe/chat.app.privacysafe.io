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

import type { RegularMsgView } from '~/index';
import { useChatStore } from '@main/store/chat.store';

export async function copyMessageToClipboard(
  message: RegularMsgView|undefined
) {
  if (!message) {
    return;
  }

  const { body } = message;
  let copiedText = body;
  if ((message.chatMessageType === 'regular') && message.attachments) {
    copiedText += `${copiedText ? '\n' : ''}file('${message.attachments[0][ 'name']}')`;
  }

  await navigator.clipboard.writeText(copiedText);
}

export async function downloadFile(
  message: RegularMsgView|undefined
): Promise<boolean|undefined> {
  if (!message || !message.attachments) {
    return;
  }

  const { getMessageAttachments } = useChatStore();
  const { attachments } = message;
  const files = await getMessageAttachments(attachments);

  if (files && (files.length > 0)) {
    const file = files[0];
    const outFile = await w3n.shell?.fileDialogs?.saveFileDialog!('Save file', '', file.name);
    if (outFile) {
      await outFile.copy(file);
      return true;
    }
  } else {
    return false;
  }
}
