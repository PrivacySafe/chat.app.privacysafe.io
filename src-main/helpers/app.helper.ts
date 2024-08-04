import { useAppStore } from '../store'
import { makeServiceCaller } from '../libs/ipc/ipc-service-caller'

export async function getAppConfig (): Promise<void> {
  const { setLang, setColorTheme } = useAppStore()

  let configSrvConnection: web3n.rpc.client.RPCConnection
  try {
    configSrvConnection = await w3n.rpc!.otherAppsRPC!('launcher.app.privacysafe.io', 'AppConfigs')
    const configSrv = makeServiceCaller<AppConfigs>(configSrvConnection, ['getCurrentLanguage', 'getCurrentColorTheme']) as AppConfigs

    const lang = await configSrv.getCurrentLanguage()
    const { currentTheme, colors } = await configSrv.getCurrentColorTheme()
    setLang(lang)
    setColorTheme({ theme: currentTheme, colors })
  } catch (e) {
    console.error(e)
  } finally {
    await configSrvConnection!.close()
  }
}
