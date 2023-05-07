import dayjs from 'dayjs'
import { useContactsStore } from '@/store/contacts.store'

export function prepareDateAsSting(ts: number): string {
  const now = dayjs()
  const dateValue = dayjs(ts)

  if (now.isSame(dateValue, 'day')) {
    return dateValue.format('HH:mm')
  }

  if (now.isBefore(dateValue.add(3, 'day'))) {
    return dateValue.fromNow()
  }

  return dateValue.format('YYYY-MM-DD')
}

export function getContactName(mail: string): string {
  const contactsStore = useContactsStore()
  const contact = contactsStore.contactList
    .find(c => c.mail === mail)
  return contact ? contact.displayName : mail
}
