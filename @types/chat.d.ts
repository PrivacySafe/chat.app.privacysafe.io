/* eslint-disable @typescript-eslint/no-explicit-any */
type MessageDeliveryStatus = 'sending' | 'sent' | 'received' | 'error' | 'canceled'

interface MessageDeliveryInfo {
  msgId: string;
  status: MessageDeliveryStatus;
  value: string | number;
}

interface SendingMessageStatus {
  msgId?: string;
  status: web3n.asmail.DeliveryProgress | undefined;
  info: MessageDeliveryInfo | undefined;
}

interface DeliveryMessageProgress {
  id: string;
  progress: web3n.asmail.DeliveryProgress;
}

interface SendingError {
  mail: string;
  text: string;
}

type ChatMessageType = 'regular' | 'system' | 'webrtc-call';
type MessageType = 'incoming' | 'outgoing';

type ChatSystemEventBase = 'add' | 'delete' | 'remove' | 'update' | 'send';
type ChatSystemEventEntity = 'status' | 'chatName' | 'members' | 'admins' | 'message';
type ChatSystemEvent = `${Partial<ChatSystemEventBase>}:${Partial<ChatSystemEventEntity>}`;

type ChatMessageLocalMeta = `chat:${string}:${string}` // 'chat:${chatId}:${msgId}'

interface ChatSystemMessageData {
  event: ChatSystemEvent;
  value: any;
  displayable?: boolean;
}

interface ChatMessageJsonBody {
  chatId: string;
  chatName?: string;
  chatMessageType?: ChatMessageType;
  chatMessageId: string;
  members: string[];
  admins: string[];
  initialMessageId?: string;
  chatSystemData?: ChatSystemMessageData;
}

interface ChatIncomingMessage extends web3n.asmail.IncomingMessage {
  msgType: 'chat';
  jsonBody: ChatMessageJsonBody;
}

interface ChatOutgoingMessage extends web3n.asmail.OutgoingMessage {
  jsonBody: ChatMessageJsonBody;
  status?: MessageDeliveryStatus;
}

interface ChatView {
  chatId: string;
  name: string;
  members: string[];
  admins: string[];
  createdAt: number;
}

type ChatViewForDB = Omit<ChatView, 'members'|'admins'> & { members: string, admins: string }

interface ChatMessageAttachmentsInfo {
  id?: string;
  name: string;
  size: number;
}

interface ChatMessageViewBase<T extends MessageType> {
  msgId: string;
  messageType: T;
  sender: string;
  body: string;
  chatId: string;
  chatMessageType: ChatMessageType;
  chatMessageId: string;
  initialMessageId: string|null;
  status?: MessageDeliveryStatus;
  timestamp: number;
}

interface ChatMessageView<T extends MessageType> extends ChatMessageViewBase<T> {
  attachments: ChatMessageAttachmentsInfo[] | null;
}

interface ChatMessageViewForDB<T extends MessageType> extends ChatMessageViewBase<T> {
  attachments: string | null;
}

type ChatMessageActionType = 'reply' | 'copy' | 'forward' | 'download' | 'resend' | 'delete_message' | 'cancel_sending'

interface ChatMessageAction {
  id: ChatMessageActionType;
  icon: {
    name: string;
    horizontalFlip?: boolean;
    rotateIcon?: 1 | 2 | 3,
  };
  title: string;
  conditions: string[];
  blockStart?: boolean;
  accent?: string;
  disabled?: boolean;
}

type ChatListItemView = ChatView & { unread: number } & ChatMessageView<MessageType>;
