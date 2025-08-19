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
import { ChatMessageAttachmentsInfo, LocalMetadataInDelivery } from '../../types/chat.types.ts';
import { ChatIdObj, ChatMessageId } from '../../types/asmail-msgs.types.ts';
import type { ChatService, SendingProgressInfo } from './index.ts';
import { chatIdOfChat, makeMsgDbEntry, recipientsInChat } from './common-transforms.ts';
import { ChatIncomingMessage, ChatRegularMsgV1, RelatedMessage } from '../../types/asmail-msgs.types.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';
import { sendRegularMessage, sendSystemMessage } from '../utils/send-chat-msg.ts';
import { generateChatMessageId } from '../../shared-libs/chat-ids.ts';
import { ChatDbEntry } from '../dataset/versions/v2/chats-db.ts';
import { addFileTo } from '../../shared-libs/attachments-container.ts';

type AttachmentsContainer = web3n.asmail.AttachmentsContainer;
type ReadonlyFS = web3n.files.ReadonlyFS;

export class MsgSending {

  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly filesStore: ChatService['filesStore'],
    private readonly ownAddr: string,
    private readonly removeMessageFromInbox: ChatService['removeMessageFromInbox'],
  ) {
  }

  async sendRegularMessage(
    chatId: ChatIdObj, text: string,
    files: web3n.files.ReadonlyFile[] | undefined,
    relatedMessage: RelatedMessage | undefined,
  ): Promise<void> {
    const chat = this.data.findChat(chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    const { timestamp, chatMessageId } = generateChatMessageId();
    const { attachments, attachmentContainer } = await this.prepOutgoingAttachments(files);
    const msg = makeMsgDbEntry('regular', chatMessageId, {
      groupChatId: chat.isGroupChat ? chat.chatId : null,
      otoPeerCAddr: chat.isGroupChat ? null : chat.peerCAddr,
      timestamp,
      body: text,
      attachments,
      relatedMessage: relatedMessage ?? null,
    });
    await this.data.addMessage(msg);

    const recipients = recipientsInChat(chat, this.ownAddr);
    await sendRegularMessage(
      chatId,
      chatMessageId,
      recipients,
      text,
      attachmentContainer,
      relatedMessage,
    );

    this.emit.message.added(msg);
  }

  private async prepOutgoingAttachments(files: web3n.files.ReadonlyFile[] | undefined): Promise<{
    attachments: ChatMessageAttachmentsInfo[] | null;
    attachmentContainer?: AttachmentsContainer;
  }> {
    if (!files || (files.length === 0)) {
      return { attachments: null };
    }

    const attachments: ChatMessageAttachmentsInfo[] = [];
    const attachmentContainer = {} as AttachmentsContainer;
    for (const file of files) {
      const stats = await file.stat();
      const fileId = await this.filesStore.saveLink(file);
      attachments.push({
        name: file.name,
        size: stats.size!,
        id: fileId,
      });
      addFileTo(attachmentContainer, file);
    }
    return { attachments, attachmentContainer };
  }

  private async infoOfIncomingAttachments(
    attachmentsFS: ReadonlyFS | undefined,
  ): Promise<ChatMessageAttachmentsInfo[] | null> {
    if (!attachmentsFS) {
      return null;
    }

    const info: ChatMessageAttachmentsInfo[] = [];
    for (const entry of await attachmentsFS.listFolder('')) {
      if (entry.isFile) {
        const stats = await attachmentsFS.stat(entry.name);
        info.push({
          name: entry.name,
          size: stats.size!,
        });
      } else {
        info.push({
          name: entry.name,
          size: 1,
        });
      }
    }
    return info;
  }

  async handleRegularMsg(
    incomingMsg: ChatIncomingMessage,
    chat: ChatDbEntry,
    chatMsgBody: ChatRegularMsgV1,
  ): Promise<void> {
    const {
      msgId,
      sender,
      plainTxtBody,
      attachments: attachmentsFS,
      deliveryTS,
    } = incomingMsg;
    const { chatMessageId, relatedMessage } = chatMsgBody;
    const attachments = await this.infoOfIncomingAttachments(attachmentsFS);
    const removeFromInbox = !incomingMsg.attachments;
    const msg = makeMsgDbEntry('regular', chatMessageId, {
      isIncomingMsg: true,
      incomingMsgId: removeFromInbox ? null : msgId,
      groupChatId: chat.isGroupChat ? chat.chatId : null,
      otoPeerCAddr: chat.isGroupChat ? null : chat.peerCAddr,
      groupSender: chat.isGroupChat ? sender : null,
      body: plainTxtBody ?? null,
      attachments,
      relatedMessage: relatedMessage ?? null,
      timestamp: deliveryTS,
    });
    await this.data.addMessage(msg);

    this.emit.message.added(msg);

    if (removeFromInbox) {
      await this.removeMessageFromInbox(msgId);
    }

    await sendSystemMessage({
      chatId: chatIdOfChat(chat),
      recipients: [incomingMsg.sender],
      chatSystemData: {
        event: 'update:status',
        value: {
          chatMessageId,
          status: 'sent',
        },
      },
    });
  }

  async handleSendingProgress({ progress }: SendingProgressInfo): Promise<void> {
    const localMeta = progress.localMeta as LocalMetadataInDelivery;
    const chatMessageId: ChatMessageId = {
      chatId: localMeta.chatId,
      chatMessageId: localMeta.chatMessageId!,
    };

    const msg = await this.data.getMessage(chatMessageId);
    if (!msg) {
      return;
    }

    // eslint-disable-next-line prefer-const
    let { status, history } = msg;
    if (progress.allDone) {
      status = 'sent';
    } else {
      // TODO
      // XXX instead of return we can add more info depending on progress state,
      //     like different status, history entries
      return;
    }

    const updatedMsg = await this.data.updateMessageRecord(
      chatMessageId,
      { status, history },
    );
    this.emit.message.updated(updatedMsg);
  }
}
