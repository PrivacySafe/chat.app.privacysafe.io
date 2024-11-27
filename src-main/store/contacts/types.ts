/* eslint-disable @typescript-eslint/no-explicit-any */
import { Store } from 'pinia';
import type { Actions } from './actions/types';
import type { PersonView } from '~/index';

export interface State {
  contactList: Array<PersonView & { displayName: string }>;
}

export type ContactsStore<G = any> = Store<'contacts', State, G, Actions>;
