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
import type {
  ChatIdObj,
  ChatIncomingMessage,
  ChatMessageId,
  ChatOutgoingMessage,
  ChatSystemMessageData,
  ChatSystemMsgV1,
  RelatedMessage,
  UpdatedMsgBodySysMsgData,
  UpdatedMsgReactionSysMsgData,
  WebRTCMsgBodySysMsgData,
} from '../../../types/asmail-msgs.types.ts';
import type {
  ChatListItemView,
  ChatMessageReaction,
  ChatMessageView,
  GroupChatView,
  LocalMetadataInDelivery,
  RegularMsgView,
  SingleChatView,
} from '../../../types/chat.types.ts';
import type { UpdateEvent } from '../../../types/services.types.ts';
import type {
  ChatDbEntry,
  ChatMessagesHandler,
  ChatSrv,
  ChatSrvEmit,
  GroupChatDbEntry,
  LocalDataStore,
  MsgDbEntry,
  OTOChatDbEntry,
  SendingProgressInfo,
} from '../../types/index.ts';
import { MultiConnectionIPCWrap } from '../../../shared-libs/ipc/ipc-service.js';
import { ObserversSet } from '../../../shared-libs/observer-utils.ts';
import { includesAddress } from '../../../shared-libs/address-utils.ts';
import { generateChatMessageId } from '../../../shared-libs/chat-ids.ts';
import { dataset } from '../../dataset/index.ts';
import { fileStoreService } from '../file-store-service/file-store-service.ts';
import { AppSettings } from '../../utils/app-settings.ts';
import { makeDbRecordException } from '../../utils/exceptions.ts';
import { checkAddressExistenceForASMail, ensureAllAddressesExist } from '../../utils/for-msg-sending.ts';
import { sendSystemDeletableMessage as _sendSystemDeletableMessage } from '../../utils/send-chat-msg.ts';
import {
  canReceiveRegularMessages,
  getIncomingMessage,
  msgViewFromDbEntry,
  removeMessageFromInbox,
  removeMsgFromDelivery,
} from './utils/_msgs-related-methods.ts';
import {
  chatViewForGroupChat,
  chatViewForOTOChat,
  chatViewFromChatDbEntry,
} from './utils/_chats-related-methods.ts';
import { chatCreation as _chatCreation } from './utils/chat-creation.ts';
import { chatRenaming as _chatRenaming } from './utils/chat-renaming.ts';
import { chatSettingUp as _chatSettingUp } from './utils/chat-setting-up.ts';
import { chatDeletion as _chatDeletion } from './utils/chat-deletion.ts';
import { chatMemberRemoval as _chatMemberRemoval } from './utils/chat-member-removal.ts';
import { chatMembersUpdating as _chatMembersUpdating } from './utils/chat-members-updating.ts';
import { webRTCCallReaction as _webRTCCallReaction } from './utils/webrtc-call-reaction.ts';
import { msgSending as _msgSending } from './utils/msg-sending.ts';
import { msgDeletion as _msgDeletion } from './utils/msg-deletion.ts';
import { msgStatusUpdating as _msgStatusUpdating } from './utils/msg-status-updating.ts';
import { msgReactions as _msgReactions } from './utils/msg-reactions.ts';
import { msgEditing as _msgEditing } from './utils/msg-editing.ts';
import { checkChatMessageJSON } from './utils/_msgs-related-methods.ts';

function exposeServiceOnIPC(chats: ChatSrv): () => void {
  const srvWrapInternal = new MultiConnectionIPCWrap('AppChatsInternal');
  srvWrapInternal.exposeReqReplyMethods(chats, [
    'createOneToOneChat',
    'createGroupChat',
    'acceptChatInvitation',
    'getChatList',
    'getChat',
    'findChatEntry',
    'renameChat',
    'chatSetUp',
    'deleteChat',
    'updateGroupMembers',
    'updateGroupAdmins',
    'deleteMessagesInChat',
    'deleteMessage',
    'deleteMessages',
    'deleteExpiredMessages',
    'getLatestIncomingMsgTimestamp',
    'getMessage',
    'getMessagesByChat',
    'getRecentReactions',
    'sendRegularMessage',
    'markMessageAsReadNotifyingSender',
    'checkAddressExistenceForASMail',
    'cancelSendingMessage',
    'getIncomingMessage',
    'updateEarlySentMessage',
    'changeMessageReaction',
    'sendSystemDeletableMessage',
    'makeAndSaveMsgToDb',
  ]);
  srvWrapInternal.exposeObservableMethods(chats, ['watch']);
  return srvWrapInternal.startIPC();
}

export async function chatService(
  ownAddr: string,
  localDataStoreSrv: LocalDataStore,
): Promise<{ chatsSrv: ChatSrv; stopChatsService: () => void }> {
  const data = await dataset();
  const filesStore = await fileStoreService();
  const appSettings = new AppSettings();

  const updateEventsObservers = new ObserversSet<UpdateEvent>();

  function watch(obs: web3n.Observer<UpdateEvent>): () => void {
    updateEventsObservers.add(obs);
    return () => updateEventsObservers.delete(obs);
  }

  function emitChatEvent(event: UpdateEvent): void {
    if (updateEventsObservers.isEmpty()) {
      // TODO this may turn into other notifications form later
      // if (event.updatedEntityType === 'message' && event.event === 'added') {
      //   const { chatId, sender } = event.msg;
      //   triggerMainUIOpening(chatId, sender);
      // }
    } else {
      updateEventsObservers.next(event);
    }
  }

  const emitEventAfterAction: ChatSrvEmit = {
    chat: {
      added: (chat: GroupChatDbEntry | OTOChatDbEntry) =>
        emitChatEvent({
          updatedEntityType: 'chat',
          event: 'added',
          chat: chatViewFromChatDbEntry(chat),
        }),

      removed: (chatId: ChatIdObj) =>
        emitChatEvent({
          updatedEntityType: 'chat',
          event: 'removed',
          chatId,
        }),

      updated: (chat: GroupChatDbEntry | OTOChatDbEntry | undefined) =>
        chat
          ? emitChatEvent({
              updatedEntityType: 'chat',
              event: 'updated',
              chat: chatViewFromChatDbEntry(chat),
            })
          : undefined,

      allMsgsRemoved: (chatId: ChatIdObj) =>
        emitChatEvent({
          updatedEntityType: 'chat',
          event: 'messages-removed',
          chatId,
        }),

      webRTCCall: (msg: ChatIncomingMessage | ChatOutgoingMessage, value: WebRTCMsgBodySysMsgData['value']) =>
        emitChatEvent({
          updatedEntityType: 'chat',
          event: 'webRTCCall',
          value: {
            msg,
            data: value,
          },
        }),
    },

    message: {
      added: (msg: MsgDbEntry) => {
        const sendingMsg = msgViewFromDbEntry(msg, msg.relatedMessage ?? undefined, ownAddr);

        return emitChatEvent({
          updatedEntityType: 'message',
          event: 'added',
          msg: sendingMsg,
        });
      },

      removed: (msgId: ChatMessageId) =>
        emitChatEvent({
          updatedEntityType: 'message',
          event: 'removed',
          msgId,
        }),

      removedMultiple: (chatMsgIds: ChatMessageId[]) =>
        emitChatEvent({
          updatedEntityType: 'message',
          event: 'removed-multiple',
          chatMsgIds,
        }),

      updated: (msg: MsgDbEntry | undefined) =>
        msg
          ? emitChatEvent({
              updatedEntityType: 'message',
              event: 'updated',
              msg: msgViewFromDbEntry(msg, msg.relatedMessage ?? undefined, ownAddr),
            })
          : undefined,
    },
  };

  const chatCreation = await _chatCreation({ ownAddr, data, appSettings, emit: emitEventAfterAction });
  const chatRenaming = await _chatRenaming({ ownAddr, data, emit: emitEventAfterAction });
  const chatSettingUp = await _chatSettingUp({ ownAddr, data, emit: emitEventAfterAction });
  const chatDeletion = await _chatDeletion({ ownAddr, data, emit: emitEventAfterAction, filesStore });
  const chatMemberRemoval = await _chatMemberRemoval({ ownAddr, data, emit: emitEventAfterAction });
  const chatMembersUpdating = await _chatMembersUpdating({ ownAddr, data, emit: emitEventAfterAction });
  const webRTCCallReaction = await _webRTCCallReaction(emitEventAfterAction);
  const msgSending = await _msgSending({ ownAddr, data, appSettings, emit: emitEventAfterAction, filesStore });
  const msgDeletion = await _msgDeletion({ ownAddr, data, emit: emitEventAfterAction, filesStore });
  const msgStatusUpdating = await _msgStatusUpdating({ ownAddr, data, emit: emitEventAfterAction });
  const msgReactions = await _msgReactions({ ownAddr, data, emit: emitEventAfterAction });
  const msgEditing = await _msgEditing({ ownAddr, data, emit: emitEventAfterAction });

  function getAppDeviceId() {
    return localDataStoreSrv.getAppDeviceId();
  }

  async function handleIncomingMsg(msg: ChatIncomingMessage): Promise<void> {
    const checkMsgBody = checkChatMessageJSON(msg);
    if (!checkMsgBody) {
      return await removeMessageFromInbox(
        msg.msgId,
        `Incoming chat message ${msg.msgId} failed body check. Removing it from inbox.`,
      );
    }

    const { chatId, chatMsgBody } = checkMsgBody;

    if (chatMsgBody.chatMessageType === 'invitation') {
      return await chatCreation.handleChatInvitation(msg);
    }

    const chat = data.findChat(chatId);

    if (!chat) {
      return await removeMessageFromInbox(
        msg.msgId,
        `Incoming chat message ${msg.msgId}, type ${chatMsgBody.chatMessageType} has no known chat. Removing it from inbox.`,
      );
    }

    if (chat.isGroupChat && !includesAddress(Object.keys(chat.members), msg.sender)) {
      return await removeMessageFromInbox(
        msg.msgId,
        `Sender ${msg.msgId} is not a member of group chat ${chat.chatId}. Removing it from inbox.`,
      );
    }

    if (chatMsgBody.chatMessageType === 'system') {
      return await handleSystemMsg(msg, chat, chatMsgBody);
    }

    if (chatMsgBody.chatMessageType === 'regular') {
      return canReceiveRegularMessages(chat, ownAddr)
        ? await msgSending.handleRegularMsg(msg, chat, chatMsgBody)
        : void 0;
    }

    return await removeMessageFromInbox(
      msg.msgId,
      `Incoming chat message ${msg.msgId} has unrecognized type. Removing it from inbox.`,
    );
  }

  async function handleSendingProgress(info: SendingProgressInfo): Promise<void> {
    emitChatEvent({
      updatedEntityType: 'message',
      event: 'sending-progress',
      data: info,
    });

    const {
      id,
      progress: { allDone, localMeta },
    } = info;

    try {
      const { chatMessageType } = localMeta as LocalMetadataInDelivery;
      if (chatMessageType === 'regular') {
        return await msgSending.handleSendingProgress(info);
      }

      // TODO other types may plug here to track sending progress
    } finally {
      if (allDone) {
        await removeMsgFromDelivery(id);
      }
    }
  }

  function makeChatMessagesHandler(): ChatMessagesHandler {
    return {
      handleIncomingMsg,
      handleSendingProgress,
    };
  }

  async function handleSystemMsg(
    msg: ChatIncomingMessage,
    chat: ChatDbEntry,
    chatMsgBody: ChatSystemMsgV1,
  ): Promise<void> {
    const { chatSystemData: sysData, chatMessageId } = chatMsgBody;

    try {
      switch (sysData.event) {
        case 'update:status':
          return msgStatusUpdating.handleUpdateMessageStatus(msg.sender, chat, sysData.value, msg.deliveryTS);

        case 'delete:message':
          return await msgDeletion.handleDeleteChatMessage(chat, sysData.value);

        case 'update:members':
          return await chatMembersUpdating.handleUpdateChatMembers(
            msg.sender,
            chat,
            chatMessageId!,
            msg.deliveryTS,
            sysData.value,
          );

        case 'update:admins':
          return await chatMembersUpdating.handleUpdateChatAdmins(
            msg.sender,
            chat,
            chatMessageId!,
            msg.deliveryTS,
            sysData.value,
          );

        case 'update:chatName':
          return await chatRenaming.handleUpdateChatName(
            msg.sender,
            chat,
            chatMessageId!,
            msg.deliveryTS,
            sysData,
          );

        case 'update:settings':
          return await chatSettingUp.handleUpdateSettings(
            msg.sender,
            chat,
            chatMessageId!,
            msg.deliveryTS,
            sysData,
          );

        case 'member-removed':
          return await chatMemberRemoval.handleMemberRemovedChat(msg.sender, chat, sysData.chatDeleted);

        case 'webrtc-call':
          return await webRTCCallReaction.handleReactionToWebRTCCall(msg, {
            ...sysData.value,
            chatId: {
              isGroupChat: chat.isGroupChat,
              chatId: chat.isGroupChat ? chat.chatId : chat.peerCAddr,
            },
          });

        case 'update:body':
          return await msgEditing.handleUpdateOfMessageBody({
            user: msg.sender,
            chatId: chat.isGroupChat
              ? { isGroupChat: true, chatId: chat.chatId }
              : { isGroupChat: false, chatId: chat.peerCAddr },
            chatMessageId: (sysData as UpdatedMsgBodySysMsgData).value.chatMessageId,
            timestamp: msg.deliveryTS,
            body: (sysData as UpdatedMsgBodySysMsgData).value.body,
          });

        case 'update:reactions':
          return await msgReactions.handleChangeOfReactions({
            user: msg.sender,
            chatId: chat.isGroupChat
              ? { isGroupChat: true, chatId: chat.chatId }
              : { isGroupChat: false, chatId: chat.peerCAddr },
            chatMessageId: (sysData as UpdatedMsgReactionSysMsgData).value.chatMessageId,
            timestamp: msg.deliveryTS,
            reactions: (sysData as UpdatedMsgReactionSysMsgData).value.reactions,
          });

        default:
          await w3n.log(
            'info',
            `No handler found to handle chat system event ${(sysData as ChatSystemMessageData).event}`,
          );
          break;
      }
    } finally {
      await removeMessageFromInbox(msg.msgId);
    }
  }

  async function createOneToOneChat(
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

    return chatCreation.createOneToOneChat({
      ...params,
      ownName,
    });
  }

  async function acceptChatInvitation(chatId: ChatIdObj, chatMessageId: string, ownName: string): Promise<void> {
    return chatCreation.acceptChatInvitation(chatId, chatMessageId, ownName);
  }

  async function createGroupChat(params: Pick<GroupChatView, 'chatId' | 'members' | 'name'>): Promise<ChatIdObj> {
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

    return chatCreation.createGroupChat({
      ...params,
      members: groupMembers,
      admins: [user!],
    });
  }

  async function getChatList(): Promise<ChatListItemView[]> {
    return data.getChatList().map(chat => {
      if (chat.isGroupChat) {
        return chatViewForGroupChat(chat);
      } else {
        return chatViewForOTOChat(chat);
      }
    });
  }

  async function getChat(chatId: ChatIdObj): Promise<ChatListItemView | undefined> {
    const chat = data.findChat(chatId);
    return chat ? chatViewFromChatDbEntry(chat) : undefined;
  }

  function findChatEntry(chatId: ChatIdObj, throwIfMissing = false): ChatDbEntry | undefined {
    const chat = data.findChat(chatId);

    if (chat) {
      return chat;
    }

    if (throwIfMissing) {
      throw makeDbRecordException({ chatNotFound: true });
    }
  }

  function postProcessingForVideoChat(): {
    doAfterStartCall: ({
      chatId,
      direction,
      sender,
    }: {
      chatId: ChatIdObj;
      direction: 'incoming' | 'outgoing';
      sender?: string;
    }) => Promise<void>;
    doAfterEndCall: (chatId: ChatIdObj) => Promise<void>;
  } {
    const doAfterStartCall = async ({
      chatId,
      direction,
      sender,
    }: {
      chatId: ChatIdObj;
      direction: 'incoming' | 'outgoing';
      sender?: string;
    }): Promise<void> => {
      const { chatMessageId, timestamp } = generateChatMessageId();
      const msg: MsgDbEntry = {
        groupChatId: chatId.isGroupChat ? chatId.chatId : null,
        otoPeerCAddr: chatId.isGroupChat ? null : chatId.chatId,
        chatMessageId,
        isIncomingMsg: false,
        incomingMsgId: null,
        groupSender: chatId.isGroupChat ? sender || ownAddr : null,
        body: JSON.stringify({
          event: 'call',
          value: {
            sender: sender || ownAddr,
            direction,
          },
        }),
        attachments: null,
        chatMessageType: 'system',
        relatedMessage: null,
        status: null,
        timestamp,
        removeAfter: 0,
        history: null,
        reactions: null,
        settings: null,
      };
      await data.addMessage(msg);
      emitEventAfterAction.message.added(msg);
    };

    const doAfterEndCall = async (chatId: ChatIdObj): Promise<void> => {
      const now = Date.now();
      const notRegularMsgs = data.getNotRegularMessagesByChat(chatId);
      const systemMsgs = notRegularMsgs
        .filter(m => m.chatMessageType === 'system')
        .sort((a, b) => (a.timestamp - b.timestamp ? -1 : 1));

      if (systemMsgs.length > 0) {
        const lastSystemMsg = systemMsgs[0];
        const lastSystemMsgBody = lastSystemMsg.body
          ? (JSON.parse(lastSystemMsg.body) as ChatSystemMessageData)
          : null;

        if (!lastSystemMsgBody || lastSystemMsgBody.event !== 'call') {
          return;
        }

        lastSystemMsgBody.value.endTimestamp = now;

        const updatedMsg = await data.updateMessageRecord(
          { chatId, chatMessageId: lastSystemMsg.chatMessageId },
          { body: JSON.stringify(lastSystemMsgBody) },
        );

        emitEventAfterAction.message.updated(updatedMsg);
      }
    };

    return {
      doAfterStartCall,
      doAfterEndCall,
    };
  }

  async function getMessage(id: ChatMessageId): Promise<ChatMessageView | undefined> {
    const found = await data.getMessage(id);
    if (found) {
      return msgViewFromDbEntry(found, found.relatedMessage ?? undefined, ownAddr);
    }
  }

  async function getMessagesByChat(chatId: ChatIdObj): Promise<ChatMessageView[]> {
    const msgViews: ChatMessageView[] = [];

    for (const msg of await data.getMessagesByChat(chatId)) {
      msgViews.push(msgViewFromDbEntry(msg, msg.relatedMessage ?? undefined, ownAddr));
    }

    return msgViews;
  }

  async function sendRegularMessage({
    chatId,
    chatMessageId,
    text,
    files,
    relatedMessage,
  }: {
    chatId: ChatIdObj;
    chatMessageId?: string;
    text: string;
    files: (web3n.files.ReadonlyFile | web3n.files.ReadonlyFS)[] | undefined;
    relatedMessage: RelatedMessage | undefined;
  }): Promise<void> {
    if (chatMessageId) {
      await msgStatusUpdating.updateMessageStatus({ chatId, chatMessageId }, 'sending');
    }

    return msgSending.sendRegularMessage({ chatId, chatMessageId, text, files, relatedMessage });
  }

  async function cancelSendingMessage(deliveryId: string, chatMsgId: ChatMessageId): Promise<void> {
    await msgSending.cancelSendingMessage(deliveryId);
    await msgStatusUpdating.updateMessageStatus(chatMsgId, 'canceled');
    // TODO change msg status
  }

  async function sendSystemDeletableMessage({
    chatId,
    recipients,
    chatMessageId,
    chatSystemData,
  }: { chatId: ChatIdObj; recipients: string[] } & Pick<
    ChatSystemMsgV1,
    'chatMessageId' | 'chatSystemData'
  >): Promise<void> {
    return _sendSystemDeletableMessage({
      chatId,
      recipients,
      chatMessageId,
      chatSystemData,
    });
  }

  async function updateEarlySentMessage({
    chatId,
    chatMessageId,
    updatedBody,
  }: {
    chatId: ChatIdObj;
    chatMessageId: string;
    updatedBody: string;
  }): Promise<ChatMessageView | undefined> {
    const updatedMessage = await msgEditing.editMessage({ chatId, chatMessageId, updatedBody });
    if (!updatedMessage) {
      return undefined;
    }

    const chat = await getChat(chatId);
    const recipients = chat!.isGroupChat
      ? Object.keys(chat!.members).filter(addr => addr !== ownAddr)
      : [chat!.peerAddr];

    sendSystemDeletableMessage({
      chatId,
      recipients,
      chatMessageId,
      chatSystemData: {
        event: 'update:body',
        value: {
          chatMessageId,
          body: updatedBody,
        },
      } as UpdatedMsgBodySysMsgData,
    });

    return msgViewFromDbEntry(
      updatedMessage,
      updatedMessage.relatedMessage as RegularMsgView['relatedMessage'],
      ownAddr,
    );
  }

  async function changeMessageReaction({
    chatId,
    chatMessageId,
    updatedReactions,
  }: {
    chatId: ChatIdObj;
    chatMessageId: string;
    updatedReactions: Record<string, ChatMessageReaction>;
  }): Promise<ChatMessageView | undefined> {
    const updatedMessage = await msgReactions.changeMessageReactions({
      chatId,
      chatMessageId,
      updatedReactions,
    });
    if (!updatedMessage) {
      return undefined;
    }

    const chat = await getChat(chatId);
    const recipients = chat!.isGroupChat
      ? Object.keys(chat!.members).filter(addr => addr !== ownAddr)
      : [chat!.peerAddr];

    sendSystemDeletableMessage({
      chatId,
      recipients,
      chatMessageId,
      chatSystemData: {
        event: 'update:reactions',
        value: {
          chatMessageId,
          reactions: updatedReactions,
        },
      } as UpdatedMsgReactionSysMsgData,
    });

    return msgViewFromDbEntry(
      updatedMessage,
      updatedMessage.relatedMessage as RegularMsgView['relatedMessage'],
      ownAddr,
    );
  }

  async function makeAndSaveMsgToDb(ownAddr: string, msgData: Partial<MsgDbEntry>): Promise<ChatMessageView> {
    const { chatMessageId } = msgData;
    if (!chatMessageId) {
      throw Error('There is no chatMessageId in the message being created.');
    }

    const chatMessageType = msgData.chatMessageType || 'regular';
    const msgDbEntry: MsgDbEntry = {
      isIncomingMsg: false,
      incomingMsgId: null,
      groupChatId: null,
      otoPeerCAddr: null,
      attachments: null,
      body: null,
      groupSender: null,
      history: null,
      reactions: null,
      relatedMessage: null,
      status: chatMessageType === 'regular' ? (msgData.isIncomingMsg ? 'unread' : 'sending') : null,
      timestamp: 0,
      removeAfter: 0,
      settings: null,
      ...msgData,
      chatMessageType,
      chatMessageId,
    };
    await data.addMessage(msgDbEntry);

    return msgViewFromDbEntry(msgDbEntry, msgDbEntry.relatedMessage as RegularMsgView['relatedMessage'], ownAddr);
  }

  const methods: ChatSrv = {
    getAppDeviceId,
    makeChatMessagesHandler,
    createOneToOneChat,
    acceptChatInvitation,
    createGroupChat,
    getChatList,
    renameChat: chatRenaming.renameChat,
    chatSetUp: chatSettingUp.setUp,
    deleteChat: chatDeletion.deleteChat,
    updateGroupMembers: chatMembersUpdating.updateGroupMembers,
    updateGroupAdmins: chatMembersUpdating.updateGroupAdmins,
    getChat,
    findChatEntry,
    postProcessingForVideoChat,
    deleteMessagesInChat: msgDeletion.deleteMessagesInChat,
    deleteMessage: msgDeletion.deleteMessage,
    deleteMessages: msgDeletion.deleteMessages,
    deleteExpiredMessages: msgDeletion.deleteExpiredMessages,
    getLatestIncomingMsgTimestamp: data.getLatestIncomingMsgTimestamp,
    getMessage,
    getMessagesByChat,
    getIncomingMessage,
    getRecentReactions: data.getRecentReactions,
    sendRegularMessage,
    cancelSendingMessage,
    markMessageAsReadNotifyingSender: msgStatusUpdating.markMessageAsReadNotifyingSender,
    checkAddressExistenceForASMail: checkAddressExistenceForASMail,
    sendSystemDeletableMessage,
    updateEarlySentMessage,
    changeMessageReaction,
    makeAndSaveMsgToDb,
    watch,
  };

  const stopChatsService = exposeServiceOnIPC(methods);

  return {
    chatsSrv: methods,
    stopChatsService,
  };
}
