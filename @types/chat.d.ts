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

type ChatMessageType = 'regular' | 'system';
type MessageType = 'incoming' | 'outgoing';

type ChatSystemEventBase = 'add' | 'delete' | 'update' | 'send';
type ChatSystemEventEntity = 'status' | 'chatName' | 'members';
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
  initialMessageId?: string;
  chatSystemData?: ChatSystemMessageData;
}

interface ChatIncomingMessage extends web3n.asmail.IncomingMessage {
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
  createdAt: number;
}

type ChatViewForDB = Omit<ChatView, 'members'> & { members: string }

type ChatMessageAttachments<T> = T extends 'incoming' ? ReadonlyFS : AttachmentsContainer;

interface ChatMessageViewForDB<T extends MessageType> {
  msgId: string;
  messageType: T;
  sender: string;
  body: string;
  attachments: ChatMessageAttachments<T>|null;
  chatId: string;
  chatMessageType: ChatMessageType;
  chatMessageId: string;
  initialMessageId: string|null;
  status?: MessageDeliveryStatus;
  timestamp: number;
}

interface DeliveryServiceData {
  lastReceivedMessageTimestamp: number;
}
