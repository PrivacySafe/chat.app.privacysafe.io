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

export interface ItemForTemplate {
  templateIteratorKey?: string;
}

export function setTemplateIteratorKeyIn<T extends ItemForTemplate>(
  item: T, initItemOrUniqueKeyPrefix: T|string
): void {
  if (typeof initItemOrUniqueKeyPrefix === 'string') {
    item.templateIteratorKey = `${initItemOrUniqueKeyPrefix}|1`;
  } else {
    const { templateIteratorKey } = initItemOrUniqueKeyPrefix;
    if (!templateIteratorKey) {
      item.templateIteratorKey = `${initItemOrUniqueKeyPrefix}|1`;
    } else {
      const sepInd = templateIteratorKey.lastIndexOf('|');
      if (sepInd < 0) {
        item.templateIteratorKey = `${templateIteratorKey}|1`;
      } else {
        item.templateIteratorKey = `${
          templateIteratorKey.substring(0, sepInd)
        }|${parseInt(templateIteratorKey.substring(sepInd+1)) + 1}`;
      }
    }
  }
}
