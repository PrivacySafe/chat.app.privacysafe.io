import path, { resolve } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import components from 'unplugin-vue-components/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  const isProd = mode === 'production'

  const server = {
    port: '3030',
    cors: { origin: '*' },
  }
  const define = { 'process.env': {} }

  const plugins = [
    vue(),
    components({
      dirs: [ 'src-main/components', 'src-video' ]
    }),
  ]

  let optimizeDeps = {}
  if (isDev) {
    optimizeDeps = {
      include: [
        'vue',
        'vue-router',
        'lodash',
        'dayjs'
      ]
    }
  }

  return {
    server,
    build: {
      // reference: https://rollupjs.org/configuration-options/
      rollupOptions: {
        input: {
          main: resolve(__dirname, './index.html'),
          videoChat: resolve(__dirname, './video-chat.html'),
        },
        output: [
          {
            name: "main",
            dir: "app"
          },
          {
            name: "videoChat",
            dir: "app"
          }
        ]
      }
    },
    define,
    plugins,
    optimizeDeps,
    resolve: {
      alias: {
        'vue': 'vue/dist/vue.esm-bundler.js'
      }
    }
  }
})
