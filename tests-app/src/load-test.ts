/*
 Copyright (C) 2025 3NSoft Inc.

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
import TestApp from '@tests/test-app.vue';
import RoutedComponent from '@tests/test-routed-component.vue';
import { setupMainApp } from '@tests/app-setup';
import { createRouter, createWebHashHistory } from 'vue-router';
import { initializeServices } from '@main/common/services/external-services';
import { defer } from '@tests/lib-common/processes/deferred';
import { logErr } from './test-page-utils';

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
const { promise, reject, resolve } = defer<void>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).preTestProc = promise;

const routerForTestApp = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/test-route' },
    { path: '/index.html', redirect: '/test-route' },
    {
      path: '/test-route',
      name: 'test',
      component: RoutedComponent
    }
  ]
});

initializeServices()
.then(() => {
  const app = createApp(TestApp, { reject, resolve });
  setupMainApp(app, routerForTestApp);
  app.mount(`#test-app-vue`);
})
.catch(err => {
  logErr(`Failed to initialize test app`, err);
  reject(err);
});
