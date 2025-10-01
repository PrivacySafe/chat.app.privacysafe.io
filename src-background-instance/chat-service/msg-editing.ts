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

import { ChatsData } from '../dataset/index.ts';
import type { ChatIdObj } from '../../types/asmail-msgs.types.ts';
import type { ChatService } from './index.ts';
import type { ChatMessageHistory } from '~/chat.types.ts';

export class MsgEditing {
  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly ownAddr: string,
  ) {
  }

  private async getNecessaryMsgData(
    { chatId, chatMessageId }: { chatId: ChatIdObj; chatMessageId: string },
  ): Promise<{ body: string | null; history: ChatMessageHistory }> {
    const msg = await this.data.getMessage({ chatId, chatMessageId });
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

  async editMessage(
    { chatId, chatMessageId, updatedBody }:
    { chatId: ChatIdObj; chatMessageId: string; updatedBody: string },
  ) {
    const { body, history } = await this.getNecessaryMsgData({ chatId, chatMessageId });
    history.changes!.push({
      timestamp: Date.now(),
      user: this.ownAddr,
      type: 'body',
      value: body || '',
    });

    return this.data.updateMessageRecord(
      { chatId, chatMessageId },
      { body: updatedBody, history },
    );
  }


  async handleUpdateOfMessageBody(
    { user, chatId, chatMessageId, timestamp, body }:
    { user: string; chatId: ChatIdObj; chatMessageId: string; timestamp: number; body: string },
  ): Promise<void> {
    const { body: oldBody, history } = await this.getNecessaryMsgData({ chatId, chatMessageId });
    history.changes!.push({
      timestamp,
      user,
      type: 'body',
      value: oldBody || '',
    });

    const updatedMsg = await this.data.updateMessageRecord(
      { chatId, chatMessageId },
      { body, history },
    );

    await this.emit.message.updated(updatedMsg);
  }
}
