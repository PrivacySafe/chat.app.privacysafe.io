import { defineStore } from 'pinia';
import { state } from './state';
import { getters } from './getters';
import { actions } from './actions';

export const chatsStore = defineStore('chats', {
  state: () => state,
  getters,
  actions,
});
