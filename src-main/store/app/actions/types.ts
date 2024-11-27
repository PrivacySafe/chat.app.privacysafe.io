/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PiniaActionTree } from '@v1nt1248/3nclient-lib/plugins';
import type { AppStore } from '../types';
import type { AppConfigs, AvailableLanguage, AvailableColorTheme } from '~/index';

export type Actions = {
  getAppVersion(): Promise<void>;
  getConnectivityStatus(): Promise<void>;
  getUser(): Promise<void>;
  setLang(lang: AvailableLanguage): void;
  setColorTheme(theme: AvailableColorTheme): void;
  getAppConfig(): Promise<AppConfigs | undefined>;
  setAppWindowSize({ width, height }: { width: number; height: number }): void;
}

export type AppActions = PiniaActionTree<Actions, AppStore>;
