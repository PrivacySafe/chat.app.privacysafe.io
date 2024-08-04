/* eslint-disable @typescript-eslint/no-explicit-any */
import { Store } from 'pinia'
import { Actions } from './actions/types'

export interface State {
  connectivityStatus: string;
  user: string;
  lang: string;
  theme: 'default' | 'dark';
  colors: Record<string, string>;
  appWindowSize: {
    width: number;
    height: number;
  }
}

export type AppStore<G = any> = Store<'app', State, G, Actions>
