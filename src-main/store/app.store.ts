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
import { AvailableColorTheme, AvailableLanguage } from '~/app.types';
import { useSystemLevelAppConfig } from './app/system-level-app-config';
import { useConnectivityStatus } from './app/connectivity';
import { useAppSize } from './app/app-size';

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

export interface AppWindowSize {
  width: number;
  height: number;
}

export const useAppStore = defineStore('app', () => {

  const appSize = useAppSize();
  const {
    appElement
  } = appSize;

  const connectivity = useConnectivityStatus();
  const {
    connectivityStatus
  } = connectivity;

  const commonAppConfs = useSystemLevelAppConfig();
  const {
    appVersion,
    user,
    lang,
    colorTheme
  } = commonAppConfs;

  async function initialize() {
    await Promise.all([
      connectivity.initialize(),
      commonAppConfs.initialize()
    ]);
  }

  function stopWatching() {
    appSize.stopWatching();
    connectivity.stopConnectivityCheck();
    commonAppConfs.stopWatching();
  }

  return {
    appVersion,
    user,
    lang,
    colorTheme,

    connectivityStatus,

    appElement,

    initialize,
    stopWatching,
  };
});

export type AppStore = ReturnType<typeof useAppStore>;
