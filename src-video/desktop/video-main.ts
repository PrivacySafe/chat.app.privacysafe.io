/*
 Copyright (C) 2024 - 2025 3NSoft Inc.

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
import { createRouter, createWebHashHistory } from 'vue-router';
import { createPinia } from 'pinia';
import {
  dialogs,
  i18n,
  I18nOptions,
  notifications,
  storeVueBus,
  vueBus,
  // VueEventBus,
} from '@v1nt1248/3nclient-lib/plugins';

import '@v1nt1248/3nclient-lib/variables.css';
import '@v1nt1248/3nclient-lib/style.css';
import '@main/common/assets/styles/main.css';

// import { VideoChat } from '@video/common/services/video-component-srv';
// import { useStreamsStore } from '@video/common/store/streams.store';
// import type { PeerEvents } from '@video/common/types/events';
import VideoApp from '@video/desktop/pages/video-app.vue';
import VASetup from '@video/desktop/pages/va-setup.vue';
import Call from '@video/desktop/pages/call/call.vue';

import en from '@main/common/data/i18/en.json';

// const srvStart = VideoChat.startService();

const app = createApp(VideoApp);
const pinia = createPinia();
pinia.use(storeVueBus);

const router = createRouter({
  history: createWebHashHistory(),
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
  ],
});

app.config.globalProperties.$router = router;
app.config.compilerOptions.isCustomElement = tag => {
  return tag.startsWith('ui3n-');
};

app
  .use(pinia)
  .use<I18nOptions>(i18n, { lang: 'en', messages: { en } })
  .use(vueBus)
  .use(dialogs)
  .use(notifications)
  .use(router)
  .mount('#video-main');

// srvStart.then(srv => srv.attachToVue(
//   useStreamsStore(),
//   app.config.globalProperties.$emitter as VueEventBus<PeerEvents>,
// ));
