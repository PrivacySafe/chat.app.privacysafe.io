/*
 Copyright (C) 2024 3NSoft Inc.

 This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU General Public License as published by the Free Software
 Foundation, either version 3 of the License, or (at your option) any later
 version.

 This program is distributed in the hope that it will be useful, but
 WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 this program. If not, see <http://www.gnu.org/licenses/>.
*/

import { createApp } from 'vue'
import { VideoChat, videoChatSrv } from './video-component-srv'
import VideoApp from './video-app.vue'
import { Router, createRouter, createWebHistory } from 'vue-router'
import Splashscreen from './splashscreen.vue'
import PreCall from './va-setup.vue'
import Call from './call.vue'
import GroupCall from './group-call.vue'
import { createPinia } from 'pinia'

function makeVideoAppRouter(): Router {
  return createRouter({
    history: createWebHistory(),
    routes: [
      {
        name: 'splashscreen',
        path: '/splashscreen',
        component: Splashscreen
      },
      {
        name: 'va-setup',
        path: '/va-setup',
        component: PreCall
      },
      {
        name: 'call',
        path: '/call',
        component: Call
      },
      {
        name: 'group-call',
        path: '/group-call',
        component: GroupCall
      }
    ]
  })
}

async function init(): Promise<void> {
  const app = createApp(VideoApp)
  const pinia = createPinia()
  const router = makeVideoAppRouter()

  app
  .use(pinia)
  .use(router)
  .mount('#video-main')
  app.config.globalProperties.$router = router

  VideoChat.initializeService(router)

  await router.replace('splashscreen')

}

init()
