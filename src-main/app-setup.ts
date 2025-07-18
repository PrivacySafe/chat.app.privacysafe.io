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

import { App } from 'vue';
import { createPinia } from 'pinia';
import { Router } from 'vue-router';
import {
  dialogs,
  i18n,
  I18nOptions,
  notifications,
  storeVueBus,
  storeI18n,
  storeNotifications,
  vueBus,
} from '@v1nt1248/3nclient-lib/plugins';

import en from './data/i18/en.json';

export function setupMainApp(app: App<Element>, router: Router) {

  const pinia = createPinia();
  pinia.use(storeVueBus);
  pinia.use(storeI18n);
  pinia.use(storeNotifications);

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
  .use(router);

}
