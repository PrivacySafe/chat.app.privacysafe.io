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

// @deno-types="../../shared-libs/ipc/ipc-service.d.ts"
import { ObserversSet } from '../../shared-libs/observer-utils.ts';
import { includesAddress, toCanonicalAddress } from '../../shared-libs/address-utils.ts';
import { MultiConnectionIPCWrap } from '../../shared-libs/ipc/ipc-service.js';
import type {
  ChatView,
  ChatMessageView,
  ChatListItemView,
  ChatMessageId,
  ChatIdObj,
  SingleChatView,
  GroupChatView,
  ChatIncomingMessage,
  OpenChatCmdArg,
  ChatMessageJsonBodyV1,
  ChatMessageJsonBodyPreV,
  ChatSystemMsgV1,
  ChatSystemMessageData,
  UpdateMembersSysMsgData,
  LocalMetadataInDelivery,
  RelatedMessage, UpdateAdminsSysMsgData,
} from '../../types/index.ts';
import type {
  AddressCheckResult,
  ChatServiceIPC,
  FileLinkStoreService,
  UpdateEvent,
} from '../../types/services.types.ts';
import { ChatsData } from '../dataset/index.ts';
import { checkAddressExistenceForASMail, ensureAllAddressesExist } from '../utils/for-msg-sending.ts';
import { ChatCreation, inviteChatId } from './chat-creation.ts';
import {
  chatViewForGroupChat,
  chatViewForOTOChat,
  chatViewFromChatDbEntry,
  msgViewFromDbEntry,
} from './common-transforms.ts';
import ChatRenaming from './chat-renaming.ts';
import { ChatDeletion } from './chat-deletion.ts';
import { ChatMemberRemoval } from './chat-member-removal.ts';
import { MsgDeletion } from './msg-deletion.ts';
import { ChatMembersUpdating } from './chat-members-updating.ts';
import { MsgSending } from './msg-sending.ts';
import { MsgStatusUpdating } from './msg-status-updating.ts';
import { MsgReactions } from './msg-reaction.ts';
import { MsgEditing } from './msg-editing.ts';
import { ChatDbEntry, GroupChatDbEntry, OTOChatDbEntry } from '../dataset/versions/v2/chats-db.ts';
import { MsgDbEntry } from '../dataset/versions/v2/msgs-db.ts';
import { makeOutgoingFileLinkStore } from '../dataset/versions/v0-none/attachments.ts';
import { makeDbRecordException } from '../utils/exceptions.ts';
import { generateChatMessageId } from '../../shared-libs/chat-ids.ts';

export interface ChatMessagesHandler {
  handleIncomingMsg: (msg: ChatIncomingMessage) => Promise<void>;
  handleSendingProgress: (info: SendingProgressInfo) => Promise<void>;
}

export interface SendingProgressInfo {
  id: string;
  progress: web3n.asmail.DeliveryProgress;
}

function exposeServiceOnIPC(chats: ChatService): () => void {
  const srvWrapInternal = new MultiConnectionIPCWrap('AppChatsInternal');
  srvWrapInternal.exposeReqReplyMethods(chats, [
    'createOneToOneChat',
    'createGroupChat',
    'acceptChatInvitation',
    'getChatList',
    'getChatsWithVideoCall',
    'getChat',
    'renameChat',
    'deleteChat',
    'updateGroupMembers',
    'updateGroupAdmins',
    'deleteMessagesInChat',
    'deleteMessage',
    'getMessage',
    'getMessagesByChat',
    'sendRegularMessage',
    'markMessageAsReadNotifyingSender',
    'checkAddressExistenceForASMail',
    'getIncomingMessage',
  ]);
  srvWrapInternal.exposeObservableMethods(chats, [
    'watch',
  ]);
  return srvWrapInternal.startIPC();
}

function checkChatMessageJSON(msg: ChatIncomingMessage): {
  chatMsgBody: ChatMessageJsonBodyV1;
  chatId: ChatIdObj;
} | undefined {
  const { sender, jsonBody } = msg;
  if (msg.jsonBody.v === undefined) {
    return preVtoV1(msg.jsonBody);
  }

  if (jsonBody.v === 1) {
    const chatId = checkV1(jsonBody, sender);
    return chatId ? { chatId, chatMsgBody: jsonBody } : undefined;
  }
}

function checkV1(jbV1: ChatMessageJsonBodyV1, sender: string): ChatIdObj | undefined {
  const { groupChatId, chatMessageType } = jbV1;

  switch (chatMessageType) {
    case 'invitation': {
      const { chatMessageId, inviteData } = jbV1;
      if (!isString(chatMessageId)) {
        return;
      }
      return inviteChatId(sender, inviteData);
    }

    case 'system': {
      const { chatSystemData } = jbV1;
      if (!chatSystemData || (typeof chatSystemData !== 'object')) {
        return;
      }
      break;
    }

    case 'regular': {
      const { chatMessageId } = jbV1;
      if (!isString(chatMessageId)) {
        return;
      }
      break;
    }

    default:
      return;
  }

  if ((typeof groupChatId === 'string') && groupChatId) {
    return !groupChatId.includes('@') ? { isGroupChat: true, chatId: groupChatId } : undefined;
  }

  return { isGroupChat: false, chatId: toCanonicalAddress(sender) };
}

function isString(s: string | undefined): boolean {
  return (typeof s === 'string') && (s.length > 0);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function preVtoV1(preVjsonBody: ChatMessageJsonBodyPreV): {
  chatMsgBody: ChatMessageJsonBodyV1;
  chatId: ChatIdObj;
  includedChat: ChatView;
} | undefined {
  // TODO not implemented
  return;
}

function triggerMainUIOpenning(chatId: ChatIdObj, sender: string): void {
  w3n.shell!.startAppWithParams!(null, 'open-chat-with', {
    chatId,
    peerAddress: sender,
  } as OpenChatCmdArg)
    .catch(e => w3n.log('error', `Fail to start main UI component`, e));
}

export class ChatService implements ChatServiceIPC {
  private updateEventsObservers = new ObserversSet<UpdateEvent>();
  private readonly chatCreation: ChatCreation;
  private readonly chatRenaming: ChatRenaming;
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
    private readonly ownAddr: string,
    public readonly getChatsWithVideoCall: () => Promise<ChatIdObj[]>,
  ) {
    const removeMessageFromInbox = this.removeMessageFromInbox.bind(this);

    this.chatCreation = new ChatCreation(this.data, this.emit, this.ownAddr, removeMessageFromInbox);

    this.chatRenaming = new ChatRenaming(this.data, this.emit, this.ownAddr);

    this.chatDeletion = new ChatDeletion(
      this.data,
      this.emit,
      this.filesStore,
      this.ownAddr,
      removeMessageFromInbox,
    );

    this.chatMemberRemoval = new ChatMemberRemoval(
      this.data,
      this.emit,
      this.filesStore,
      this.ownAddr,
      removeMessageFromInbox,
    );

    this.chatMembersUpdating = new ChatMembersUpdating(this.data, this.emit, this.ownAddr);

    this.msgSending = new MsgSending(
      this.data,
      this.emit,
      this.filesStore,
      this.ownAddr,
      removeMessageFromInbox,
    );

    this.msgDeletion = new MsgDeletion(
      this.data,
      this.emit,
      this.filesStore,
      this.ownAddr,
      removeMessageFromInbox,
    );

    this.msgStatusUpdating = new MsgStatusUpdating(this.data, this.emit, this.ownAddr);

    this.msgReactions = new MsgReactions(this.data, this.emit, this.ownAddr);

    this.msgEditing = new MsgEditing(this.data, this.emit, this.ownAddr);
  }

  static async setupAndStartServing(
    ownAddr: string,
    getChatsWithVideoCall: () => Promise<ChatIdObj[]>,
  ): Promise<{
    chats: ChatService;
    stopChatsService: () => void;
  }> {
    const data = await ChatsData.makeAndStart(ownAddr);
    const filesStore = await makeOutgoingFileLinkStore();
    const chats = new ChatService(data, filesStore, ownAddr, getChatsWithVideoCall);
    const stopChatsService = exposeServiceOnIPC(chats);

    return { chats, stopChatsService };
  }

  getLatestIncomingMsgTimestamp(): number | undefined {
    return this.data.getLatestIncomingMsgTimestamp();
  }

  makeChatMessagesHandler(): ChatMessagesHandler {
    return {
      handleIncomingMsg: this.handleIncomingMsg.bind(this),
      handleSendingProgress: this.handleSendingProgress.bind(this),
    };
  }

  private canReceiveRegularMessages(chat: ChatDbEntry): boolean {
    const { isGroupChat, status } = chat;
    if (isGroupChat) {
      const { members } = chat as GroupChatDbEntry;
      const { hasAccepted } = members[this.ownAddr];
      return hasAccepted && ['on', 'partially-on', 'accepted'].includes(status);
    }

    return ['on', 'accepted'].includes(status);
  }

  private async handleIncomingMsg(msg: ChatIncomingMessage): Promise<void> {
    const checkMsgBody = checkChatMessageJSON(msg);
    if (!checkMsgBody) {
      return await this.removeMessageFromInbox(
        msg.msgId,
        `Incoming chat message ${msg.msgId} failed body check. Removing it from inbox.`,
      );
    }

    const { chatId, chatMsgBody } = checkMsgBody;

    if (chatMsgBody.chatMessageType === 'invitation') {
      return await this.chatCreation.handleChatInvitation(msg);
    }

    const chat = this.data.findChat(chatId);

    if (!chat) {
      return await this.removeMessageFromInbox(
        msg.msgId,
        `Incoming chat message ${msg.msgId}, type ${chatMsgBody.chatMessageType} has no known chat. Removing it from inbox.`,
      );
    }


    if (chat.isGroupChat && !includesAddress(Object.keys(chat.members), msg.sender)) {
      return await this.removeMessageFromInbox(
        msg.msgId,
        `Sender ${msg.msgId} is not a member of group chat ${chat.chatId}. Removing it from inbox.`,
      );
    }

    if (chatMsgBody.chatMessageType === 'system') {
      return await this.handleSystemMsg(msg, chat, chatMsgBody);
    }

    if (chatMsgBody.chatMessageType === 'regular') {
      return this.canReceiveRegularMessages(chat)
        ? await this.msgSending.handleRegularMsg(msg, chat, chatMsgBody)
        : void 0;
    }

    return await this.removeMessageFromInbox(
      msg.msgId,
      `Incoming chat message ${msg.msgId} has unrecognized type. Removing it from inbox.`,
    );
  }

  private async removeMessageFromInbox(msgId: string, logInfo?: string): Promise<void> {
    if (logInfo) {
      await w3n.log('info', logInfo);
    }

    await w3n.mail!.inbox.removeMsg(msgId)
      .catch(async (e: web3n.asmail.InboxException) => {
        if (!e.msgNotFound) {
          await w3n.log('error', `Error deleting message ${msgId} from INBOX. `, e);
        }
      });
  }

  private async handleSendingProgress(info: SendingProgressInfo): Promise<void> {
    const { id, progress: { allDone, localMeta } } = info;

    try {
      const { chatMessageType } = localMeta as LocalMetadataInDelivery;
      if (chatMessageType === 'regular') {
        return await this.msgSending.handleSendingProgress(info);
      }

      // TODO other types may plug here to track sending progress
    } finally {
      if (allDone) {
        await this.removeMsgFromDelivery(id);
      }
    }
  }

  private async removeMsgFromDelivery(id: string): Promise<void> {
    await w3n.mail!.delivery.rmMsg(id)
      .catch(async err => {
        await w3n.log('error', `Error deleting message ${id} from delivery. `, err);
      });
  }

  private async handleSystemMsg(
    msg: ChatIncomingMessage,
    chat: ChatDbEntry,
    chatMsgBody: ChatSystemMsgV1,
  ): Promise<void> {
    const { chatSystemData: sysData, chatMessageId } = chatMsgBody;

    try {
      switch (sysData.event) {
        case 'update:status':
          return this.msgStatusUpdating.handleUpdateMessageStatus(msg.sender, chat, sysData.value, msg.deliveryTS);

        case 'delete:message':
          return await this.msgDeletion.handleDeleteChatMessage(chat, sysData.value);

        case 'update:members':
          return await this.chatMembersUpdating.handleUpdateChatMembers(
            msg.sender,
            chat,
            chatMessageId!,
            msg.deliveryTS,
            sysData.value,
          );

        case 'update:admins':
          return await this.chatMembersUpdating.handleUpdateChatAdmins(
            msg.sender,
            chat,
            chatMessageId!,
            msg.deliveryTS,
            sysData.value,
          );

        case 'update:chatName':
          return await this.chatRenaming.handleUpdateChatName(
            msg.sender,
            chat,
            chatMessageId!,
            msg.deliveryTS,
            sysData,
          );

        case 'member-removed':
          return await this.chatMemberRemoval.handleMemberRemovedChat(msg.sender, chat, sysData.chatDeleted);

        // case 'update:reaction':
        //   return await this.msgReactions.handleReactionToMessage(
        //     msg.sender,
        //     chatId,
        //     chatMessageId!,
        //     msg.deliveryTS,
        //     sysData.value,
        //   );

        // case 'update:body':
        //   return await this.msgEditing.handleUpdateOfMessageBody(
        //     msg.sender,
        //     chatId,
        //     chatMessageId!,
        //     msg.deliveryTS,
        //     sysData.value,
        //   );

        default:
          await w3n.log(
            'info',
            `No handler found to handle chat system event ${(sysData as ChatSystemMessageData).event}`,
          );
          break;
      }
    } finally {
      await this.removeMessageFromInbox(msg.msgId);
    }
  }

  private emitChatEvent(event: UpdateEvent): void {
    if (this.updateEventsObservers.isEmpty()) {
      // TODO this may turn into other notifications form later
      if (event.updatedEntityType === 'message' && event.event === 'added') {
        const { chatId, sender } = event.msg;
        triggerMainUIOpenning(chatId, sender);
      }
    } else {
      this.updateEventsObservers.next(event);
    }
  }

  private readonly emit = {
    chat: {
      added: (chat: GroupChatDbEntry | OTOChatDbEntry) => this.emitChatEvent({
        updatedEntityType: 'chat',
        event: 'added',
        chat: chatViewFromChatDbEntry(chat),
      }),

      removed: (chatId: ChatIdObj) => this.emitChatEvent({
        updatedEntityType: 'chat',
        event: 'removed',
        chatId,
      }),

      updated: (chat: GroupChatDbEntry | OTOChatDbEntry | undefined) => chat
        ? this.emitChatEvent({
          updatedEntityType: 'chat',
          event: 'updated',
          chat: chatViewFromChatDbEntry(chat),
        })
        : undefined,

      allMsgsRemoved: (chatId: ChatIdObj) => this.emitChatEvent({
        updatedEntityType: 'chat',
        event: 'messages-removed',
        chatId,
      }),
    },

    message: {
      added: async (msg: MsgDbEntry) => {
        const sendingMsg = msgViewFromDbEntry(msg, msg.relatedMessage ?? undefined, this.ownAddr);

        return this.emitChatEvent({
          updatedEntityType: 'message',
          event: 'added',
          msg: sendingMsg,
        });
      },

      removed: (msgId: ChatMessageId) => this.emitChatEvent({
        updatedEntityType: 'message',
        event: 'removed',
        msgId,
      }),

      updated: async (msg: MsgDbEntry | undefined) => (msg ?
          this.emitChatEvent({
            updatedEntityType: 'message',
            event: 'updated',
            msg: msgViewFromDbEntry(msg, msg.relatedMessage ?? undefined, this.ownAddr),
          }) :
          undefined
      ),
    },
  };

  async createOneToOneChat(
    params: Pick<SingleChatView, 'peerAddr' | 'name'> & { ownName?: string },
  ): Promise<ChatIdObj> {
    const res = await ensureAllAddressesExist({ [params.peerAddr]: { hasAccepted: false } });

    if (res.status === 'error') {
      throw {
        runtimeException: true,
        type: 'chat-creation',
        failedAddresses: res.errorData,
      };
    }

    let ownName = params.ownName;
    if (!ownName) {
      const user = await w3n.mail?.getUserId();
      ownName = user!.substring(0, user!.indexOf('@'));
    }

    return this.chatCreation.createOneToOneChat({
      ...params,
      ownName,
    });
  }

  acceptChatInvitation(chatId: ChatIdObj, chatMessageId: string, ownName: string): Promise<void> {
    return this.chatCreation.acceptChatInvitation(chatId, chatMessageId, ownName);
  }

  async createGroupChat(params: Pick<GroupChatView, 'chatId' | 'members' | 'name'>): Promise<ChatIdObj> {
    const res = await ensureAllAddressesExist(params.members);
    if (res.status === 'error') {
      throw {
        runtimeException: true,
        type: 'chat-creation',
        failedAddresses: res.errorData,
      };
    }

    const user = await w3n.mail?.getUserId();
    let groupMembers = { ...params.members };
    if (!includesAddress(Object.keys(groupMembers), user!)) {
      groupMembers = {
        ...groupMembers,
        [user!]: { hasAccepted: true },
      };
    }

    return this.chatCreation.createGroupChat({
      ...params,
      members: groupMembers,
      admins: [user!],
    });
  }

  renameChat(chatId: ChatIdObj, newName: string): Promise<void> {
    return this.chatRenaming.renameChat(chatId, newName);
  }

  updateGroupMembers(chatId: ChatIdObj, changes: UpdateMembersSysMsgData['value']): Promise<void> {
    return this.chatMembersUpdating.updateGroupMembers(chatId, changes);
  }

  updateGroupAdmins(chatId: ChatIdObj, changes: UpdateAdminsSysMsgData['value']): Promise<void> {
    return this.chatMembersUpdating.updateGroupAdmins(chatId, changes);
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

  sendRegularMessage(
    chatId: ChatIdObj,
    text: string,
    files: web3n.files.ReadonlyFile[] | undefined,
    relatedMessage: RelatedMessage | undefined,
  ): Promise<void> {
    return this.msgSending.sendRegularMessage(chatId, text, files, relatedMessage);
  }

  deleteChat(chatId: ChatIdObj): Promise<void> {
    return this.chatDeletion.deleteChat(chatId);
  }

  async getChat(chatId: ChatIdObj): Promise<ChatListItemView | undefined> {
    const chat = this.data.findChat(chatId);
    return chat ? chatViewFromChatDbEntry(chat) : undefined;
  }

  findChatEntry(chatId: ChatIdObj, throwIfMissing = false): ChatDbEntry | undefined {
    const chat = this.data.findChat(chatId);

    if (chat) {
      return chat;
    }

    if (throwIfMissing) {
      throw makeDbRecordException({ chatNotFound: true });
    }
  }

  postProcessingForVideoChat(): {
    doAfterStartCall: (
      { chatId, direction, sender }:
      { chatId: ChatIdObj; direction: 'incoming' | 'outgoing'; sender?: string },
    ) => Promise<void>,
    doAfterEndCall: (chatId: ChatIdObj) => Promise<void>,
  } {
    const doAfterStartCall = async (
      { chatId, direction, sender }:
      { chatId: ChatIdObj; direction: 'incoming' | 'outgoing'; sender?: string },
    ): Promise<void> => {
      console.log('### DO AFTER START CALL => ', JSON.stringify({
        chatId,
        direction,
        sender,
      }, null, 2));
      const { chatMessageId, timestamp } = generateChatMessageId();
      const msg: MsgDbEntry = {
        groupChatId: chatId.isGroupChat ? chatId.chatId : null,
        otoPeerCAddr: chatId.isGroupChat ? null : chatId.chatId,
        chatMessageId,
        isIncomingMsg: false,
        incomingMsgId: null,
        groupSender: chatId.isGroupChat ? sender || this.ownAddr : null,
        body: JSON.stringify({
          event: 'call',
          value: {
            sender: sender || this.ownAddr,
            direction,
          },
        }),
        attachments: null,
        chatMessageType: 'system',
        relatedMessage: null,
        status: null,
        timestamp,
        history: null,
        reactions: null,
      };
      await this.data.addMessage(msg);
      return this.emit.message.added(msg);
    };

    const doAfterEndCall = async (chatId: ChatIdObj): Promise<void> => {
      console.log('### DO AFTER END CALL 000 => ', JSON.stringify(chatId, null, 2));
      const now = Date.now();
      const notRegularMsgs = this.data.getNotRegularMessagesByChat(chatId);
      const systemMsgs = notRegularMsgs
        .filter(m => m.chatMessageType === 'system')
        .sort((a, b) => a.timestamp - b.timestamp ? -1 : 1);
      console.log('### DO AFTER END CALL 111 => ', JSON.stringify(systemMsgs, null, 2));

      if (systemMsgs.length > 0) {
        const lastSystemMsg = systemMsgs[0];
        const lastSystemMsgBody = lastSystemMsg.body
          ? JSON.parse(lastSystemMsg.body) as ChatSystemMessageData
          : null;

        if (!lastSystemMsgBody || lastSystemMsgBody.event !== 'call') {
          return;
        }

        lastSystemMsgBody.value.endTimestamp = now;

        console.log('### DO AFTER END CALL 222 => ', JSON.stringify(lastSystemMsgBody, null, 2));

        const updatedMsg = await this.data.updateMessageRecord(
          { chatId, chatMessageId: lastSystemMsg.chatMessageId },
          { body: JSON.stringify(lastSystemMsgBody) },
        );
        console.log('### DO AFTER END CALL 333 => ', JSON.stringify(updatedMsg, null, 2));
        this.emit.message.updated(updatedMsg);
      }
    };

    return {
      doAfterStartCall,
      doAfterEndCall,
    };
  }

  deleteMessagesInChat(chatId: ChatIdObj, deleteForEveryone: boolean): Promise<void> {
    return this.msgDeletion.deleteMessagesInChat(chatId, deleteForEveryone);
  }

  async deleteMessage(id: ChatMessageId, deleteForEveryone: boolean): Promise<void> {
    return this.msgDeletion.deleteMessage(id, deleteForEveryone);
  }

  async getMessage(id: ChatMessageId): Promise<ChatMessageView | undefined> {
    const found = await this.data.getMessage(id);
    if (found) {
      return msgViewFromDbEntry(found, found.relatedMessage ?? undefined, this.ownAddr);
    }
  }

  async getMessagesByChat(chatId: ChatIdObj): Promise<ChatMessageView[]> {
    const msgViews: ChatMessageView[] = [];

    for (const msg of await this.data.getMessagesByChat(chatId)) {
      msgViews.push(msgViewFromDbEntry(msg, msg.relatedMessage ?? undefined, this.ownAddr));
    }

    return msgViews;
  }

  watch(obs: web3n.Observer<UpdateEvent>): () => void {
    this.updateEventsObservers.add(obs);
    return () => this.updateEventsObservers.delete(obs);
  }

  markMessageAsReadNotifyingSender(chatMessageId: ChatMessageId): Promise<void> {
    return this.msgStatusUpdating.markMessageAsReadNotifyingSender(chatMessageId);
  }

  async checkAddressExistenceForASMail(addr: string): Promise<AddressCheckResult> {
    return checkAddressExistenceForASMail(addr);
  }

  async getIncomingMessage(msgId: string): Promise<ChatIncomingMessage | undefined> {
    try {
      return (await w3n.mail!.inbox.getMsg(msgId)) as ChatIncomingMessage;
    } catch (e) {
      await w3n.log('error', `Error getting the message ${msgId}.`, e);
    }
  }
}
