/*
 Copyright (C) 2020 - 2024 3NSoft Inc.

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

export type IncomingMessage = web3n.asmail.IncomingMessage;
export type AttachmentsContainer = web3n.asmail.AttachmentsContainer;
export type FS = web3n.files.FS;
export type FileW = web3n.files.File;
export type ReadonlyFS = web3n.files.ReadonlyFS;
export type WritableFS = web3n.files.WritableFS;
export type ReadonlyFile = web3n.files.ReadonlyFile;
export type WritableFile = web3n.files.WritableFile;

export interface FileWithId extends ReadonlyFile {
  fileId: string;
}

export type AvailableLanguage = 'en';

export type AvailableColorTheme = 'default' | 'dark';

export type ConnectivityStatus = 'offline' | 'online';

export type SystemMessageHandlerParams = {
  msgId?: string;
  chatId?: string;
  sender?: string;
  chatMessageId?: string;
  value?: any;
  displayable?: boolean;
};

export interface MessageDeliveryStatusUI {
  icon: string;
  color: string;
}

export type AppConfig = {
  lang: AvailableLanguage;
  colorTheme: AvailableColorTheme;
};

export interface AppConfigsInternal {
  getSettingsFile: () => Promise<AppSettings>;
  saveSettingsFile: (data: AppSettings) => Promise<void>;
  getCurrentLanguage: () => Promise<AvailableLanguage>;
  getCurrentColorTheme: () => Promise<AvailableColorTheme>;
}

export interface AppConfigs {
  getCurrentLanguage: () => Promise<AvailableLanguage>;
  getCurrentColorTheme: () => Promise<AvailableColorTheme>;
  watchConfig(obs: web3n.Observer<AppConfig>): () => void;
}

export interface SettingsJSON {
  lang: AvailableLanguage;
  colorTheme: AvailableColorTheme;
}

export interface AppSettings {
  currentConfig: SettingsJSON;
}

export interface Ui3nTextEnterEvent {
  value: string;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export interface AppGlobalEvents {
  'send:message': { chatId: string };
}
