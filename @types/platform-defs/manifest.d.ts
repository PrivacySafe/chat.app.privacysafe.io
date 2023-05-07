/*
 Copyright (C) 2021 - 2022 3NSoft Inc.

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

/// <reference path="../core-defs/common-caps.d.ts" />

declare namespace web3n.caps {

	interface AppManifest {
		appDomain: string;
		version: string;
		name?: string;
		components?: {
			[entrypoint: string]: AppComponent;
		};
	}

	interface UserStartedComponent extends CommonComponentSetting {
		startedBy: 'user';
		runtime: GUIRuntime;
		name: string;
		icon?: string;
		windowOpts?: ui.WindowOptions;
	}

	interface ServiceComponent extends CommonComponentSetting {
		startedBy: AllowedServiceCallers;
		services: string | string[];
		forOneConnectionOnly?: true;
	}

	interface GUIServiceComponent extends CommonComponentSetting {
		runtime: GUIRuntime;
		startedBy: AllowedServiceCallers;
		service: string;
		windowOpts?: ui.WindowOptions;
		allowNonGUICaller?: true;
		childOfGUICaller?: true;
		forOneConnectionOnly?: true;
	}

	interface CommonComponentSetting {
		runtime: NonGUIRuntime | GUIRuntime;
		capsRequested?: RequestedCAPs;
		sharedLibs?: SharedLibInfo[];
		multiInstances?: true;

		// XXX add implementation for openComponent to open this app components
		//     that are not services. E.g. LibreOffice opens Calc or Writer
		//     components.
		openComponent?: string[];
	}

	type GUIRuntime = 'web-gui';

	type NonGUIRuntime = 'wasm,mp1' | 'deno';

	interface AllowedServiceCallers {
		thisAppComponents?: '*' | string[];
		otherApps?: '*' | string[];
	}

	type AppComponent = UserStartedComponent |
		ServiceComponent | GUIServiceComponent;

	interface SharedLibInfo {
		libDomain: string;
		version: { hash: string; alg: string; }
	}

	interface RequestedCAPs extends common.RequestedCAPs {
		apps?: AppsCAPSetting;
		logout?: LogoutCAPSetting;
		appRPC?: AppRPCCAPSetting;
		otherAppsRPC?: OtherAppsRPCCAPSetting;
		shell?: ShellCAPsSetting;
		connectivity?: ConnectivityCAPSetting;
	}

	type AppsCAPSetting = 'all' | (keyof apps.Apps)[];

	type LogoutCAPSetting = 'all';

	interface AppRPCCAPSetting {
		serviceComponents: string[];
	}

	interface OtherAppsRPCCAPSetting {
		callable: {
			app: string;
			component: string;
		}[];
	}

	interface ShellCAPsSetting {
		fileDialog?: FileDialogsCAPSettings;
		mountFS?: DeviceMountFSCAPSetting;
		userNotifications?: true;
	}

	type FileDialogsCAPSettings = 'all' | 'readonly';

	type DeviceMountFSCAPSetting = 'all';

	type ConnectivityCAPSetting = 'check';

	interface SiteManifest {
		siteDomain: string;
		version: string;
		name: string;
		components?: {
			[entrypoint: string]: SiteComponent;
		};
	}

	interface SiteComponent {
		servedFromRemote?: true;
		subRoot?: string;
		capsRequested?: RequestedSiteCAPs;
		multiInstances?: true;
	}

	interface RequestedSiteCAPs {}

}
