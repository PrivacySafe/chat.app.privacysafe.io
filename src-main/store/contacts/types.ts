/* eslint-disable @typescript-eslint/no-explicit-any */
import { Store } from 'pinia'
import { Actions } from './actions/types'

export interface State {
  contactList: Array<PersonView & { displayName: string }>;
}

export type ContactsStore<G = any> = Store<'contacts', State, G, Actions>
