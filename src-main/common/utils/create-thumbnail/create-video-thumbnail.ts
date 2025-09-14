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
import { createVideoThumbnail as makeVideoThumbnail, transformWeb3nFileToFile } from '@v1nt1248/3nclient-lib/utils';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { getFileByInfoFromMsg } from '@main/common/utils/files.helper';

export async function createVideoThumbnail(
  { fileId, incomingMsgId, targetSize = 200 }:
  { fileId: string; incomingMsgId?: string; targetSize?: number },
): Promise<Nullable<string>> {
  return getFileByInfoFromMsg(fileId, incomingMsgId)
    .then(file3n => {
      if (!file3n) {
        return null;
      }

      return transformWeb3nFileToFile(file3n);
    })
    .then(file => {
      if (!file) {
        return null;
      }

      return makeVideoThumbnail(file, targetSize, 5);
    });
}
