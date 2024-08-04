import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import Chats from './components/chat/chats.vue'
import Chat from './components/chat/chat.vue'
import { ref, Ref } from 'vue'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/chats' },
  { path: '/index.html', redirect: '/chats' },
  {
    path: '/chats',
    name: 'chats',
    component: Chats,
    children: [
      { path: ':chatId', name: 'chat', component: Chat },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

export interface SharedRefs {
  newChatDialogFlag: Ref<boolean>;
  incomingCalls: Ref<IncomingCallCmdArg[]>;
}

const sharedRefs: SharedRefs = {
  newChatDialogFlag: ref(false),
  incomingCalls: ref([])
}

export function useSharedRef<K extends keyof SharedRefs>(
  key: K
): SharedRefs[K] {
  return sharedRefs[key]
}