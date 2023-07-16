/* eslint-disable @typescript-eslint/no-explicit-any */
import { AppActions } from './types'

export const actions: AppActions = {
  setConnectivityStatus(status: web3n.connectivity.OnlineAssesment) {
    const parsedStatus = status.split('_')
    this.connectivityStatus = parsedStatus[0]
  },
  setUser(user: string) {
    this.user = user
  },
  setLang(lang: AvailableLanguages) {
    this.lang = lang
  },
  setColorTheme({ theme, colors }: { theme: AvailableColorThemes, colors: Record<string, string> }) {
    this.theme = theme
    this.colors = colors

    const parentElement = document.documentElement
    if (parentElement) {
      parentElement.setAttribute('data-theme', theme)
      for (const item of Object.entries(colors)) {
        const [color, value] = item
        parentElement.style.setProperty(`--${color}`, value)
      }
    }
  },
  setAppWindowSize({ width = 0, height = 0 }) {
    this.appWindowSize = {
      ...this.appWindowSize,
      ...(width && { width }),
      ...(height && { height }),
    }
  },
}