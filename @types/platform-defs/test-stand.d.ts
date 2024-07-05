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

declare namespace web3n.testing {

	interface CommonW3N extends web3n.caps.W3N {
		testStand: testing.TestStand;
	}

	interface StartupW3N extends web3n.startup.W3N {
		testStand: testing.StartupTestStand;
	}

	interface StaticTestInfo {
		userNum: number;
		userId: string;
	}

	interface BasicTestStand {
		exitAll(): Promise<void>;
		record(type: TestRecordType, msg?: string): Promise<void>;
		log: caps.common.Logger;
	}

	interface TestStand extends BasicTestStand {
		staticTestInfo(): Promise<StaticTestInfo>;
		idOfTestUser(userNum: number): Promise<string>;
		observeMsgsFromOtherLocalTestProcess(
			userNum: number|undefined, appDomain: string|undefined,
			component: string|undefined, observer: Observer<any>
		): () => void;
		sendMsgToOtherLocalTestProcess(
			userNum: number|undefined, appDomain: string|undefined,
			component: string|undefined, msg: any
		): Promise<void>;
	}

	type TestRecordType = 'tests-start' |
		'spec-pass' | 'spec-pending' | 'spec-fail' | 'suite-fail' |
		'tests-pass' | 'tests-fail';

	interface StartupTestStand extends BasicTestStand {
		staticTestInfo(): Promise<StaticTestInfo & {
			pass: string; signupToken?: string;
		}>;
	}

}
