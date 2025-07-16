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

/// <reference path="../w3n.d.ts" />

/**
 * This is used by system utility launcher app, and concerns only platform
 * developers, not app developers. Nonetheless, app developers have a standard
 * for distributing apps via http, and it necessarily reflects in the api here.
 */
declare namespace web3n.system.apps {

	/**
	 * Apps CAP allows opening apps and modification of what is installed in
	 * "user's system".
	 * 
	 * User's system's synchronized storage has standard system folders:
	 *  - 'App&Lib Packs' contains packs/folders with different apps' versions.
	 *  - 'Apps Code' is a folder from which app's components' code is loaded to
	 *    run in respective runtimes. Every app can have only one version
	 *    "installed". And "install" is implemented by linking a respective
	 *    app version from packs into code folders tree.
	 * 
	 * In addition, platform distribution can come with bundled zipped app packs
	 * that simplify first time system setup.
	 * Platform also comes with unzipped bundled apps for startup and launcher,
	 * but, these two apps are updated together with the platform, being an
	 * interface to the platform before user signs in, and right after.
	 */
	interface Apps {
		/**
		 * opener of apps can list and gather info about apps in user's system.
		 */
		opener?: AppsOpener;
		/**
		 * downloader has methods to download apps from the network.
		 */
		downloader?: AppsDownloader;
		/**
		 * installer adds and removes apps into user's system.
		 */
		installer?: AppsInstaller;
	}

	interface AppsOpener {
		/**
		 * This lists apps in user's system, returning an array with found apps'
		 * versions.
		 * @param filter if present, instructs to list only app versions in given
		 * state(s). Otherwise, all are listed.
		 */
		listApps(filter?: AppState[]): Promise<AppVersions[]>;
		/**
		 * This returns app's versions in user's system. Undefined is returned
		 * when an app is not found in user's system.
		 * @param id identifies app, which versions should be returned.
		 * @param filter if present, instructs to list only app versions in given
		 * state(s). Otherwise, all are listed.
		 */
		getAppVersions(
			id: string, filter?: AppState[]
		): Promise<AppVersions|undefined>;
		/**
		 * This returns a manifest of a particular app version. Undefined is
		 * returned, when a given app version is not found in user's system.
		 * @param id identifies app.
		 * @param version identifies app version. If missing, an installed
		 * version is assumed.
		 */
		getAppManifest(
			id: string, version?: string
		): Promise<caps.AppManifest|undefined>;
		/**
		 * This returns bytes of a file from app's version pack. Undefined is
		 * returned, when a given app version is not found in user's system.
		 * @param id identifies app.
		 * @param path is a path to file inside app folder of app's version pack.
		 * @param version identifies app version. If missing, an installed
		 * version is assumed.
		 */
		getAppFileBytes(
			id: string, path: string, version?: string
		): Promise<Uint8Array|undefined>;
		/**
		 * This starts watching app events, returning an unsubscribe function.
		 * @param observer is a consumer of app events
		 */
		watchApps(observer: Observer<AppEvent>): () => void;
		/**
		 * This opens/starts app's web-gui component.
		 * @param id identifies app.
		 * @param entrypoint identifies component to start. Default is /index.html
		 * @param devTools is a flag to enable devtools in a started instance.
		 */
		openApp(
			id: string, entrypoint?: string, devTools?: boolean
		): Promise<void>;
		/**
		 * This triggers execution of a command.
		 * @param id identifies app.
		 * @param cmd identifies command and parameters that should be passed.
		 * @param devTools is a flag to enable devtools in a started instance.
		 */
		executeCommand(
			id: string, cmd: shell.commands.CmdParams, devTools?: boolean
		): Promise<void>;
		/**
		 * This triggers execution of all on-system-startup launchers.
		 * Such call is needed after the first system initialization setup.
		 */
		triggerAllStartupLaunchers(): Promise<void>;
		/**
		 * This closes apps that are running non-current versions after an update.
		 * @param appsToClose ids of apps that need old versions to be closed.
		 */
		closeAppsAfterUpdate(appsToClose: string[]): Promise<void>;
	}

	interface AppVersions {
		/**
		 * id is a unique identitfier of an app, usually app domain
		 */
		id: string;
		/**
		 * current is a currently installed version, if any.
		 * Only one version of an app can be installed at any moment.
		 */
		current?: string;
		/**
		 * packs is an array of app versions in user's system.
		 */
		packs?: string[];
	}

	type AppState = 'current' | 'packs';

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
		installApp(id: string, version: string): Promise<PostInstallState>;
		removeAppPack(id: string, version: string): Promise<void>;
		uninstallApp(id: string): Promise<void>;
		// removeAppData(id: string);
	}

	type PostInstallState = 'all-done' | 'need-restart' | 'need-restart-many';

	interface BundleUnpackProgress {
		numOfFiles: number;
		numOfProcessed: number;
		fileInProgress?: string;
	}

	interface SystemParamsForInstalledApp {
		capsGrantsOverrides?: CAPsGrantsOverrides;
		hasStartupLaunchers: boolean;
		launchersOverrides?: LaunchersOverrides;
	}

	interface CAPsGrantsOverrides {
	}

	interface LaunchersOverrides {
	}

}