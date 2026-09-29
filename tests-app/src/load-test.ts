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
import { stringifyErr } from '@tests/lib-common/exceptions/error';
import { logErr } from './test-page-utils';

declare const w3n: web3n.testing.CommonW3N;

/**
 * Must match the template of the users in ci/stress-test/test-setup.json.
 */
const STRESS_USER_PREFIX = 'test_user_';

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

/**
 * Tells a stress run from the ordinary suite.
 *
 * The two stands differ in how their users are named: the stress stand's are
 * `test_user_*`, while the ordinary suite's are `chat app ... tester ...`.
 * Reading this window's own id is enough, and it neither probes a user that
 * may not exist nor touches the ordinary flow.
 */
async function isAsmailStressRun(): Promise<boolean> {
  try {
    const { userId } = await w3n.testStand.staticTestInfo();
    return (typeof userId === 'string') && userId.startsWith(STRESS_USER_PREFIX);
  } catch {
    return false;
  }
}

async function start(): Promise<void> {
  if (await isAsmailStressRun()) {
    // preTestProc is deliberately left pending: boot1.js waits on it before it
    // starts jasmine, so no spec runs in a stress window, and the stress module
    // is what ends the run (see its orchestrator).
    const { userNum } = await w3n.testStand.staticTestInfo();
    const { runAsmailStress } = await import('../../ci/stress-test/asmail-stress');
    await runAsmailStress(userNum);
    return;
  }

  initializeServices()
  .then(() => {
    const app = createApp(TestApp, { reject, resolve });
    setupMainApp(app, routerForTestApp);
    app.mount(`#test-app-vue`);
  })
  .catch(err => {
    // The reason goes into the message itself: the stand's log serializes the
    // error argument with JSON.stringify, and an RPC exception comes out of that
    // as `{}` - which is exactly what the run of 2026-08-14 printed instead of
    // naming the service that timed out.
    logErr(`Failed to initialize test app: ${stringifyErr(err)}`, err);
    reject(err);
  });
}

void start();
