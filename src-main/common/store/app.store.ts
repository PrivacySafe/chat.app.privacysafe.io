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

import { ref } from 'vue';
import { defineStore } from 'pinia';
import { AvailableColorTheme, AvailableLanguage } from '~/app.types';
import { useSystemLevelAppConfig } from './app/system-level-app-config';
import { useConnectivityStatus } from './app/connectivity';
import { type Ui3nResizeCbArg } from '@v1nt1248/3nclient-lib';

export interface AppStoreState {
  commonLoading: boolean;
  isMobileMode: boolean;
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

export interface AppWindowSize {
  width: number;
  height: number;
}

export const useAppStore = defineStore('app', () => {
  const commonLoading = ref(false);
  const isMobileMode = ref<boolean>(false);
  const appWindowSize = ref<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const connectivity = useConnectivityStatus();
  const { connectivityStatus } = connectivity;

  const commonAppConfs = useSystemLevelAppConfig();
  const { appVersion, user, lang, colorTheme, customLogoSrc } = commonAppConfs;

  function setMobileMode(value: boolean) {
    isMobileMode.value = value;
  }

  function setAppWindowSize(value: Ui3nResizeCbArg) {
    appWindowSize.value = {
      width: value.width,
      height: value.contentHeight,
    };
  }

  async function initialize() {
    await Promise.all([
      connectivity.initialize(),
      commonAppConfs.initialize(),
    ]);
  }

  function stopWatching() {
    connectivity.stopConnectivityCheck();
    commonAppConfs.stopWatching();
  }

  return {
    commonLoading,
    isMobileMode,
    appVersion,
    appWindowSize,
    user,
    lang,
    colorTheme,
    customLogoSrc,
    connectivityStatus,
    setMobileMode,
    setAppWindowSize,
    initialize,
    stopWatching,
  };
});
