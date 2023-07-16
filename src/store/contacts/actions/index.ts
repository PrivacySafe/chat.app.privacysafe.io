import { ContactsActions } from './types'
import { get } from 'lodash'
import { appContactsSrvProxy } from '@/services/services-provider'

export const actions: ContactsActions = {
  async fetchContactList(): Promise<Array<PersonView & { displayName: string }>> {
    let contactList: PersonView[] | undefined
    try {
      contactList = await appContactsSrvProxy.getContactList()
    } catch (e) {
      console.error(e)
    }

    this.contactList = contactList!
      .map(contact => ({
        ...contact,
        displayName: get(contact, 'name') || get(contact, 'mail') || ' ',
      }))
      .sort((a, b) => (a.displayName > b.displayName ? 1 : -1))

    return this.contactList
  },
}
