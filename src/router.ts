import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import Chats from '@/components/chat/chats.vue'
import Chat from '@/components/chat/chat.vue'

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
