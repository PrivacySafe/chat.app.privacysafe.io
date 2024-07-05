import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import { dialogs, i18n, I18nOptions, notifications, storeVueBus, storeI18n, storeNotifications, vueBus, useIcons } from '@v1nt1248/3nclient-lib'
import { initializationServices } from '@/services/services-provider'
import App from '@/components/app.vue'

import '@v1nt1248/3nclient-lib/style.css'
import '@/assets/styles/main.css'

import en from './data/i18/en.json'

interface OpenChatCmdArg {
	peerAddress: string;
}

const mode = process.env.NODE_ENV

const init = () => {
  initializationServices()
    .then(async () => {
      const startCmd = await w3n.shell!.getStartedCmd!()
      if (startCmd) {
        console.log(`Chat app was started with command:`, startCmd)
      }
      const unsub = w3n.shell!.watchStartCmds!({
        next: cmd => console.log(`Command came to chat app:`, cmd),
        error: err => console.error(`Error in listening to commands for chat app:`, err),
        complete: () => console.log(`Listening to commands for chat app is closed by platform side.`)
      })
      return ((startCmd && (startCmd.cmd === 'open-chat-with')) ?
        (startCmd.params[0] as OpenChatCmdArg).peerAddress :
        undefined
      );
    })
    .then(addressToOpen => {
      const pinia = createPinia()
      pinia.use(storeVueBus)
      pinia.use(storeI18n)
      pinia.use(storeNotifications)

      const app = createApp(App)

      app.config.globalProperties.$router = router
      app.config.compilerOptions.isCustomElement = tag => {
        return tag.startsWith('ui3n-')
      }

      app
        .use(pinia)
        .use(useIcons)
        .use<I18nOptions>(i18n, { lang: 'en', messages: { en } })
        .use(vueBus)
        .use(dialogs)
        .use(notifications)
        .use(router)
        .mount('#main')
    })
}

if ((w3n as web3n.testing.CommonW3N).testStand && mode !== 'production') {
  import('@vue/devtools')
    .then(devtools => {
      (w3n as web3n.testing.CommonW3N).testStand.staticTestInfo()
        .then((data: { userNum: number, userId: string }) => {
          const { userNum } = data
          devtools.connect('http://localhost', 8098 + userNum);
          init()
        })
    })
} else if (mode !== 'production') {
  import('@vue/devtools')
    .then(devtools => {
      devtools.connect('http://localhost', 8098);
      init()
    })
} else {
  init()
}
