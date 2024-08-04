/*
 Copyright (C) 2022 3NSoft Inc.

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
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NamedProcs } from "../libs/processes/named-procs";
import { randomStr } from "../libs/random";

type FileException = web3n.files.FileException;
type XAttrsChanges = web3n.files.XAttrsChanges;
type WritableFS = web3n.files.WritableFS;
type ReadonlyFS = web3n.files.ReadonlyFS;

export interface LabelledFileStore {

	addBlob(blob: Blob, info?: ItemAttrs): Promise<string>;

	addFolder(folder: ReadonlyFS, info?: ItemAttrs): Promise<string>;

	getBlob(id: string): Promise<Blob>;

	getFolderRO(id: string): Promise<ReadonlyFS>;

	getFolderWR(id: string): Promise<WritableFS>;

	updateBlob(id: string, blob: Blob): Promise<void>;

	updateInfo(id: string, info: ItemAttrs): Promise<void>;

	getInfo(id: string): Promise<FileInfo | FolderInfo>;

	delete(id: string): Promise<void>;

}

export interface ItemAttrs {
	fileName?: string;
}

export interface ItemInfo extends ItemAttrs {
	id: string;
	version: number;
	ctime: Date;
	mtime: Date;
}

export interface FileInfo extends ItemInfo {
	isFile: true;
	size: number;
	type: string;
}

export interface FolderInfo extends ItemInfo {
	isFolder: true;
}

export async function makeLabelledFileStoreIn(
	pathInAppFSs: string
): Promise<LabelledFileStore> {
	const syncedFS = await w3n.storage!.getAppSyncedFS()
	.then(fs => fs.writableSubRoot(pathInAppFSs));
	const localFS = await w3n.storage!.getAppLocalFS()
	.then(fs => fs.writableSubRoot(pathInAppFSs));
	return await makeLabelledFileStore(syncedFS, localFS);
}

export function makeLabelledFileStore(
	syncedFS: WritableFS, localFS: WritableFS
): Promise<LabelledFileStore> {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
	return LabelledStore.makeSynced(syncedFS, localFS);
}

export interface FileStoreException extends web3n.RuntimeException {
	type: 'labelled-file-store';
	notFound?: true;
	notBlob?: true;
	notDirectory?: true;
}

function makeExc(fields: Partial<FileStoreException>): FileStoreException {
	const exc: FileStoreException = {
		runtimeException: true,
		type: 'labelled-file-store',
	};
	for (const [field, value] of Object.entries(fields)) {
		(exc as any)[field] = value;
	}
	return exc;
}

function wrapErr(err: any, message: string): FileStoreException {
	return makeExc({ cause: err, message });
}

const ID_ATTR_NAME = 'lfs:id';
const TYPE_ATTR_NAME = 'lfs:type';

const BUCKET_TOP_COUNT = 200;

const DATA_FOLDER_NAME = 'lfs_data';
const LAST_BUCKET_FNAME = 'lfs_last-bucket';
const FILE_NAME_LEN = 4;
const FOLDER_NAME_LEN = 2;
const FOLDER_DEPTH = 3;


class LabelledStore implements LabelledFileStore {
	private readonly procs = new NamedProcs();
	private bucket: string|undefined = undefined;
	private bucketCount = 0;

	private constructor(
		private readonly mainFS: WritableFS,
		private readonly dataFS: WritableFS,
		private readonly scratchFS: WritableFS,
	) {
		Object.seal(this);
	}

	static async makeSynced(
		syncedFS: WritableFS, localFS: WritableFS
	): Promise<LabelledFileStore> {
		if (!syncedFS.v) {
			throw new Error(`Store needs versioned fs for data, while given one isn't.`);
		}
		if (syncedFS.type !== 'synced') {
			throw new Error(`Store needs synced fs for data, while given one isn't.`);
		}
		if (!localFS.v) {
			throw new Error(`Store needs versioned fs for local scratch fs, while given one isn't.`);
		}
		if (localFS.type !== 'local') {
			throw new Error(`Store needs local fs for local scratch fs, while given one isn't.`);
		}
		const dataFS = await syncedFS.writableSubRoot(DATA_FOLDER_NAME);
		const store = new LabelledStore(syncedFS, dataFS, localFS);
		await store.setBucket();
		return store.syncWrap();
	}

	private syncWrap(): LabelledFileStore {
		return {
			addBlob: this.addBlob.bind(this),
			addFolder: this.addFolder.bind(this),
			getBlob: id => this.procs.startOrChain(id, () => this.getBlob(id)),
			getFolderRO: id => this.procs.startOrChain(id,
				() => this.getFolderRO(id)),
			getFolderWR: id => this.procs.startOrChain(id,
				() => this.getFolderWR(id)),
			getInfo: id => this.procs.startOrChain(id, () => this.getInfo(id)),
			delete: id => this.procs.startOrChain(id, () => this.delete(id)),
			updateBlob: (id, blob) => this.procs.startOrChain(id,
				() => this.updateBlob(id, blob)),
			updateInfo: (id, info) => this.procs.startOrChain(id,
				() => this.updateInfo(id, info)),
		}
	}

	private async generateId(): Promise<string> {
		if (!this.bucket || (this.bucketCount > BUCKET_TOP_COUNT)) {
			await this.setBucket();
		}
		return `${this.bucket}/${randomStr(FILE_NAME_LEN)}`;
	}

	private async setBucket(): Promise<void> {
		try {
			if (this.bucket) {
				this.bucket = await newBucketInTree(this.dataFS, this.bucket);
				this.bucketCount = 0;
			} else {
				const lastBucket = await this.scratchFS.readTxtFile(
					LAST_BUCKET_FNAME
				).catch((exc: FileException) => {
					if (!exc.notFound) { throw exc; }
				});
				if (!lastBucket) {
					this.bucket = await newBucketTree(this.dataFS);
					this.bucketCount = 0;
				} else {
					const count = (await this.dataFS.listFolder(
						lastBucket
					).catch(async err => {
						await this.scratchFS.deleteFile(LAST_BUCKET_FNAME)
						.catch(noop);
						throw err;
					})).length;
					this.bucket = lastBucket;
					this.bucketCount = count;
					if (this.bucketCount > BUCKET_TOP_COUNT) {
						this.bucket = await newBucketInTree(this.dataFS, this.bucket);
						this.bucketCount = 0;
					}
				}
			}
			await this.scratchFS.writeTxtFile(LAST_BUCKET_FNAME, this.bucket);
		} catch (err) {
			throw wrapErr(err, `Fail to set store bucket`);
		}
	}

	async addBlob(blob: Blob, info?: ItemAttrs): Promise<string> {
		try {
			const id = await this.generateId();
			const bytes = new Uint8Array(await blob.arrayBuffer());
			await this.dataFS.writeBytes(
				id, bytes, { create: true, exclusive: true }
			);
			this.bucketCount += 1;
			const attrsChanges = ((info && (Object.keys(info).length > 0)) ?
				infoToAttrChanges(info) : { set: {} });
			attrsChanges.set![ID_ATTR_NAME] = id;
			attrsChanges.set![TYPE_ATTR_NAME] = blob.type;
			await this.dataFS.updateXAttrs(id, attrsChanges);
			return id;
		} catch (exc) {
			if ((exc as FileException).alreadyExists
			|| (exc as FileException).isDirectory) {
				return this.addBlob(blob, info);
			} else {
				throw wrapErr(exc, `Fail to save file`);
			}
		}
	}

	async addFolder(folder: ReadonlyFS, info?: ItemAttrs): Promise<string> {
		try {
			const id = await this.generateId();
			await this.dataFS.saveFolder(folder, id);
			this.bucketCount += 1;
			const attrsChanges = ((info && (Object.keys(info).length > 0)) ?
				infoToAttrChanges(info) : { set: {} });
			attrsChanges.set![ID_ATTR_NAME] = id;
			await this.dataFS.updateXAttrs(id, attrsChanges);
			return id;
		} catch (exc) {
			if ((exc as FileException).alreadyExists
			|| (exc as FileException).isDirectory) {
				return this.addFolder(folder, info);
			} else {
				throw wrapErr(exc, `Fail to save folder`);
			}
		}
	}

	async updateBlob(id: string, blob: Blob): Promise<void> {
		const bytes = new Uint8Array(await blob.arrayBuffer());
		await this.dataFS.writeBytes(id, bytes, { create: false })
		.catch((exc: FileException) => {
			if (exc.notFound) {
				throw makeExc({ notFound: true });
			} else if (exc.notFile) {
				throw makeExc({ notBlob: true });
			} else {
				throw wrapErr(exc, `Fail to update content of ${id}`);
			}
		});
		const attrsChanges: XAttrsChanges = { set: {} };
		attrsChanges.set![TYPE_ATTR_NAME] = blob.type;
		await this.dataFS.updateXAttrs(id, attrsChanges);
	}

	async updateInfo(id: string, info: ItemAttrs): Promise<void> {
		const attrsChanges = infoToAttrChanges(info);
		await this.dataFS.updateXAttrs(id, attrsChanges)
		.catch((exc: FileException) => {
			if (exc.notFound) {
				throw makeExc({ notFound: true });
			} else {
				throw wrapErr(exc, `Fail to update info of ${id}`);
			}
		});
	}

	async getBlob(id: string): Promise<Blob> {
		const bytes = await this.dataFS.readBytes(id)
		.catch((exc: FileException) => {
			if (exc.notFound) {
				throw makeExc({ notFound: true });
			} else if (exc.notFile) {
				throw makeExc({ notBlob: true });
			} else {
				throw wrapErr(exc, `Fail to read content of ${id}`);
			}
		});
		const type =  await this.dataFS.getXAttr(id, TYPE_ATTR_NAME) as string;
		return new Blob([ bytes ? bytes : new Uint8Array() ], { type });
	}

	getFolderRO(id: string): Promise<ReadonlyFS> {
		return this.dataFS.readonlySubRoot(id)
		.catch((exc: FileException) => {
			if (exc.notFound) {
				throw makeExc({ notFound: true });
			} else if (exc.notDirectory) {
				throw makeExc({ notDirectory: true });
			} else {
				throw wrapErr(exc, `Fail to get folder of ${id}`);
			}
		});
	}

	getFolderWR(id: string): Promise<WritableFS> {
		return this.dataFS.writableSubRoot(id)
		.catch((exc: FileException) => {
			if (exc.notFound) {
				throw makeExc({ notFound: true });
			} else if (exc.notDirectory) {
				throw makeExc({ notDirectory: true });
			} else {
				throw wrapErr(exc, `Fail to get folder of ${id}`);
			}
		});
	}

	async getInfo(id: string): Promise<FileInfo | FolderInfo> {
		const stats = await this.dataFS.stat(id)
		.catch((exc: FileException) => {
			if (exc.notFound) {
				throw makeExc({ notFound: true });
			} else {
				throw wrapErr(exc, `Fail to read content of ${id}`);
			}
		});
		if (stats.isFile) {
			const xNames = (await this.dataFS.listXAttrs(id))
			.filter(xName => (xName !== ID_ATTR_NAME) && (xName !== TYPE_ATTR_NAME));
			const info: FileInfo = {
				id,
				version: stats.version!,
				ctime: stats.ctime!,
				mtime: stats.mtime!,
				isFile: true,
				size: stats.size!,
				type: await this.dataFS.getXAttr(id, TYPE_ATTR_NAME),
			};
			for (const xName of xNames) {
				(info as any)[xName] = await this.dataFS.getXAttr(id, xName);
			}
			return info;
		} else if (stats.isFolder) {
			const xNames = (await this.dataFS.listXAttrs(id))
			.filter(xName => (xName !== ID_ATTR_NAME));
			const info: FolderInfo = {
				id,
				version: stats.version!,
				ctime: stats.ctime!,
				mtime: stats.mtime!,
				isFolder: true,
			};
			for (const xName of xNames) {
				(info as any)[xName] = await this.dataFS.getXAttr(id, xName);
			}
			return info;
		} else {
			throw makeExc({
				notDirectory: true, notBlob: true,
				message: `Type of item ${id} is not recognized`,
				cause: stats
			});
		}
	}

	async delete(id: string): Promise<void> {
		await this.dataFS.deleteFile(id)
		.catch((exc: FileException) => {
			if (!exc.notFound) {
				throw wrapErr(exc, `Fail to delete item with id ${id}`);
			}
		});
	}

}
Object.freeze(LabelledStore.prototype);
Object.freeze(LabelledStore);


function infoToAttrChanges(info: ItemAttrs): XAttrsChanges {
	let set: XAttrsChanges['set'] = undefined;
	let remove: XAttrsChanges['remove'] = undefined;
	for (const [field, value] of Object.entries(info)) {
		if (value === undefined) {
			if (!remove) {
				remove = [];
			}
			remove.push(field);
		} else {
			if (!set) {
				set = {};
			}
			set[field] = value;
		}
	}
	return { set, remove };
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {}

async function newBucketTree(dataFS: WritableFS): Promise<string> {
	let path = '';
	do {
		path = randomStr(FOLDER_NAME_LEN);
	} while (await dataFS.checkFolderPresence(path));
	for (let i=1; i<FOLDER_DEPTH; i+=1) {
		path += `/${randomStr(FOLDER_NAME_LEN)}`;
	}
	await dataFS.makeFolder(path);
	return path;
}

async function newBucketInTree(
	dataFS: WritableFS, oldBucket: string
): Promise<string> {
	let path = oldBucket;
	while (path.length > 0) {
		const sepInd = path.lastIndexOf('/');
		if (sepInd < 0) { break; }
		path = path.slice(0, sepInd);
		const lst = await dataFS.listFolder(path).catch(noop);
		if (lst && (lst.length < BUCKET_TOP_COUNT)) {
			return path;
		}
	}
	return newBucketTree(dataFS);
}


