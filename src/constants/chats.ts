export const chatIdLength = 10
export const msgIdLength = 10
export const chatMsgActionElementHeight = 24
export const readonlyContactIds = ['0', '1']

export const messageDeliveryStatuses: Record<MessageDeliveryStatus, MessageDeliveryStatusUI> = {
  sending: {
    icon: 'refresh',
    color: 'var(--blue-main, #0090ec)',
  },
  sent: {
    icon: 'check',
    color: 'var(--green-grass-100, #33c653)',
  },
  received: {
    icon: 'done-all',
    color: 'var(--green-grass-100, #33c653)',
  },
  error: {
    icon: 'report-gmail-errorred',
    color: 'var(--pear-100, #f65d53)',
  },
  canceled: {
    icon: 'report-gmail-errorred',
    color: 'var(--yellow-100, ##ffc765)',
  },
}

export const chatMenuItems = [
  { icon: 'account-circle', action: 'chat:info', text: 'Chat info', chatTypes: ['single', 'group'], disabled: false, isAccent: false },
  { icon: 'edit', action: 'chat:rename', text: 'Rename chat', chatTypes: ['single', 'group'], disabled: false, isAccent: false },
  { icon: 'system-update-alt', action: 'history:export', text: 'Export History', chatTypes: ['single', 'group'], disabled: false, isAccent: false },
  { icon: 'cleaning-services', action: 'history:clean', text: 'Clean History', chatTypes: ['single', 'group'], disabled: false, isAccent: false },
  { icon: 'close', action: 'chat:close', text: 'Close chat', chatTypes: ['single', 'group'], disabled: false, isAccent: false, margin: true },
  { icon: 'delete', action: 'chat:delete', text: 'Delete Chat', chatTypes: ['single'], disabled: false, isAccent: true, margin: true },
  { icon: 'logout', action: 'chat:leave', text: 'Leave Group', chatTypes: ['group'], disabled: false, isAccent: true, margin: true },
]

/*
* condition - {part1}:{part2}:{part3}
* part1 (message type): ChatMessageType OR '' (if it does not matter)
* part2 (message delivery status): lists the MessageDeliveryStatus separated by commas OR '' (if it does not matter)
* part3 (attachments):  true OR false OR '' (if it does not matter)
* */
export const messageActions: ChatMessageAction[] = [
  { id: 'reply', icon: { name: 'reply' }, title: 'Reply', conditions: [] },
  { id: 'copy', icon: { name: 'content-copy' }, title: 'Copy to clipboard', conditions: ['incoming::', 'outgoing:sent,received,error,canceled:'] },
  { id: 'forward', icon: { name: 'reply', horizontalFlip: true }, title: 'Forward', conditions: ['incoming::', 'outgoing:sent,received,error,canceled:'] },
  { id: 'download', icon: { name: 'download-for-offline' }, title: 'Download', conditions: ['incoming::true', 'outgoing:sent,received,error,canceled:true'] },
  { id: 'resend', disabled: true, icon: { name: 'refresh' }, title: 'Resend', conditions: ['outgoing:error:'] },
  { id: 'delete_message', icon: { name: 'delete' }, title: 'Delete message', conditions: ['incoming::', 'outgoing:sent,received,error,canceled:'], blockStart: true, accent: 'var(--pear-100)' },
  { id: 'cancel_sending', disabled: true, icon: { name: 'delete' }, title: 'Cancel sending', conditions: ['outgoing:sending:'], blockStart: true, accent: 'var(--pear-100)' },
]

export const validationParams = {
  chatsNameMaxLength: 50,
}
