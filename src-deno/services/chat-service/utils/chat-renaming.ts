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
import type { ChatIdObj, UpdatedChatNameSysMsgData } from '../../../../types/asmail-msgs.types.ts';
import type { ChatDbEntry, ChatSrvEmit, DB } from '../../../types/index.ts';
import { includesAddress } from '../../../../shared-libs/address-utils.ts';
import { generateChatMessageId } from '../../../../shared-libs/chat-ids.ts';
import { chatIdOfChat, excludeAddrFrom } from './_chats-related-methods.ts';
import { makeMsgDbEntry, msgDbEntryForIncomingSysMsg } from './_msgs-related-methods.ts';
import { sendSystemMessage } from '../../../utils/send-chat-msg.ts';
import { makeDbRecordException } from '../../../utils/exceptions.ts';

export async function chatRenaming({ data, emit, ownAddr }: { data: DB; emit: ChatSrvEmit; ownAddr: string }) {
  async function renameChat(chatId: ChatIdObj, name: string): Promise<void> {
    if (!chatId.isGroupChat) {
      throw new Error(`Only group chat can be renamed. One-to-one chat needs contact details update`);
    }
    const chat = data.findChat(chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    } else if (!chat.isGroupChat) {
      throw makeDbRecordException({ notGroupChat: true });
    } else if (!includesAddress(chat.admins, ownAddr)) {
      throw makeDbRecordException({ notAdmin: true });
    } else if (chat.name === name) {
      return;
    }

    // do local changes and notifications
    const updatedChat = await data.updateGroupChatRecord(chatId.chatId, { name });
    if (!updatedChat) {
      return;
    }
    emit.chat.updated(updatedChat);

    // send request to other members, recording it locally, as well
    const { chatMessageId, timestamp } = generateChatMessageId();
    const chatSystemData: UpdatedChatNameSysMsgData = {
      event: 'update:chatName',
      value: { name },
    };
    const msg = makeMsgDbEntry('system', chatMessageId, {
      groupChatId: chat.chatId,
      body: JSON.stringify(chatSystemData),
      timestamp,
    });
    await data.addMessage(msg);
    emit.message.added(msg);

    const recipients = excludeAddrFrom(Object.keys(chat.members), ownAddr);
    await sendSystemMessage({
      chatId,
      chatMessageId,
      recipients,
      chatSystemData,
    });
  }

  async function handleUpdateChatName(
    sender: string,
    chat: ChatDbEntry,
    chatMessageId: string,
    timestamp: number,
    chatSystemData: UpdatedChatNameSysMsgData,
  ): Promise<void> {
    if (!chatMessageId || !chat.isGroupChat || !includesAddress(chat.admins, sender)) {
      return;
    }

    const { name } = chatSystemData.value;
    const updatedChat = await data.updateGroupChatRecord(chat.chatId, { name });
    if (!updatedChat) {
      return;
    }
    emit.chat.updated(updatedChat);

    const chatId = chatIdOfChat(chat);
    await data.addMessage(msgDbEntryForIncomingSysMsg(sender, chatId, chatMessageId, timestamp, chatSystemData));
    const sysMsg = await data.getMessage({
      chatId: chatId,
      chatMessageId,
    });
    emit.message.added(sysMsg!);
  }

  return {
    renameChat,
    handleUpdateChatName,
  };
}
