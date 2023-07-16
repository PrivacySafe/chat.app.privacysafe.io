interface I18nOptions {
  lang: string;
  messages: Record<string, Record<string, string>>;
}

interface I18nPlugin {
  $locale: string;
  $tr: (key: string, placeholders?: Record<string, string>) => string;
  $changeLocale: (lang: string) => void;
}
