// @ts-ignore
export function i18nPlugin(context) {
  const { app = {} } = context
  const { config = {} } = app
  const { globalProperties = {} } = config
  const { $locale, $changeLocale, $tr } = globalProperties
  const methods: {
    locale: string;
    changeLocale: (lang: string) => void;
    tr: (key: string, placeholders?: Record<string, string>) => string;
  } = {
    locale: $locale,
    changeLocale: $changeLocale,
    tr: $tr,
  }
  return { $i18n: methods }
}
