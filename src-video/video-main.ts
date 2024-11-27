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

import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import { createPinia } from 'pinia';
import {
  i18n,
  I18nOptions,
  vueBus,
  VueEventBus,
} from '@v1nt1248/3nclient-lib/plugins';

import '@v1nt1248/3nclient-lib/variables.css';
import '@v1nt1248/3nclient-lib/style.css';
import './assets/styles/video-chat.css';

import { VideoChat } from './services/video-component-srv';
import { useStreamsStore } from './store/streams';
import { VideoAudioEvents } from '@video/services/events.ts';
import VideoApp from './views/video-app.vue';
import VASetup from './views/va-setup.vue';
import Call from './views/call/call.vue';
import GroupCall from './views/group-call.vue';

import en from '@main/data/i18/en.json';

const srvStart = VideoChat.startService();

const app = createApp(VideoApp);
const pinia = createPinia();
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/va-setup' },
    { path: '/video-chat.html', redirect: '/va-setup' },
    {
      name: 'va-setup',
      path: '/va-setup',
      component: VASetup,
    },
    {
      name: 'call',
      path: '/call',
      component: Call,
    },
    {
      name: 'group-call',
      path: '/group-call',
      component: GroupCall,
    },
  ],
});

app
  .use(pinia)
  .use<I18nOptions>(i18n, { lang: 'en', messages: { en } })
  .use(vueBus)
  .use(router)
  .mount('#video-main');

srvStart.then(srv => srv.attachToVue(
  useStreamsStore(),
  app.config.globalProperties.$emitter as VueEventBus<VideoAudioEvents>,
));

// router.replace('va-setup');
