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
import type { ChatService } from './index.ts';
import type { ChatIdObj } from '~/asmail-msgs.types.ts';
import type { ChatMessageHistory, ChatMessageReaction } from '~/chat.types.ts';

export class MsgReactions {

  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly ownAddr: string,
  ) {
  }

  private async getNecessaryMsgData(
    { chatId, chatMessageId }: { chatId: ChatIdObj; chatMessageId: string },
  ): Promise<{ history: ChatMessageHistory; reactions: Record<string, ChatMessageReaction> }> {
    const msg = await this.data.getMessage({ chatId, chatMessageId });
    if (!msg) {
      throw Error(`The message with id ${JSON.stringify({ chatId, chatMessageId })} is not found`);
    }

    let { history, reactions } = msg;
    if (!history) {
      history = {
        changes: [],
      };
    }

    if (!reactions) {
      reactions = {};
    }

    return { history, reactions };
  }

  async changeMessageReactions(
    { chatId, chatMessageId, updatedReactions }:
    { chatId: ChatIdObj; chatMessageId: string; updatedReactions: Record<string, ChatMessageReaction> },
  ) {
    const { history, reactions } = await this.getNecessaryMsgData({ chatId, chatMessageId });
    history.changes!.push({
      timestamp: Date.now(),
      user: this.ownAddr,
      type: 'reaction',
      value: reactions,
    });

    return this.data.updateMessageRecord(
      { chatId, chatMessageId },
      { history, reactions: updatedReactions },
    );
  }

  async handleChangeOfReactions(
    { user, chatId, chatMessageId, timestamp, reactions }:
    {
      user: string;
      chatId: ChatIdObj;
      chatMessageId: string;
      timestamp: number;
      reactions: Record<string, ChatMessageReaction>,
    },
  ): Promise<void> {
    const { reactions: oldReactions, history } = await this.getNecessaryMsgData({ chatId, chatMessageId });
    history.changes!.push({
      timestamp,
      user,
      type: 'reaction',
      value: oldReactions,
    });

    const updatedMsg = await this.data.updateMessageRecord(
      { chatId, chatMessageId },
      { history, reactions },
    );

    await this.emit.message.updated(updatedMsg);
  }
}
