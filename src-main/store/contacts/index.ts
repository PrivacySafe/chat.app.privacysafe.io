import { defineStore } from 'pinia';
import { state } from './state';
import { actions } from './actions';

export const contactsStore = defineStore('contacts', {
  state: () => state,
  actions,
});
