interface AppContacts {
  getContact(id: string): Promise<Person>;
  getContactList(): Promise<PersonView[]>;
  upsertContact(value: Person): Promise<void>;
}

interface AppChatsSrv {
  getChatList(): Promise<Array<ChatView & ChatMessageView<MessageType>>>;
  getChatsUnreadMessagesCount(): Promise<Record<string, number>>;
  createChat(
    { chatId, members, admins, name }: { chatId?: string, members: string[], admins: string[], name: string },
  ): Promise<string>;
  updateChat(value: ChatView): Promise<void>;
  getChat(chatId: string): Promise<ChatView | null>;
  deleteChat(chatId: string): Promise<void>;
  clearChat(chatId: string): Promise<void>;
  getMessage(
    { msgId, chatMsgId }: { msgId?: string, chatMsgId?: string },
  ): Promise<ChatMessageView<MessageType>|null>;
  deleteMessage({ msgId, chatMsgId }: { msgId?: string, chatMsgId?: string }): Promise<void>;
  getMessagesByChat(chatId: string): Promise<ChatMessageView<MessageType>[]>;
  upsertMessage(value: ChatMessageView<MessageType>): Promise<void>;
}

interface AppDeliverySrv {
  addMessageToDeliveryList(
    message: ChatOutgoingMessage, localMetaPath: ChatMessageLocalMeta, systemMessage?: boolean,
  ): Promise<void>;
  removeMessageFromDeliveryList(msgIds: string[]): Promise<void>;
  getMessage(msgId: string): Promise<ChatIncomingMessage | undefined>;
  getDeliveryList(localMetaPath: ChatMessageLocalMeta): Promise<SendingMessageStatus[]>;
  removeMessageFromInbox(msgIds: string[]): Promise<void>;
}

interface AppDeliveryService {
  watchIncomingMessages(obs: web3n.Observer<ChatIncomingMessage>): () => void;
  watchOutgoingMessages(obs: web3n.Observer<{id: string, progress: web3n.asmail.DeliveryProgress}>): () => void;
}

interface FileLinkStoreService {
  saveLink(file: web3n.files.ReadonlyFile): Promise<string>;
  getLink(fileId: string): Promise<web3n.files.SymLink|null|undefined>;
  getFile(fileId: string): Promise<web3n.files.Linkable|null|undefined>;
  deleteLink(fileId: string): Promise<void>;
}
