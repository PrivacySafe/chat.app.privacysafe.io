interface AppContacts {
  getContact(id: string): Promise<Person>;
  getContactList(): Promise<PersonView[]>;
}

interface AppChatsSrv {
  getChatList(): Promise<Array<ChatView & ChatMessageViewForDB<MessageType>>>;
  getChatsUnreadMessagesCount(): Promise<Record<string, number>>;
  createChat({ chatId, members, name }: { chatId?: string, members: string[], name: string }): Promise<string>;
  getChat(chatId: string): Promise<ChatView | null>;
  deleteChat(chatId: string): Promise<void>;
  clearChat(chatId: string): Promise<void>;
  getMessage(
    { msgId, chatMsgId }: { msgId?: string, chatMsgId?: string },
  ): Promise<ChatMessageViewForDB<MessageType>|null>;
  deleteMessage({ msgId, chatMsgId }: { msgId?: string, chatMsgId?: string }): Promise<void>;
  getMessagesByChat(chatId: string): Promise<ChatMessageViewForDB<MessageType>[]>;
  upsertMessage(value: ChatMessageViewForDB<MessageType>): Promise<void>;
}

interface AppDeliverySrv {
  start(): Promise<void>;
  addMessageToDeliveryList(
    message: ChatOutgoingMessage, localMetaPath: ChatMessageLocalMeta, systemMessage?: boolean,
  ): Promise<void>;
  removeMessageFromDeliveryList(msgId: string): Promise<void>;
  getMessage(msgId: string): Promise<ChatIncomingMessage | undefined>;
  getDeliveryList(localMetaPath: ChatMessageLocalMeta): Promise<SendingMessageStatus[]>;
}
