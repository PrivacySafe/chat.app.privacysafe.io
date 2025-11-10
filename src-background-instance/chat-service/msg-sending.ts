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

// @ts-ignore
import { excerpt } from 'jsr:@dbushell/hyperless';
import { ChatsData } from '../dataset/index.ts';
import {
  ChatMessageAttachmentsInfo,
  ChatMessageHistory,
  ChatMessageHistoryErrors,
  LocalMetadataInDelivery,
} from '../../types/chat.types.ts';
import type { ChatService, SendingProgressInfo } from './index.ts';
import { chatIdOfChat, makeMsgDbEntry, recipientsInChat } from './common-transforms.ts';
import type {
  ChatIdObj,
  ChatMessageId,
  ChatIncomingMessage,
  ChatRegularMsgV1,
  RelatedMessage,
} from '../../types/asmail-msgs.types.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';
import { sendRegularMessage, sendSystemMessage } from '../utils/send-chat-msg.ts';
import { generateChatMessageId } from '../../shared-libs/chat-ids.ts';
import { ChatDbEntry } from '../dataset/versions/v2/chats-db.ts';
import { addFileTo, addFolderTo } from '../../shared-libs/attachments-container.ts';
import { AUTO_DELETE_MESSAGES_BY_ID, AUTODELETE_OFF } from '../../shared-libs/constants.ts';
import type { FileWithId, ReadonlyFsWithId } from '~/app.types.ts';
import { LOGO_ICON_AS_ARRAY } from '../../src-main/common/constants/files.ts';
import { AppSettings } from '../utils/app-settings.ts';
import type { OpenChatCmdArg } from '../../types/chat-commands.types.ts';

type AttachmentsContainer = web3n.asmail.AttachmentsContainer;
type ReadonlyFS = web3n.files.ReadonlyFS;

export class MsgSending {

  constructor(
    private readonly data: ChatsData,
    private readonly emit: ChatService['emit'],
    private readonly filesStore: ChatService['filesStore'],
    private readonly i18n: AppSettings,
    private readonly ownAddr: string,
    private readonly removeMessageFromInbox: ChatService['removeMessageFromInbox'],
  ) {
  }

  async sendRegularMessage(
    { chatId, chatMessageId, text, files, relatedMessage }: {
      chatId: ChatIdObj,
      chatMessageId?: string,
      text: string,
      files: (web3n.files.ReadonlyFile | web3n.files.ReadonlyFS)[] | undefined,
      relatedMessage: RelatedMessage | undefined,
    }): Promise<void> {
    const chat = this.data.findChat(chatId);
    if (!chat) {
      throw makeDbRecordException({ chatNotFound: true });
    }

    const { timestamp, chatMessageId: newChatMessageId } = generateChatMessageId();
    const msgId = chatMessageId || newChatMessageId;

    if (chatMessageId) {
      await this.data.updateMessageRecord({ chatId, chatMessageId }, { status: 'sending' });

      const { attachmentContainer } = await this.prepOutgoingAttachments(files);
      const recipients = recipientsInChat(chat, this.ownAddr);
      await sendRegularMessage(
        chatId,
        msgId,
        recipients,
        text,
        attachmentContainer,
        relatedMessage,
      );
    } else {
      const { settings } = chat;
      const autoDeleteMessagesId = settings?.autoDeleteMessages as '0' | '1' | '2' | '3' | '4' | '5';
      const autoDeleteTSValue = AUTO_DELETE_MESSAGES_BY_ID[autoDeleteMessagesId].value || AUTODELETE_OFF;

      const { attachments, attachmentContainer } = await this.prepOutgoingAttachments(files);

      const msg = makeMsgDbEntry('regular', msgId, {
        groupChatId: chat.isGroupChat ? chat.chatId : null,
        otoPeerCAddr: chat.isGroupChat ? null : chat.peerCAddr,
        timestamp,
        removeAfter: autoDeleteMessagesId === '0' ? 0 : timestamp + autoDeleteTSValue,
        body: text,
        attachments,
        relatedMessage: relatedMessage ?? null,
        settings: {},
      });

      await this.data.addMessage(msg);

      const recipients = recipientsInChat(chat, this.ownAddr);
      await sendRegularMessage(
        chatId,
        msgId,
        recipients,
        text,
        attachmentContainer,
        relatedMessage,
      );

      this.emit.message.added(msg);
    }
  }

  async cancelSendingMessage(deliveryId: string): Promise<void> {
    await w3n.mail?.delivery.rmMsg(deliveryId, true);
  }

  private async prepOutgoingAttachments(
    entities: (web3n.files.ReadonlyFile | web3n.files.ReadonlyFS)[] | undefined,
  ): Promise<{
    attachments: ChatMessageAttachmentsInfo[] | null;
    attachmentContainer?: AttachmentsContainer;
  }> {
    if (!entities || (entities.length === 0)) {
      return { attachments: null };
    }

    const attachments: ChatMessageAttachmentsInfo[] = [];
    const attachmentContainer = {} as AttachmentsContainer;
    for (const entity of entities) {
      const isFolder = !!(entity as ReadonlyFsWithId).listFolder;
      const entityStat = isFolder
        ? {
          name: entity.name,
          size: 0,
          isFolder: true,
          ...((entity as ReadonlyFsWithId).id && { id: (entity as ReadonlyFsWithId).id }),
        } : {
          name: entity.name,
          size: (await (entity as FileWithId).stat()).size!,
          isFolder: false,
          ...((entity as FileWithId).fileId && { id: (entity as FileWithId).fileId }),
        };

      const entityId = await this.filesStore.saveLink(entity);
      attachments.push({
        ...entityStat,
        id: entityId,
      });

      if (isFolder) {
        addFolderTo(attachmentContainer, entity as web3n.files.ReadonlyFS);
      } else {
        addFileTo(attachmentContainer, entity as web3n.files.ReadonlyFile);
      }
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
          isFolder: false,
        });
      } else {
        info.push({
          name: entry.name,
          size: 0,
          isFolder: true,
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

    const { settings } = chat;
    const autoDeleteMessagesId = settings?.autoDeleteMessages as '0' | '1' | '2' | '3' | '4' | '5';
    const autoDeleteTSValue = AUTO_DELETE_MESSAGES_BY_ID[autoDeleteMessagesId].value || AUTODELETE_OFF;

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
      removeAfter: autoDeleteMessagesId === '0' ? 0 : deliveryTS + autoDeleteTSValue,
    });

    await this.data.addMessage(msg);

    this.emit.message.added(msg);

    if (removeFromInbox) {
      await this.removeMessageFromInbox(msgId);
    }

    const icon = Uint8Array.from(LOGO_ICON_AS_ARRAY);
    const notificationTitle = await this.i18n.$tr('app.notification.new.message', { sender });

    await w3n.shell?.userNotifications?.addNotification({
      icon,
      title: notificationTitle,
      body: plainTxtBody ? excerpt(`<div>${plainTxtBody}</div>`, 50) : '',
      cmd: {
        cmd: 'open-chat-with',
        params: [{
          chatId: {
            isGroupChat: chat.isGroupChat,
            chatId: chat.isGroupChat ? chat.chatId : chat.peerCAddr,
          },
          peerAddress: sender,
        } as OpenChatCmdArg],
      },
    });

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


    let { status, history } = msg;
    if (progress.allDone) {
      status = progress.allDone === 'all-ok' ? 'sent' : 'error';

      if (progress.allDone === 'with-errors') {
        const errors = Object.keys(progress.recipients).reduce((res, address) => {
          const { err } = progress.recipients[address];
          if (err) {
            res![address] = err;
          }

          return res;
        }, {} as ChatMessageHistoryErrors);

        if (Object.keys(errors).length > 0) {
          if (!history) {
            history = {
              changes: [],
            } as ChatMessageHistory;
          }

          history.changes?.push({
            user: this.ownAddr,
            timestamp: Date.now(),
            type: 'error',
            value: errors,
          });
        }
      }
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
