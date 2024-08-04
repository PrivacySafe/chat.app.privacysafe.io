
/**
 * This service comes from contacts app
 */
interface AppContacts {
  getContact(id: string): Promise<Person>;
  getContactList(): Promise<PersonView[]>;
  upsertContact(value: Person): Promise<void>;
}

/**
 * This app's service.
 * It is a singleton in "background instance" component.
 * This service manages data state of chats app.
 */
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

/**
 * This app's service.
 * It is a singleton in "background instance" component.
 * This service does ASMail sending.
 */
interface AppDeliverySrv {
  addMessageToDeliveryList(
    message: ChatOutgoingMessage, localMetaPath: ChatMessageLocalMeta, systemMessage?: boolean,
  ): Promise<void>;
  removeMessageFromDeliveryList(msgIds: string[]): Promise<void>;
  getMessage(msgId: string): Promise<ChatIncomingMessage | undefined>;
  getDeliveryList(localMetaPath: ChatMessageLocalMeta): Promise<SendingMessageStatus[]>;
  removeMessageFromInbox(msgIds: string[]): Promise<void>;
}

/**
 * This app's service.
 * It is a singleton in "background instance" component.
 * This service does ASMail sending.
 */
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

/**
 * This app's service.
 * It is a singleton in "background instance" component.
 * This service manages video chat windows: opens them, keeps track of them,
 * passes signals to them, etc.
 */
interface VideoGUIOpener {
  startVideoCallForChatRoom(chatId: string): Promise<void>;
  joinCallInRoom(callDetails: IncomingCallCmdArg): Promise<void>;
  watchVideoChats(obs: web3n.Observer<VideoChatEvent>): () => void;
}

interface VideoChatEvent {
  type: 'gui-closed' | 'gui-opened' | 'call-started' | 'call-ended';
  chatId: string;
}

/**
 * This app's service.
 * It is present in every instance of "video chat" component.
 * This service provides control over respective video chat window. 
 */
interface VideoChatComponent {
  focusWindow(): Promise<void>;
  closeWindow(): Promise<void>;
  watch(obs: web3n.Observer<CallGUIEvent>): () => void;
  startCallGUIForChat(chat: ChatInfoForCall): Promise<void>;
  handleWebRTCSignal(peerAddr: string, msg: WebRTCMsg): Promise<void>;
}

type CallGUIEvent =
  StartChannelEvent | CloseChannelEvent | OutgoingWebRTCSignalEvent |
  CallStartedEvent;

interface OutgoingWebRTCSignalEvent {
  type: 'webrtc-signal';
  peerAddr: string;
  channel: string;
  data: WebRTCOffBandMessage;
}

interface StartChannelEvent {
  type: 'start-channel';
  channel: string;
  peerAddr: string;
}

interface CloseChannelEvent {
  type: 'close-channel';
  channel: string;
  peerAddr: string;
}

interface CallStartedEvent {
  type: 'call-started';
}

interface ChatInfoForCall {
  chatId: string;
  ownAddr: string;
  ownName: string;
  peers: {
    addr: string;
    name: string;
  }[];
  chatName: string;
  rtcConfig: RTCConfiguration;
}
