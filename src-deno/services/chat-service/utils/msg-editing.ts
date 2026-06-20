/*
 Copyright (C) 2026 3NSoft Inc.

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
import { ChatIdObj } from '../../../../types/asmail-msgs.types.ts';
import { ChatMessageHistory } from '../../../../types/chat.types.ts';
import type { ChatSrvEmit, DB } from '../../../types/index.ts';

export async function msgEditing({ data, emit, ownAddr }: { data: DB; emit: ChatSrvEmit; ownAddr: string }) {
  async function getNecessaryMsgData({
    chatId,
    chatMessageId,
  }: {
    chatId: ChatIdObj;
    chatMessageId: string;
  }): Promise<{ body: string | null; history: ChatMessageHistory }> {
    const msg = await data.getMessage({ chatId, chatMessageId });
    if (!msg) {
      throw Error(`The message with id ${JSON.stringify({ chatId, chatMessageId })} is not found`);
    }

    let { history } = msg;
    if (!history) {
      history = {
        changes: [],
      };
    }

    return { body: msg.body, history };
  }

  async function editMessage({
    chatId,
    chatMessageId,
    updatedBody,
  }: {
    chatId: ChatIdObj;
    chatMessageId: string;
    updatedBody: string;
  }) {
    const { body, history } = await getNecessaryMsgData({ chatId, chatMessageId });
    history.changes!.push({
      timestamp: Date.now(),
      user: ownAddr,
      type: 'body',
      value: body || '',
    });

    return data.updateMessageRecord({ chatId, chatMessageId }, { body: updatedBody, history });
  }

  async function handleUpdateOfMessageBody({
    user,
    chatId,
    chatMessageId,
    timestamp,
    body,
  }: {
    user: string;
    chatId: ChatIdObj;
    chatMessageId: string;
    timestamp: number;
    body: string;
  }): Promise<void> {
    const { body: oldBody, history } = await getNecessaryMsgData({ chatId, chatMessageId });
    history.changes!.push({
      timestamp,
      user,
      type: 'body',
      value: oldBody || '',
    });

    const updatedMsg = await data.updateMessageRecord({ chatId, chatMessageId }, { body, history });

    emit.message.updated(updatedMsg);
  }

  return {
    editMessage,
    handleUpdateOfMessageBody,
  };
}
