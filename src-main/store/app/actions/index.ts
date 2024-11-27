/* eslint-disable @typescript-eslint/no-explicit-any */
import { UISettings } from '@main/helpers/ui-settings';
import type { AppActions } from './types';
import type { AppConfigs, AvailableLanguage, AvailableColorTheme, ConnectivityStatus } from '~/index';

const getAppVersion: AppActions['getAppVersion'] = async function(this) {
  const v = await w3n.myVersion();
  if (v) {
    this.appVersion = v;
  }
};

const getConnectivityStatus: AppActions['getConnectivityStatus'] = async function(this) {
  const status = await w3n.connectivity!.isOnline();
  if (status) {
    const parsedStatus = status.split('_');
    this.connectivityStatus = parsedStatus[0] as ConnectivityStatus;
  }
};

const getUser: AppActions['getUser'] = async function(this) {
  this.user = await w3n.mailerid!.getUserId();
};

const setLang: AppActions['setLang'] = function(this, lang: AvailableLanguage) {
  this.lang = lang;
};

const setColorTheme: AppActions['setColorTheme'] = function(this, theme: AvailableColorTheme) {
  this.colorTheme = theme;
  const htmlEl = document.querySelector('html');
  if (!htmlEl) return;

  const prevColorThemeCssClass = theme === 'default' ? 'dark-theme' : 'default-theme';
  const curColorThemeCssClass = theme === 'default' ? 'default-theme' : 'dark-theme';
  htmlEl.classList.remove(prevColorThemeCssClass);
  htmlEl.classList.add(curColorThemeCssClass);
};

const getAppConfig: AppActions['getAppConfig'] = async function(this): Promise<AppConfigs | undefined> {
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
};

const setAppWindowSize: AppActions['setAppWindowSize'] = function(this, { width = 0, height = 0 }) {
  this.appWindowSize = {
    ...this.appWindowSize,
    ...(width && { width }),
    ...(height && { height }),
  };
};

export const actions: AppActions = {
  getAppVersion,
  getConnectivityStatus,
  getUser,
  setLang,
  setColorTheme,
  getAppConfig,
  setAppWindowSize,
};
