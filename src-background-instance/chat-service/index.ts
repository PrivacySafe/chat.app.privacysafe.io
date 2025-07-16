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

import { ObserversSet } from '../../shared-libs/observer-utils.ts';
import { includesAddress, toCanonicalAddress } from '../../shared-libs/address-utils.ts';
// @deno-types="../../shared-libs/ipc/ipc-service.d.ts"
import { MultiConnectionIPCWrap } from '../../shared-libs/ipc/ipc-service.js';
import type { ChatView, ChatMessageView, ChatListItemView, ChatMessageId, ChatIdObj, SingleChatView, GroupChatView, ChatIncomingMessage, OpenChatCmdArg, ChatMessageJsonBodyV1, ChatMessageJsonBodyPreV, ChatSystemMsgV1, ChatSystemMessageData, UpdateMembersSysMsgData, LocalMetadataInDelivery, RelatedMessage, OneToOneChatParameters, GroupChatParameters, RegularMsgView } from '../../types/index.ts';
import type { AddressCheckResult, ChatServiceIPC, FileLinkStoreService, UpdateEvent } from '../../types/services.types.ts';
import { ChatsData } from '../dataset/index.ts';
import { checkAddressExistenceForASMail } from '../utils/for-msg-sending.ts';
import { ChatCreation, inviteChatId } from './chat-creation.ts';
import { chatIdOfMsg, chatViewForGroupChat, chatViewForOTOChat, chatViewFromChatDbEntry, chatViewFromGroupChatDbEntry, msgViewFromDbEntry } from './common-transforms.ts';
import ChatRenaming from './chat-renaming.ts';
import { ChatLeaving } from './chat-leaving.ts';
import { ChatDeletion } from './chat-deletion.ts';
import { ChatMemberRemoval } from './chat-member-removal.ts';
import { MsgDeletion } from './msg-deletion.ts';
import { ChatMembersUpdating } from './chat-members-updating.ts';
import { MsgSending } from './msg-sending.ts';
import { MsgStatusUpdating } from './msg-status-updating.ts';
import { MsgReactions } from './msg-reaction.ts';
import { MsgEditing } from './msg-editing.ts';
import { ChatDbEntry, GroupChatDbEntry, OTOChatDbEntry } from '../dataset/versions/v1/chats-db.ts';
import { MsgDbEntry } from '../dataset/versions/v1/msgs-db.ts';
import { makeOutgoingFileLinkStore } from '../dataset/versions/v0-none/attachments.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';

export interface ChatMessagesHandler {
  handleIncomingMsg: (msg: ChatIncomingMessage) => Promise<void>;
  handleSendingProgress: (info: SendingProgressInfo) => Promise<void>;
}

export interface SendingProgressInfo {
  id: string;
  progress: web3n.asmail.DeliveryProgress;
}

export class ChatService implements ChatServiceIPC {

  private updateEventsObservers = new ObserversSet<UpdateEvent>();
  private readonly chatCreation: ChatCreation;
  private readonly chatRenaming: ChatRenaming;
  private readonly chatLeaving: ChatLeaving;
  private readonly chatDeletion: ChatDeletion;
  private readonly chatMemberRemoval: ChatMemberRemoval;
  private readonly chatMembersUpdating: ChatMembersUpdating;
  private readonly msgSending: MsgSending;
  private readonly msgDeletion: MsgDeletion;
  private readonly msgStatusUpdating: MsgStatusUpdating;
  private readonly msgReactions: MsgReactions;
  private readonly msgEditing: MsgEditing;

  private constructor(
    private readonly data: ChatsData,
    private readonly filesStore: FileLinkStoreService,
    private readonly ownAddr: string
  ) {
    const removeMessageFromInbox = this.removeMessageFromInbox.bind(this);
    this.chatCreation = new ChatCreation(
      this.data, this.emit, this.ownAddr, removeMessageFromInbox
    );
    this.chatRenaming = new ChatRenaming(
      this.data, this.emit, this.ownAddr
    );
    this.chatLeaving = new ChatLeaving(
      this.data, this.emit, this.ownAddr
    );
    this.chatDeletion = new ChatDeletion(
      this.data, this.emit, this.filesStore, this.ownAddr,
      removeMessageFromInbox
    );
    this.chatMemberRemoval = new ChatMemberRemoval(
      this.data, this.emit, this.filesStore, this.ownAddr,
      removeMessageFromInbox
    );
    this.chatMembersUpdating = new ChatMembersUpdating(
      this.data, this.emit, this.ownAddr
    );
    this.msgSending = new MsgSending(
      this.data, this.emit, this.filesStore, this.ownAddr,
      removeMessageFromInbox
    );
    this.msgDeletion = new MsgDeletion(
      this.data, this.emit, this.filesStore, this.ownAddr,
      removeMessageFromInbox
    );
    this.msgStatusUpdating = new MsgStatusUpdating(
      this.data, this.emit, this.ownAddr
    );
    this.msgReactions = new MsgReactions(
      this.data, this.emit, this.ownAddr
    );
    this.msgEditing = new MsgEditing(
      this.data, this.emit, this.ownAddr
    );
  }

  static async setupAndStartServing(ownAddr: string): Promise<{
    chats: ChatService;
    stopChatsService: () => void;
  }> {
    const data = await ChatsData.makeAndStart(ownAddr);
    const filesStore = await makeOutgoingFileLinkStore();
    const chats = new ChatService(data, filesStore, ownAddr);
    const stopChatsService = exposeServiceOnIPC(chats);
    return { chats, stopChatsService };
  }

  getLatestIncomingMsgTimestamp(): number|undefined {
    return this.data.getLatestIncomingMsgTimestamp();
  }

  makeChatMessagesHandler(): ChatMessagesHandler {
    return {
      handleIncomingMsg: this.handleIncomingMsg.bind(this),
      handleSendingProgress: this.handleSendingProgress.bind(this)
    };
  }

  private async handleIncomingMsg(msg: ChatIncomingMessage): Promise<void> {
    const checkMsgBody = checkChatMessageJSON(msg);
    if (!checkMsgBody) {
      return await this.removeMessageFromInbox(
        msg.msgId, `Incoming chat message ${msg.msgId} failed body check. Removing it from inbox.`
      );
    }
    const { chatId, chatMsgBody } = checkMsgBody;
    if (chatMsgBody.chatMessageType === 'invitation') {
      return await this.chatCreation.handleChatInvitation(msg);
    }
    const chat = this.data.findChat(chatId);
    if (chat) {
      if (chat.isGroupChat && !includesAddress(chat.members, msg.sender)) {
        return await this.removeMessageFromInbox(
          msg.msgId, `Sender ${msg.msgId} is not a member of group chat ${chat.chatId}. Removing it from inbox.`
        );
      }
      if (chatMsgBody.chatMessageType === 'system') {
        return await this.handleSystemMsg(msg, chat, chatMsgBody);
      } else if (chatMsgBody.chatMessageType === 'regular') {
        return await this.msgSending.handleRegularMsg(msg, chat, chatMsgBody);
      } else {
        return await this.removeMessageFromInbox(
          msg.msgId, `Incoming chat message ${msg.msgId} has unrecognized type. Removing it from inbox.`
        );
      }
    } else {
      return await this.removeMessageFromInbox(
        msg.msgId, `Incoming chat message ${msg.msgId}, type ${chatMsgBody.chatMessageType} has no known chat. Removing it from inbox.`
      );
    }
  }

  private async removeMessageFromInbox(
    msgId: string, logInfo?: string
  ): Promise<void> {
    if (logInfo) {
      await w3n.log('info', logInfo);
    }
    await w3n.mail!.inbox.removeMsg(msgId)
    .catch(async (e: web3n.asmail.InboxException) => {
      if (!e.msgNotFound) {
        await w3n.log(
          'error', `Error deleting message ${msgId} from INBOX. `, e
        );
      }
    });
  }

  private async handleSendingProgress(
    info: SendingProgressInfo
  ): Promise<void> {
    const { id, progress: { allDone, localMeta }} = info;
    try {
      const { chatMessageType } = localMeta as LocalMetadataInDelivery;
      if (chatMessageType === 'regular') {
        return await this.msgSending.handleSendingProgress(info);
      }
      // XXX other types may plug here to track sending progress

    } finally {
      if (allDone) {
        await this.removeMsgFromDelivery(id);
      }
    }
  }

  private async removeMsgFromDelivery(id: string): Promise<void> {
    await w3n.mail!.delivery.rmMsg(id)
    .catch(async err => {
      await w3n.log(
        'error', `Error deleting message ${id} from delivery. `, err
      );
    });
  }

  private async handleSystemMsg(
    msg: ChatIncomingMessage, chat: ChatDbEntry, chatMsgBody: ChatSystemMsgV1
  ): Promise<void> {
    const { chatSystemData: sysData, chatMessageId } = chatMsgBody;
    try {
      if (sysData.event === 'update:status') {
        await this.msgStatusUpdating.handleUpdateMessageStatus(
          msg.sender, chat, sysData.value, msg.deliveryTS
        );
      // } else if (sysData.event === 'update:reaction') {
      //   await this.msgReactions.handleReactionToMessage(
      //     msg.sender, chatId, chatMessageId!, msg.deliveryTS, sysData.value
      //   );
      // } else if (sysData.event === 'update:body') {
      //   await this.msgEditing.handleUpdateOfMessageBody(
      //     msg.sender, chatId, chatMessageId!, msg.deliveryTS, sysData.value
      //   );
      } else if (sysData.event === 'delete:message') {
        await this.msgDeletion.handleDeleteChatMessage(
          chat, chatMessageId!, sysData.value
        );
      } else if (sysData.event === 'update:members') {
        await this.chatMembersUpdating.handleUpdateChatMembers(
          msg.sender, chat, chatMessageId!, msg.deliveryTS, sysData.value
        );
      } else if (sysData.event === 'update:chatName') {
        await this.chatRenaming.handleUpdateChatName(
          msg.sender, chat, chatMessageId!, msg.deliveryTS, sysData
        );
      } else if (sysData.event === 'member-removed') {
        await this.chatMemberRemoval.handleMemberRemovedChat(
          msg.sender, chat, sysData.chatDeleted
        );
      // } else if (sysData.event === 'member-left') {
      //   await this.chatLeaving.handleMemberLeftChat(
      //     msg.sender, chatId, chatMessageId!, msg.deliveryTS
      //   );
      } else {
        await w3n.log(
          'info', `No handler found to handle chat system event ${(sysData as ChatSystemMessageData).event}`
        );
      }
    } finally {
      await this.removeMessageFromInbox(msg.msgId);
    }
  }

  private emitChatEvent(event: UpdateEvent): void {
    if (this.updateEventsObservers.isEmpty()) {

      // XXX this may turn into other notifications form later

      if ((event.updatedEntityType === 'message')
      && (event.event === 'added')) {
        const { chatId, sender } = event.msg;
        triggerMainUIOpenning(chatId, sender);
      }
    } else {
      this.updateEventsObservers.next(event);
    }
  }

  private readonly emit = {
    chat: {
      added: (chat: GroupChatDbEntry|OTOChatDbEntry) => this.emitChatEvent({
        updatedEntityType: 'chat',
        event: 'added',
        chat: chatViewFromChatDbEntry(chat)
      }),
      removed: (chatId: ChatIdObj) => this.emitChatEvent({
        updatedEntityType: 'chat',
        event: 'removed',
        chatId
      }),
      updated: (chat: GroupChatDbEntry|OTOChatDbEntry|undefined) => (chat ?
        this.emitChatEvent({
          updatedEntityType: 'chat',
          event: 'updated',
          chat: chatViewFromChatDbEntry(chat)
        }) :
        undefined
      ),
      allMsgsRemoved: (chatId: ChatIdObj) => this.emitChatEvent({
        updatedEntityType: 'chat',
        event: 'messages-removed',
        chatId
      })
    },
    message: {
      added: async (msg: MsgDbEntry) => this.emitChatEvent({
        updatedEntityType: 'message',
        event: 'added',
        msg: msgViewFromDbEntry(
          msg, await this.getRelatedMessage(msg), this.ownAddr
        )
      }),
      removed: (msgId: ChatMessageId) => this.emitChatEvent({
        updatedEntityType: 'message',
        event: 'removed',
        msgId
      }),
      updated: async (msg: MsgDbEntry|undefined) => (msg ?
        this.emitChatEvent({
          updatedEntityType: 'message',
          event: 'updated',
          msg: msgViewFromDbEntry(
            msg, await this.getRelatedMessage(msg), this.ownAddr
          )
        }) :
        undefined
      )
    }
  };

  private async getRelatedMessage(
    msg: MsgDbEntry
  ): Promise<RegularMsgView['relatedMessage']> {
    let msgId: ChatMessageId;
    const { relatedMessage } = msg;
    if (!relatedMessage) {
      return;
    } else if (relatedMessage.replyTo) {
      const replyTo = await this.data.getMessage({
        chatId: chatIdOfMsg(msg),
        chatMessageId: relatedMessage.replyTo.chatMessageId
      });
      if (replyTo) {
        return {
          replyTo: msgViewFromDbEntry(
            replyTo, undefined, this.ownAddr
          ) as RegularMsgView
        };
      } else {
        return { msgNotFound: true };
      }
    } else if (relatedMessage.forwardingOf) {
      const forwardingOf = await this.data.getMessage(
        relatedMessage.forwardingOf
      );
      if (forwardingOf) {
        return {
          forwardingOf: msgViewFromDbEntry(
            forwardingOf, undefined, this.ownAddr
          ) as RegularMsgView
        };
      } else {
        return { msgNotFound: true };
      }
    }
  }

  createOneToOneChat(
    params: Pick<SingleChatView, 'peerAddr' | 'name'> & { ownName: string; }
  ): Promise<ChatIdObj> {
    return this.chatCreation.createOneToOneChat(params);
  }

  acceptChatInvitation(
    chatId: ChatIdObj, chatMessageId: string, ownName: string
  ): Promise<void> {
    return this.chatCreation.acceptChatInvitation(
      chatId, chatMessageId, ownName
    );
  }

  createGroupChat(
    params: Pick<GroupChatView, 'chatId' | 'members' | 'admins' | 'name'>
  ): Promise<ChatIdObj> {
    return this.chatCreation.createGroupChat(params);
  }

  leaveChat(chatId: ChatIdObj): Promise<void> {
    return this.chatLeaving.leaveChat(chatId);
  }

  renameChat(chatId: ChatIdObj, newName: string): Promise<void> {
    return this.chatRenaming.renameChat(chatId, newName);
  }

  updateGroupMembers(
    chatId: ChatIdObj, changes: UpdateMembersSysMsgData['value']
  ): Promise<void> {
    return this.chatMembersUpdating.updateGroupMembers(chatId, changes);
  }

  async getChatList(): Promise<ChatListItemView[]> {
    return this.data.getChatList()
    .map(chat => {
      if (chat.isGroupChat) {
        return chatViewForGroupChat(chat, this.data);
      } else {
        return chatViewForOTOChat(chat, this.data);
      }
    });
  }

  sendRegularMessage(chatId: ChatIdObj, text: string,
    files: web3n.files.ReadonlyFile[] | undefined,
    relatedMessage: RelatedMessage | undefined
  ): Promise<void> {
    return this.msgSending.sendRegularMessage(
      chatId, text, files, relatedMessage
    );
  }

  deleteChat(chatId : ChatIdObj): Promise<void> {
    return this.chatDeletion.deleteChat(chatId);
  }

  async getChat(chatId: ChatIdObj): Promise<ChatListItemView|undefined> {
    const chat = this.data.findChat(chatId);
    return (chat ? chatViewFromChatDbEntry(chat) : undefined);
  }

  findChatEntry(chatId: ChatIdObj, throwIfMissing = false): ChatDbEntry|undefined {
    const chat = this.data.findChat(chatId);
    if (chat) {
      return chat;
    } else if (throwIfMissing) {
      throw makeDbRecordException({ chatNotFound: true });
    }
  }

  deleteMessagesInChat(
    chatId: ChatIdObj, deleteForEveryone: boolean
  ): Promise<void> {
    return this.msgDeletion.deleteMessagesInChat(chatId, deleteForEveryone);
  }

  async deleteMessage(
    id: ChatMessageId, deleteForEveryone: boolean
  ): Promise<void> {
    return this.msgDeletion.deleteMessage(id, deleteForEveryone);
  }

  async getMessage(id: ChatMessageId): Promise<ChatMessageView | undefined> {
    const found = await this.data.getMessage(id);
    if (found) {
      return msgViewFromDbEntry(
        found, await this.getRelatedMessage(found), this.ownAddr
      );
    }
  }

  async getMessagesByChat(chatId: ChatIdObj): Promise<ChatMessageView[]> {
    const msgViews: ChatMessageView[] = [];
    for (const msg of await this.data.getMessagesByChat(chatId)) {
      msgViews.push(msgViewFromDbEntry(
        msg, await this.getRelatedMessage(msg), this.ownAddr
      ));
    }
    return msgViews;
  }

  watch(obs: web3n.Observer<UpdateEvent>): () => void {
    this.updateEventsObservers.add(obs);
    return () => this.updateEventsObservers.delete(obs);
  }

  markMessageAsReadNotifyingSender(
    chatMessageId: ChatMessageId
  ): Promise<void> {
    return this.msgStatusUpdating.markMessageAsReadNotifyingSender(chatMessageId);
  }

  async checkAddressExistenceForASMail(
    addr: string
  ): Promise<AddressCheckResult> {
    return checkAddressExistenceForASMail(addr);
  }

  async getIncomingMessage(
    msgId: string
  ): Promise<ChatIncomingMessage | undefined> {
    try {
      return (await w3n.mail!.inbox.getMsg(msgId)) as ChatIncomingMessage;
    } catch (e) {
      await w3n.log('error', `Error getting the message ${msgId}.`, e);
    }
  }

}

function exposeServiceOnIPC(chats: ChatService): () => void {
  const srvWrapInternal = new MultiConnectionIPCWrap('AppChatsInternal');
  srvWrapInternal.exposeReqReplyMethods(chats, [
    'createOneToOneChat',
    'createGroupChat',
    'acceptChatInvitation',
    'getChatList',
    'renameChat',
    'leaveChat',
    'deleteChat',
    'updateGroupMembers',
    'deleteMessagesInChat',
    'deleteMessage',
    'getMessage',
    'getMessagesByChat',
    'sendRegularMessage',
    'markMessageAsReadNotifyingSender',
    'checkAddressExistenceForASMail',
    'getIncomingMessage'
  ]);
  srvWrapInternal.exposeObservableMethods(chats, [
    'watch'
  ]);
  return srvWrapInternal.startIPC();
}

function checkChatMessageJSON(
  msg: ChatIncomingMessage
): {
  chatMsgBody: ChatMessageJsonBodyV1;
  chatId: ChatIdObj;
}|undefined {
  const { sender, jsonBody } = msg;
  if (msg.jsonBody.v === undefined) {
    return preVtoV1(msg.jsonBody);
  } else if (jsonBody.v === 1) {
    const chatId = checkV1(jsonBody, sender);
    return (chatId ? { chatId, chatMsgBody: jsonBody } : undefined);
  }
}

function checkV1(
  jbV1: ChatMessageJsonBodyV1, sender: string
): ChatIdObj|undefined {
  const { groupChatId, chatMessageType } = jbV1;
  if (chatMessageType === 'invitation') {
    const { chatMessageId, inviteData } = jbV1;
    if (!isString(chatMessageId)) {
      return;
    }
    return inviteChatId(
      sender, inviteData
    );
  } else if (chatMessageType === 'system') {
    const { chatSystemData } = jbV1;
    if (!chatSystemData || (typeof chatSystemData !== 'object')) {
      return;
    }
  } else if (chatMessageType === 'regular') {
    const { chatMessageId } = jbV1;
    if (!isString(chatMessageId)) {
      return;
    }
  } else {
    return;
  }
  if ((typeof groupChatId === 'string') && groupChatId) {
    if (groupChatId.includes('@')) {
      return;
    } else {
      return { isGroupChat: true, chatId: groupChatId };
    }
  } else {
    return { isGroupChat: false, chatId: toCanonicalAddress(sender) };
  }
}

function isString(s: string|undefined): boolean {
  return ((typeof s === 'string') && (s.length > 0));
}

function preVtoV1(preVjsonBody: ChatMessageJsonBodyPreV): {
  chatMsgBody: ChatMessageJsonBodyV1;
  chatId: ChatIdObj;
  includedChat: ChatView;
}|undefined {

  // XXX not implemented

  return;
}

function triggerMainUIOpenning(
  chatId: ChatIdObj, sender: string
): void {
  w3n.shell!.startAppWithParams!(null, 'open-chat-with', {
    chatId,
    peerAddress: sender,
  } as OpenChatCmdArg)
  .catch(e => w3n.log('error', `Fail to start main UI component`, e));
}
