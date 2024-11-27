import type { ChatMessageAction, MessageDeliveryStatus, MessageDeliveryStatusUI } from '~/index';

export const chatIdLength = 10;
export const msgIdLength = 10;
export const chatMsgActionElementHeight = 24;
export const readonlyContactIds = ['0', '1'];

export const messageDeliveryStatuses: Record<MessageDeliveryStatus, MessageDeliveryStatusUI> = {
  sending: {
    icon: 'round-refresh',
    color: 'var(--color-icon-chat-bubble-user-quote)',
  },
  sent: {
    icon: 'round-check',
    color: 'var(--success-content-default)',
  },
  received: {
    icon: 'round-done-all',
    color: 'var(--success-content-default)',
  },
  error: {
    icon: 'round-report-gmailerrorred',
    color: 'var(--error-content-default)',
  },
  canceled: {
    icon: 'round-report-gmailerrorred',
    color: 'var(--warning-content-default)',
  },
};

export const chatMenuItems = [
  {
    icon: 'outline-info',
    action: 'chat:info',
    text: 'Chat info',
    chatTypes: ['single', 'group'],
    disabled: false,
    isAccent: false,
  },
  {
    icon: 'outline-edit',
    action: 'chat:rename',
    text: 'Rename chat',
    chatTypes: ['single', 'group'],
    disabled: false,
    isAccent: false,
  },
  {
    icon: 'round-system-update-alt',
    action: 'history:export',
    text: 'Export History',
    chatTypes: ['single', 'group'],
    disabled: false,
    isAccent: false,
  },
  {
    icon: 'outline-cleaning-services',
    action: 'history:clean',
    text: 'Clean History',
    chatTypes: ['single', 'group'],
    disabled: false,
    isAccent: false,
  },
  {
    icon: 'round-close',
    action: 'chat:close',
    text: 'Close chat',
    chatTypes: ['single', 'group'],
    disabled: false,
    isAccent: false,
    margin: true,
  },
  {
    icon: 'outline-delete',
    action: 'chat:delete',
    text: 'Delete Chat',
    chatTypes: ['single'],
    disabled: false,
    isAccent: true,
    margin: true,
  },
  {
    icon: 'round-logout',
    action: 'chat:leave',
    text: 'Leave Group',
    chatTypes: ['group'],
    disabled: false,
    isAccent: true,
    margin: true,
  },
];

/*
* condition - {part1}:{part2}:{part3}
* part1 (message type): ChatMessageType OR '' (if it does not matter)
* part2 (message delivery status): lists the MessageDeliveryStatus separated by commas OR '' (if it does not matter)
* part3 (attachments):  true OR false OR '' (if it does not matter)
* */
export const messageActions: ChatMessageAction[] = [
  { id: 'reply', icon: { name: 'outline-reply' }, title: 'Reply', conditions: [] },
  {
    id: 'copy',
    icon: { name: 'round-content-copy' },
    title: 'Copy to clipboard',
    conditions: ['incoming::', 'outgoing:sent,received,error,canceled:'],
  },
  {
    id: 'forward',
    icon: { name: 'outline-reply', horizontalFlip: true },
    title: 'Forward',
    conditions: ['incoming::', 'outgoing:sent,received,error,canceled:'],
  },
  {
    id: 'download',
    icon: { name: 'outline-download-for-offline' },
    title: 'Download',
    conditions: ['incoming::true', 'outgoing:sent,received,error,canceled:true'],
  },
  { id: 'resend', disabled: true, icon: { name: 'round-refresh' }, title: 'Resend', conditions: ['outgoing:error:'] },
  {
    id: 'delete_message',
    icon: { name: 'outline-delete' },
    title: 'Delete message',
    conditions: ['incoming::', 'outgoing:sent,received,error,canceled:'],
    blockStart: true,
    accent: 'var(--warning-content-default)',
  },
  {
    id: 'cancel_sending',
    disabled: true,
    icon: { name: 'outline-delete' },
    title: 'Cancel sending',
    conditions: ['outgoing:sending:'],
    blockStart: true,
    accent: 'var(--warning-content-default)',
  },
];

export const validationParams = {
  chatsNameMaxLength: 50,
};
