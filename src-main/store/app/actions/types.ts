/* eslint-disable @typescript-eslint/no-explicit-any */
import { PiniaActionTree } from '../../types'
import { AppStore } from '../types'

export type Actions = {
  setConnectivityStatus(status: web3n.connectivity.OnlineAssesment): void;
  setUser(user: string): void;
  setLang(lang: AvailableLanguages): void;
  setColorTheme({ theme, colors }: { theme: AvailableColorThemes, colors: Record<string, string> }): void;
  setAppWindowSize({ width = 0, height = 0 }): void;
}

export type AppActions = PiniaActionTree<Actions, AppStore>
