/*
Copyright (C) 2024 - 2025 3NSoft Inc.

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

import { appChatsSrv, appDeliverySrv, fileLinkStoreSrv } from "@main/services/services-provider";
import { ChatMessageView, MessageType } from "~/chat.types";
import { sendSystemMessage } from "../chats/send-system-message";


export async function deleteChatMessage(
  message: ChatMessageView<MessageType>, notifyPeers: string[]|undefined
): Promise<void> {
  const { messageType, attachments, msgId, chatId, chatMessageId } = message;

  await appChatsSrv.deleteMessage({ chatMsgId: chatMessageId });

  if (messageType === 'incoming') {
    await appDeliverySrv.removeMessageFromInbox([msgId]);
  } else {
    await appDeliverySrv.removeMessageFromDeliveryList([msgId]);
    if (attachments && (attachments.length > 0)) {
    for (const attachment of attachments!) {
      const { id } = attachment;
      id && await fileLinkStoreSrv.deleteLink(id);
    }
    }
  }

  if (notifyPeers) {
    sendSystemMessage({
      chatId,
      chatMessageId,
      recipients: notifyPeers,
      event: 'delete:message',
      value: { chatMessageId },
    });
  }
}
