/*
 Copyright (C) 2024 3NSoft Inc.

 This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU General Public License as published by the Free Software
 Foundation, either version 3 of the License, or (at your option) any later
 version.

 This program is distributed in the hope that it will be useful, but
 WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 this program. If not, see <http://www.gnu.org/licenses/>.
*/

export interface AppConfigsInternal {
  getSettingsFile: () => Promise<AppSettings>;
  saveSettingsFile: (data: AppSettings) => Promise<void>;
  getCurrentLanguage: () => Promise<AvailableLanguages>;
  getCurrentColorTheme: () => Promise<{currentTheme: AvailableColorThemes, colors: Record<string, string> }>;
}

export interface AppConfigs {
  getCurrentLanguage: () => Promise<AvailableLanguages>;
  getCurrentColorTheme: () => Promise<{
    currentTheme: AvailableColorThemes; colors: Record<string, string>;
  }>;
  watchConfig(obs: web3n.Observer<AppConfig>): () => void;
}

export interface AppConfig {
  lang: AvailableLanguages;
  currentTheme: AvailableColorThemes;
  colors: Record<string, string>;
}


const resourceName = "ui-settings"
const resourceApp = "launcher.app.privacysafe.io"
const resourcePathInAppStorage = "/ui-settings"

const settingsPath = '/settings.json'
export interface SettingsJSON {
  language: AvailableLanguages;
  theme: AvailableColorThemes;
}

export interface AppSettings {
  currentConfig: SettingsJSON;
}

function themeFilePath(theme: string): string {
  return `/themes/${theme}-theme.json`
}
interface ThemeJSON {
  colors: Record<string, string>;
}

export class UISettings implements AppConfigs, AppConfigsInternal {

  private constructor(
    private readonly fs: web3n.files.FS
  ) {}

  static async makeInternalService(): Promise<AppConfigsInternal> {
    // this implicitly initializes resource, and will fail if it isn't launcher
    await w3n.shell!.getFSResource!(undefined, resourceName)
    const localStore = await w3n.storage!.getAppLocalFS!()
    const fs = await localStore.writableSubRoot(resourcePathInAppStorage)
    return new UISettings(fs)
  }

  static async makeResourceReader(): Promise<AppConfigs> {
    const fs = await w3n.shell!.getFSResource!(resourceApp, resourceName)
    return new UISettings(fs as web3n.files.FS)
  }

  private get writableFS(): web3n.files.WritableFS {
    if (this.fs.writable) {
      return this.fs as web3n.files.WritableFS
    } else {
      throw Error(`This instance can only read ${resourceName} fs resource provided by ${resourceApp}`)
    }
  }

  async getSettingsFile(): Promise<AppSettings> {
    const currentConfig = await this.fs.readJSONFile<SettingsJSON>(settingsPath)
    return { currentConfig }
  }

  async saveSettingsFile(data: AppSettings): Promise<void> {
    const settingsJSON = data.currentConfig as SettingsJSON
    await this.writableFS.writeJSONFile(settingsPath, settingsJSON)
  }

  async getCurrentLanguage(): Promise<AvailableLanguages> {
    const { language } = await this.fs.readJSONFile<SettingsJSON>(settingsPath);
    return language
  }

  async getCurrentColorTheme(): Promise<{
    currentTheme: AvailableColorThemes;
    colors: Record<string, string>;
  }> {
    const {
      theme: currentTheme
    } = await this.fs.readJSONFile<SettingsJSON>(settingsPath);
    const { colors } = await this.fs.readJSONFile<ThemeJSON>(
      themeFilePath(currentTheme)
    )
    return { currentTheme, colors }
  }

  watchConfig(obs: web3n.Observer<AppConfig>): () => void {
    return this.fs.watchTree('/', 4, {
      next: (obs.next ? async event => {
        if ((event.type === 'file-change') && (event.path === settingsPath)) {
          const lang = await this.getCurrentLanguage()
          const { colors, currentTheme } = await this.getCurrentColorTheme()
          obs.next!({ lang, colors, currentTheme })
        }
      } : undefined),
      complete: (obs.complete ? () => obs.complete!() : undefined),
      error: err => (obs.error ? obs.error!(err) : undefined)
    })
  }

}
