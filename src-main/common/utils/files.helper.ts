/*
 Copyright (C) 2025 3NSoft Inc.

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
import type { Nullable } from '@v1nt1248/3nclient-lib';
import type { ReadonlyFile } from '~/app.types';
import { chatService, fileLinkStoreSrv } from '@main/common/services/external-services.ts';

export async function getFileByInfoFromMsg(
  fileId: string,
  incomingMsgId?: string,
): Promise<Nullable<ReadonlyFile>> {
  if (incomingMsgId) {
    const msg = await chatService.getIncomingMessage(incomingMsgId);
    if (!msg) {
      return null;
    }

    const file = await msg.attachments?.readonlyFile(fileId);

    return file || null;
  }

  const file = await fileLinkStoreSrv.getFile(fileId);
  return file || null;
}

export async function saveFileFromMsg(
  fileId: string,
  $tr: (key: string, placeholders?: Record<string, string>) => string,
  incomingMsgId?: string,
): Promise<boolean | undefined> {
  const file = await getFileByInfoFromMsg(fileId, incomingMsgId);
  if (!file) {
    return false;
  }

  const targetFile = await w3n.shell?.fileDialogs?.saveFileDialog!(
    $tr('chat.message.file.download'),
    '',
    file.name,
  );

  if (!targetFile) {
    return false;
  }

  try {
    const bytes = await file.readBytes();
    await targetFile.writeBytes(bytes!);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}
