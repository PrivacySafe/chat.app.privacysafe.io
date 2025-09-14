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
import { getFileExtension, mimeTypes, resizeImage, uint8ToDataURL } from '@v1nt1248/3nclient-lib/utils';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { getFileByInfoFromMsg } from '@main/common/utils/files.helper';
import { scheduler } from 'timers/promises';

export async function createImageThumbnail(
  { fileId, incomingMsgId, targetSize = 200 }:
  { fileId: string; incomingMsgId?: string; targetSize?: number },
): Promise<Nullable<string>>  {
  // let fileName = '';
  //
  // return getFileByInfoFromMsg(fileId, incomingMsgId)
  //   .then(file => {
  //     if (!file) {
  //       return null;
  //     }
  //
  //     fileName = file.name;
  //     return file.readBytes()
  //   })
  //   .then(byteArray => {
  //     if (!byteArray) {
  //       return null;
  //     }
  //
  //     const fileExt = getFileExtension(fileName);
  //     const fileMimeType = mimeTypes[fileExt] || 'image/png';
  //     const base64Image = uint8ToDataURL(byteArray, fileMimeType);
  //     if (!base64Image) {
  //       return null;
  //     }
  //
  //     return resizeImage(base64Image, targetSize);
  //   });
  const file = await getFileByInfoFromMsg(fileId, incomingMsgId);
  if (!file) {
    return null;
  }
  await scheduler.yield();

  const fileName = file.name;
  const byteArray =  await file.readBytes()
  if (!byteArray) {
    return null;
  }
  await scheduler.yield();

  const fileExt = getFileExtension(fileName);
  const fileMimeType = mimeTypes[fileExt] || 'image/png';
  const base64Image = uint8ToDataURL(byteArray, fileMimeType);
  if (!base64Image) {
    return null;
  }
  await scheduler.yield();

  return resizeImage(base64Image, targetSize);
}
