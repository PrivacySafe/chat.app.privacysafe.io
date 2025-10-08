import { resolve } from 'node:path';
import { defineConfig, UserConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

function _resolve(dir: string) {
  return resolve(__dirname, dir);
}

export const makeConfig = ({ mode }: UserConfig) => {
  const isDev = mode === 'development';
  // const isProd = mode === 'production';

  const server = {
    port: '3030',
    cors: { origin: '*' },
  };
  const define = { 'process.env': {} };

  const plugins = [
    vue(),
    nodePolyfills({
      include: ['timers', 'timers/promises'],
    }),
    vueDevTools(),
  ];

  let optimizeDeps = {};
  if (isDev) {
    optimizeDeps = {
      include: [
        'vue',
        'vue-router',
        'pinia',
        'lodash',
        'dayjs',
      ],
    };
  }

  return {
    server,
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
        },
      },
    },
    build: {
      // reference: https://rollupjs.org/configuration-options/
      rollupOptions: {
        input: {
          main: _resolve('./index.html'),
          'main-mobile': _resolve('./index-mobile.html'),
          videoChat: _resolve('./video-chat.html'),
          'videoChat-mobile': _resolve('./video-chat-mobile.html'),
        },
        output: [
          {
            name: 'main',
            dir: 'app',
          },
          {
            name: 'main-mobile',
            dir: 'app',
          },
          {
            name: 'videoChat',
            dir: 'app',
          },
          {
            name: 'videoChat-mobile',
            dir: 'app',
          },
        ],
      },
    },
    define,
    plugins,
    optimizeDeps,
    resolve: {
      alias: {
        'vue': 'vue/dist/vue.esm-bundler.js',
        '@main': _resolve('./src-main'),
        '@video': _resolve('./src-video'),
        '@shared': _resolve('./shared-libs'),
        '@bg': _resolve('./src-background-instance'),
        '~': _resolve('./types'),
      },
    },
  };
};

// https://vitejs.dev/config/
// @ts-ignore
export default defineConfig(makeConfig);
