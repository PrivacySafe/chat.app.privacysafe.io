/*
 Copyright (C) 2020 - 2025 3NSoft Inc.

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
import { createPinia } from 'pinia';

import { dialogs, notifications, storeVueBus, storeNotifications, vueBus } from '@v1nt1248/3nclient-lib/plugins';

import '@v1nt1248/3nclient-lib/variables.css';
import '@v1nt1248/3nclient-lib/style.css';
import '@main/common/assets/styles/main.css';

import { router } from './router';
import i18n from '@main/common/data/i18';
import { initializeServices } from '@main/common/services/external-services';
import { startMainWindowLogRelay } from '@main/common/services/gui-log-relay';
import { installConsoleTimestamps } from '@shared/console-timestamps';
import { initDebugLogging, makeLogger } from '@shared/logger';

import App from '@main/desktop/pages/app.vue';

const log = makeLogger('MainWindow');

// Before the services start logging: without a time on them, main-window lines
// cannot be lined up with the call window's or the background's (see
// shared-libs/console-timestamps.ts).
installConsoleTimestamps();

initializeServices().then(async () => {
  // Both need the services: the relay's channel is chatService, and the
  // diagnostic switch is read through the shell. Started before the app is
  // mounted, so that what the stores do on their way up is relayed too.
  startMainWindowLogRelay();
  initDebugLogging();

  const pinia = createPinia();
  pinia.use(storeVueBus);
  pinia.use(storeNotifications);

  const app = createApp(App);

  app.config.globalProperties.$router = router;
  app.config.compilerOptions.isCustomElement = tag => {
    return tag.startsWith('ui3n-');
  };

  app.use(pinia).use(i18n).use(vueBus).use(dialogs).use(notifications).use(router).mount('#main');
})
.catch(err => {
  // Without this the failure is an unhandled rejection and a blank window: the
  // app is never mounted, and nothing on screen says why. initializeServices()
  // logs the error itself, so this only has to make the silence deliberate.
  log.error(`App is not started, as its services could not be reached`, err);
});
