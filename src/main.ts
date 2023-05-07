import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { router } from './router'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { vueBusPlugin } from './store/vue-bus-plugin'
import { iconsInitialization } from './icons'
import { initializationServices } from '@/services/services-provider'
import App from '@/components/app.vue'

import '@varlet/touch-emulator'
import '@/assets/styles/main.css'

import { I18n } from '@/plugins/i18n'
import { bus } from '@/plugins/vue-bus'
import en from './data/i18/en.json'

dayjs.extend(relativeTime)

const mode = process.env.NODE_ENV

const init = () => {
  iconsInitialization()
  initializationServices()
    .then(() => {
      const pinia = createPinia()
      pinia.use(vueBusPlugin)
      const app = createApp(App)

      app.config.globalProperties.$router = router
      // app.config.globalProperties.$store = store

      app
        .use(pinia)
        .use(I18n, { lang: 'en', messages: { en } })
        .use(bus)
        .use(router)
        .provide('$dayjs', dayjs)
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
