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

import { toRO } from "@main/utils/readonly";
import { UISettings } from "@main/utils/ui-settings";
import { ref } from "vue";
import { AvailableColorTheme, AvailableLanguage } from '~/app.types';

export function useSystemLevelAppConfig() {

  const appVersion = ref<string>('');
  const user = ref<string>('');
  const lang = ref<AvailableLanguage>('en');
  const colorTheme = ref<AvailableColorTheme>('default');

  function setLang(value: AvailableLanguage) {
    lang.value = value;
  }
  
  function setColorTheme(theme: AvailableColorTheme) {
    colorTheme.value = theme;
    const htmlEl = document.querySelector('html');
    if (!htmlEl) return;
  
    const prevColorThemeCssClass = theme === 'default' ? 'dark-theme' : 'default-theme';
    const curColorThemeCssClass = theme === 'default' ? 'default-theme' : 'dark-theme';
    htmlEl.classList.remove(prevColorThemeCssClass);
    htmlEl.classList.add(curColorThemeCssClass);
  }

  let unsubFromConfigWatch: (() => void)|undefined = undefined;
  
  async function readAndStartWatchingAppConfig() {
    try {
      const config = await UISettings.makeResourceReader();
      const lang = await config.getCurrentLanguage();
      const colorTheme = await config.getCurrentColorTheme();
      setLang(lang);
      setColorTheme(colorTheme);
      unsubFromConfigWatch = config.watchConfig({
        next: appConfig => {
          const { lang, colorTheme } = appConfig;
          setLang(lang);
          setColorTheme(colorTheme);
        },
      });
    } catch (e) {
      console.error('Load the app config error: ', e);
    }
  }

  async function initialize(): Promise<void> {
    await Promise.all([

      w3n.myVersion().then(v => {
        appVersion.value = v;
      }),

      w3n.mailerid!.getUserId().then(addr => {
        user.value = addr;
      }),

      readAndStartWatchingAppConfig()

    ]);
  }

  async function stopWatching() {
    unsubFromConfigWatch?.();
  }

  return {
    appVersion: toRO(appVersion),
    user: toRO(user),
    lang: toRO(lang),
    colorTheme: toRO(colorTheme),

    initialize,
    stopWatching
  };
}
