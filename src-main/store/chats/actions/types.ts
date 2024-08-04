/* eslint-disable @typescript-eslint/no-explicit-any */
import { PiniaActionTree } from '../../types'
import { ChatsStore } from '../types'

export type Actions = {
  getChatList(): Promise<Record<string, ChatView & { unread: number } & ChatMessageView<MessageType>>>;
  createChat(
    { chatId, members, admins, name }:
    { chatId?: string, members: string[], admins: string[], name?: string }
  ): Promise<string>;
  getChat(chatId: string | null): Promise<void>;
  clearChat(chatId: string): Promise<void>;
  deleteChat(chatId: string): Promise<void>;
  leaveChat(
    chat: ChatView & { unread: number } & ChatMessageView<MessageType>,
    users: string[],
    isRemoved?: boolean,
  ): Promise<void>;
  renameChat(
    chat: ChatView & { unread: number } & ChatMessageView<MessageType>,
    newChatName: string,
  ): Promise<void>;
  updateMembers(
    chat: ChatView & { unread: number } & ChatMessageView<MessageType>,
    users: string[],
  ): Promise<void>;
  getMessage(msgId: string): Promise<ChatIncomingMessage|undefined>;
  getChatMessage(
    { msgId, chatMessageId }: { msgId?: string, chatMessageId?: string },
  ): Promise<ChatMessageView<MessageType> | null>;
  deleteMessage(chatMessageId: string, deleteForEveryone?: boolean): Promise<void>;
  sendMessage(msg: ChatOutgoingMessage): Promise<void>;
  sendSystemMessage(
    { chatId, chatMessageId, recipients, event, value, displayable = false }:
    { chatId: string, chatMessageId: string, recipients: string[],
      event: ChatSystemEvent, value: any, displayable?: boolean },
  ): Promise<string>;
  receiveMessage(
    { me, msg, currentChatId }:
    { me: string, msg: ChatIncomingMessage, currentChatId: string|null}
  ): Promise<void>;
  handleUpdateMessageStatus({ msgId, chatMessageId, value }: SystemMessageHandlerParams): Promise<void>;
  handleUpdateChatName(params: SystemMessageHandlerParams): Promise<void>;
  handlerDeleteChatMembers(params: SystemMessageHandlerParams): Promise<void>;
  handlerAddChatMembers(params: SystemMessageHandlerParams): Promise<void>;
  handlerRemoveChatMembers(params: SystemMessageHandlerParams): Promise<void>;
  handlerDeleteChatMessage(params: SystemMessageHandlerParams): Promise<void>;
}

export type ChatsActions = PiniaActionTree<Actions, ChatsStore>
