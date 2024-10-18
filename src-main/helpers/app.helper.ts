import { useAppStore } from '../store'
import { AppConfigs, UISettings } from './ui-settings'

export async function getAppConfig (): Promise<AppConfigs> {
  const { setLang, setColorTheme } = useAppStore()
  const configs = await UISettings.makeResourceReader()
  const lang = await configs.getCurrentLanguage()
  const { currentTheme, colors } = await configs.getCurrentColorTheme()
  setLang(lang)
  setColorTheme({ theme: currentTheme, colors })
  return configs
}
