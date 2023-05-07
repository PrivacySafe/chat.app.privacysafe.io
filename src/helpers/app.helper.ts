import { useAppStore } from '@/store/app.store'
import { makeServiceCaller } from '@/libs/ipc-service-caller'

export async function getAppConfig (): Promise<void> {
  const appStore = useAppStore()
  let configSrvConnection: web3n.rpc.client.RPCConnection
  try {
    configSrvConnection = await w3n.otherAppsRPC!('launcher.app.privacysafe.io', 'AppConfigs')
    const configSrv = makeServiceCaller<AppConfigs>(configSrvConnection, ['getCurrentLanguage', 'getCurrentColorTheme']) as AppConfigs

    const lang = await configSrv.getCurrentLanguage()
    const { currentTheme, colors } = await configSrv.getCurrentColorTheme()
    appStore.setLang(lang)
    appStore.setColorTheme({ theme: currentTheme, colors })
  } catch (e) {
    console.error(e)
  } finally {
    await configSrvConnection!.close()
  }
}
