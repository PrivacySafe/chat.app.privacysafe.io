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

import { defineStore } from 'pinia';
import { AvailableColorTheme, AvailableLanguage, ConnectivityStatus } from '~/app.types';
import { UISettings } from '@main/helpers/ui-settings';

export interface AppStoreState {
  appVersion: string;
  connectivityStatus: string;
  user: string;
  lang: AvailableLanguage;
  colorTheme: AvailableColorTheme;
  appWindowSize: {
    width: number;
    height: number;
  };
}

export const useAppStore = defineStore('app', {

  state: () => ({
    appVersion: '',
    connectivityStatus: 'offline',
    user: '',
    lang: 'en',
    colorTheme: 'default',
    appWindowSize: {
      width: 0,
      height: 0,
    },
  } as AppStoreState),

  actions: {

    async fetchInitData() {
      await Promise.all([

        w3n.myVersion().then(v => {
          this.appVersion = v;
        }),

        w3n.mailerid!.getUserId().then(addr => {
          this.user = addr;
        }),

        this.updateAppConfig()

      ]);
    },
    
    async fetchConnectivityStatus() {
      const status = await w3n.connectivity!.isOnline();
      if (status) {
        const parsedStatus = status.split('_');
        this.connectivityStatus = parsedStatus[0] as ConnectivityStatus;
      }
    },

    setLang(lang: AvailableLanguage) {
      this.lang = lang;
    },

    setColorTheme(theme: AvailableColorTheme) {
      this.colorTheme = theme;
      const htmlEl = document.querySelector('html');
      if (!htmlEl) return;
    
      const prevColorThemeCssClass = theme === 'default' ? 'dark-theme' : 'default-theme';
      const curColorThemeCssClass = theme === 'default' ? 'default-theme' : 'dark-theme';
      htmlEl.classList.remove(prevColorThemeCssClass);
      htmlEl.classList.add(curColorThemeCssClass);
    },
    
    async updateAppConfig() {
      try {
        const config = await UISettings.makeResourceReader();
        const lang = await config.getCurrentLanguage();
        const colorTheme = await config.getCurrentColorTheme();
        this.setLang(lang);
        this.setColorTheme(colorTheme);
    
        return config;
      } catch (e) {
        console.error('Load the app config error: ', e);
      }
    },

    setAppWindowSize({ width, height }: { width: number; height: number }) {
      this.appWindowSize = {
        ...this.appWindowSize,
        ...(width && { width }),
        ...(height && { height }),
      };
    }

  }

});

export type AppStore = ReturnType<typeof useAppStore>;
