import { App, Plugin } from 'vue'

interface I18nOptions {
  lang: string;
  messages: Record<string, Record<string, string>>;
}

export const I18n: Plugin = {
  install: (app: App, options: I18nOptions) => {
    const { lang, messages } = options
    const allLanguages = Object.keys(messages) || []

    app.config.globalProperties.$locale = lang

    app.config.globalProperties.$tr = (key: string, placeholders?: Record<string, string>) => {
      let message = messages[app.config.globalProperties.$locale][key]
      if (placeholders) {
        for (const item of Object.entries(placeholders)) {
          const [placeholder, value] = item
          if (message.includes(`{${placeholder}}`)) {
            message = message.replace(`{${placeholder}}`, value)
          }
        }
      }

      return message
    }

    app.config.globalProperties.$changeLocale = (lang: string) => {
      if (!allLanguages.includes(lang)) {
        throw new Error(`The language ${lang} is undefined.`)
      }
      app.config.globalProperties.$locale = lang
    }
  },
}

declare module '@vue/runtime-core' {
  export interface ComponentCustomProperties {
    $locale: string;
    $tr: (key: string, placeholders?: Record<string, string>) => string;
    $changeLocale: (lang: string) => void;
  }
}
