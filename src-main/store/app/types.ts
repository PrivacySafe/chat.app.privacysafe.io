/* eslint-disable @typescript-eslint/no-explicit-any */
import { Store } from 'pinia';
import type { Actions } from './actions/types';
import { AvailableColorTheme, AvailableLanguage } from '~/index';

export interface State {
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

export type AppStore<G = any> = Store<'app', State, G, Actions>;
