import { makeConfig as originalConfigMaker } from '../vite.config';
import { defineConfig } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
// @ts-ignore
export default defineConfig(conf => {
  const appConf = originalConfigMaker(conf);
  appConf.build.rollupOptions = {
    input: {
      "testApp": resolve(__dirname, './index.html')
    },
    output: [
      {
        name: 'testApp',
        dir: 'build/app'
      }
    ]
  };
  appConf.resolve.alias['@tests'] = resolve(__dirname, './src');
  return appConf;
});
