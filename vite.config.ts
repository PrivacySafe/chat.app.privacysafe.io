import { resolve } from 'node:path';
import { defineConfig, UserConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

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
          main: resolve(__dirname, './index.html'),
          'main-mobile': resolve(__dirname, './index-mobile.html'),
          videoChat: resolve(__dirname, './video-chat.html'),
          'videoChat-mobile': resolve(__dirname, './video-chat-mobile.html'),
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
        '@main': resolve(__dirname, './src-main'),
        '@video': resolve(__dirname, './src-video'),
        '@shared': resolve(__dirname, './shared-libs'),
        '@bg': resolve(__dirname, './src-background-instance'),
        '~': resolve(__dirname, './types'),
      },
    },
  };
};

// https://vitejs.dev/config/
// @ts-ignore
export default defineConfig(makeConfig);
