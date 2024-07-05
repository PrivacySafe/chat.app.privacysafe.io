/*
 Copyright (C) 2021 - 2024 3NSoft Inc.

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

/// <reference path="./manifest.d.ts" />

/**
 * This is used by system utility launcher app, and concerns only platform
 * developers, not app developers. Nonetheless, app developers have a standard
 * for distributing apps via http, and it necessarily reflects in the api here.
 */
declare namespace web3n.apps {

	interface Apps {
		opener?: AppsOpener;
		downloader?: AppsDownloader;
		installer?: AppsInstaller;
		platform?: Platform;
	}

	interface AppsOpener {
		listApps(filter?: AppState[]): Promise<AppVersions[]>;
		openApp(id: string, devTools?: boolean): Promise<void>;
		getAppVersions(
			id: string, filter?: AppState[]
		): Promise<AppVersions|undefined>;
		getAppManifest(
			id: string, version?: string
		): Promise<caps.AppManifest|undefined>;
		getAppFileBytes(
			id: string, path: string, version?: string
		): Promise<Uint8Array|undefined>;
		watchApps(observer: Observer<AppEvent>): () => void;
	}

	interface AppVersions {
		id: string;
		current?: string;
		packs?: string[];
		bundled?: string;
	}

	type AppState = 'current' | 'packs' | 'bundled';

	interface AppEvent {
		type: 'installed' | 'uninstalled';
		id: string;
		version: string;
	}

	interface AppsDownloader {
		getAppChannels(id: string): Promise<DistChannels>;
		getLatestAppVersion(id: string, channel: string): Promise<string>;
		getAppVersionFilesList(
			id: string, version: string
		): Promise<AppDistributionList>;
		downloadWebApp(
			id: string, version: string, observer: Observer<DownloadProgress>
		): () => void;
	}

	interface DistChannels {
		channels: {
			[channel: string]: {
				description?: string;
				usage?: 'public' | 'staging';
			};
		};
		main?: string;
	}

	interface AppDistributionList {
		files: {
			[fName: string]: {
				content: DistAppFileContent;
				sha512: string;
				size: number;
			};
		};
	}

	type DistAppFileContent = 'bin/zip' | 'bin/unpacked' | 'src/zip';	

	interface DownloadProgress {
		totalFiles: number;
		filesLeft: number;
		totalBytes: number;
		bytesLeft: number;
		fileInProgress?: string;
		currentFileSize?: number;
	}

	interface AppsInstaller {
		unpackBundledApp(
			id: string, observer: Observer<BundleUnpackProgress>
		): () => void;
		installApp(id: string, version: string): Promise<void>;
		removeAppPack(id: string, version: string): Promise<void>;
		uninstallApp(id: string): Promise<void>;
		// removeAppData(id: string);
	}

	interface BundleUnpackProgress {
		numOfFiles: number;
		numOfProcessed: number;
		fileInProgress?: string;
	}

	interface Platform {
		getCurrentVersion(): Promise<string>;
		getChannels(): Promise<DistChannels>;
		getLatestVersion(channel: string): Promise<string>;
		getVersionList(version: string): Promise<AppDistributionList>;
		availableUpdateType(): Promise<string|undefined>;
		downloadAndApplyUpdate(
			channel: string, observer: Observer<PlatformDownloadProgress>
		): () => void;
	}

	type PlatformDownloadProgress = {
		event: 'checking-for-update';
	} | {
		event: 'update-available';
		totalSizeMBs: number;
	} | {
		event: 'download-progress';
		percent: number;
	};

}