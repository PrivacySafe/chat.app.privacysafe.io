import { defineStore } from 'pinia'
import { state } from './state'
import { actions } from './actions'

export const appStore = defineStore('app', {
  state: () => state,
  actions,
})
