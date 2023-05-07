/* eslint-disable object-curly-newline */
import { defineStore } from 'pinia'
import { get } from 'lodash'
import { appContactsSrvProxy } from '@/services/services-provider'

export const useContactsStore = defineStore(
  'contacts',
  {
    state: () => ({
      contactList: [] as Array<PersonView & { displayName: string }>,
    }),

    actions: {
      async fetchContactList(): Promise<Array<PersonView & { displayName: string }>> {
        console.log('\n--- FETCH CONTACT LIST ---\n')
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
    },
  },
)
