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

import { toRO } from "@main/common/utils/readonly.ts";
import { SystemSettings } from "@main/common/utils/ui-settings.ts";
import { ref } from "vue";
import { AppConfig, AvailableColorTheme, AvailableLanguage } from '~/app.types.ts';
import { blobFromDataURL } from '@main/common/utils/image-files.ts';

export function useSystemLevelAppConfig() {

  const appVersion = ref<string>('');
  const user = ref<string>('');
  const lang = ref<AvailableLanguage>('en');
  const colorTheme = ref<AvailableColorTheme>('default');
  const customLogoSrc = ref<string>();

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

  async function setCustomLogo(dataURL: AppConfig['customLogo']): Promise<void> {
    if (dataURL) {
      try {
        const imgBlob = blobFromDataURL(dataURL);
        customLogoSrc.value = URL.createObjectURL(imgBlob);
      } catch (err) {
        w3n.log('error', 'Parsing dataURL with customLogo throws error.' , err);
      }
    } else {
      customLogoSrc.value = undefined;
    }
  }

  let unsubFromConfigWatch: (() => void)|undefined = undefined;

  async function readAndStartWatchingAppConfig() {
    try {
      const config = await SystemSettings.makeResourceReader();
      const { lang, colorTheme, customLogo } = await config.getAll();
      setLang(lang);
      setColorTheme(colorTheme);
      setCustomLogo(customLogo);
      unsubFromConfigWatch = config.watchConfig({
        next: appConfig => {
          const { lang, colorTheme, customLogo } = appConfig;
          setLang(lang);
          setColorTheme(colorTheme);
          setCustomLogo(customLogo);
        },
      });
    } catch (e) {
      w3n.log('error', 'Load the app config error. ', e);
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
    customLogoSrc: toRO(customLogoSrc),

    initialize,
    stopWatching
  };
}
