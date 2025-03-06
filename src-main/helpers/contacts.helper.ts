import { useContactsStore } from '../store/contacts';

export function getContactName(mail: string): string {
  const { contactList } = useContactsStore();
  const contact = contactList.find(c => c.mail === mail);
  return contact ? contact.displayName : mail;
}
