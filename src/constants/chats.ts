export const messageDeliveryStatuses: Record<MessageDeliveryStatus, MessageDeliveryStatusUI> = {
  sending: {
    icon: 'round-refresh',
    color: 'var(--blue-main, #0090ec)',
  },
  sent: {
    icon: 'round-check',
    color: 'var(--green-grass-100, #33c653)',
  },
  received: {
    icon: 'round-done',
    color: 'var(--green-grass-100, #33c653)',
  },
  error: {
    icon: 'round-report-gmailerrorred',
    color: 'var(--pear-100, #f65d53)',
  },
  canceled: {
    icon: 'round-report-gmailerrorred',
    color: 'var(--yellow-100, ##ffc765)',
  },
}
