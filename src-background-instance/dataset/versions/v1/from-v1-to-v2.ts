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

// @deno-types="../../../../shared-libs/sqlite-on-3nstorage/index.d.ts"
import { objectFromQueryExecResult, SQLiteOn3NStorage } from '../../../../shared-libs/sqlite-on-3nstorage/index.js';
import { turnMembersStringArrayToV2 } from '../v0-none/read-v0.ts';
import { GroupChatTableFields } from '../v2/chats-db.ts';

/**
 * Difference between v1 and v2 is only in json field values.
 * Table are same as v2.
 */
export async function turnV1jsonFieldValueToV2InChatDb(chats: SQLiteOn3NStorage): Promise<void> {
  const [sqlValue] = chats.db.exec(
    `SELECT chatId, members FROM group_chats`
  );
  const initialValues = objectFromQueryExecResult<{
    chatId: string; members: GroupChatTableFields['members'];
  }>(sqlValue);
  for (const { chatId, members: membersV1 } of initialValues) {
    if (!Array.isArray(membersV1)) {
      continue;
    }
    const membersV2 = turnMembersStringArrayToV2(membersV1);
    chats.db.exec(
      `UPDATE group_chats
       SET members=$members, status='on'
       WHERE chatId=$chatId
      `,
      {
        '$members': JSON.stringify(membersV2),
        '$chatId': chatId
      }
    );
  }

  chats.db.exec(`UPDATE oto_chats SET status='on'`);

  await chats.saveToFile({ skipUpload: true });
}