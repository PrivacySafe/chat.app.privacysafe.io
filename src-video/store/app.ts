import { defineStore } from 'pinia';
import { UISettings } from '@main/helpers/ui-settings';
import type { AvailableColorTheme, AvailableLanguage } from '~/app.types.ts';

export const useAppStore = defineStore('app', {
  state: () => ({
    user: '',
    lang: 'en',
    colorTheme: 'default',
  }),

  actions: {
    async getUser() {
      this.user = await w3n.mailerid!.getUserId();
    },

    setLang(lang: AvailableLanguage) {
      this.lang = lang;
    },

    setColorTheme(theme: AvailableColorTheme) {
      this.colorTheme = theme;
      const htmlEl = document.querySelector('html');
      if (!htmlEl) return;

      const prevColorThemeCssClass = theme === 'default' ? 'dark-theme' : 'default-theme';
      const curColorThemeCssClass = theme === 'default' ? 'default-theme' : 'dark-theme';
      htmlEl.classList.remove(prevColorThemeCssClass);
      htmlEl.classList.add(curColorThemeCssClass);
    },

    async getAppConfig() {
      try {
        const config = await UISettings.makeResourceReader();
        const lang = await config.getCurrentLanguage();
        const colorTheme = await config.getCurrentColorTheme();
        this.setLang(lang);
        this.setColorTheme(colorTheme);

        return config;
      } catch (e) {
        console.error('Load the app config error: ', e);
      }
    },
  },
});
