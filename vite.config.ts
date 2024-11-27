import { resolve } from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueDevTools from 'vite-plugin-vue-devtools';

// https://vitejs.dev/config/
// @ts-ignore
export default defineConfig(({ mode }) => {
  const isDev = mode === 'development';
  // const isProd = mode === 'production';

  const server = {
    port: '3030',
    cors: { origin: '*' },
  };
  const define = { 'process.env': {} };

  const plugins = [
    vue(),
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
          videoChat: resolve(__dirname, './video-chat.html'),
        },
        output: [
          {
            name: 'main',
            dir: 'app',
          },
          {
            name: 'videoChat',
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
});
