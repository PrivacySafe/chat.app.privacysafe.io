import type { SettingsJSON } from '../../types/app.types.ts';
import en from '../../src-main/common/data/i18/en.ts';

const LANGUAGE_BY_FILE: Record<string, Record<string, string>> = {
  'en': en,
};

export class AppSettings {
  private file: web3n.files.File | undefined = undefined;
  private lang = 'en';

  constructor() {
    this.makeResourceReader();
  }

  private async makeResourceReader() {
    this.file = await w3n.shell!.getFSResource!('launcher.app.privacysafe.io', 'ui-settings') as web3n.files.ReadonlyFile;
  }

  async getCurrentLanguage() {
    if (!this.file) {
      await this.makeResourceReader();
    }

    const { lang } = await this.file!.readJSON<SettingsJSON>();
    this.lang = lang;
    return lang;
  }

  async $tr(key: string, placeholders?: Record<string, string>): Promise<string> {
    await this.getCurrentLanguage();
    const currentLanguageFile = LANGUAGE_BY_FILE[this.lang] || en;
    let text = currentLanguageFile[key];
    if (!text) {
      return key;
    }

    if (placeholders) {
      for (const item of Object.entries(placeholders)) {
        const [placeholder, value ] = item;
        if (text.includes(`{${placeholder}}`)) {
          text = text.replaceAll(`{${placeholder}}`, value);
        }
      }
    }

    return text;
  }
}
