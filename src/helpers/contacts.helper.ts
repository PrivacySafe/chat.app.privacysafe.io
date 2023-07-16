import { useContactsStore } from '@/store'

export function getContactName(mail: string): string {
  const { contactList } = useContactsStore()
  const contact = contactList.find(c => c.mail === mail)
  return contact ? contact.displayName : mail
}
