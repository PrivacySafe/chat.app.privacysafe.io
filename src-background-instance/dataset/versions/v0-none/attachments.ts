/*
 Copyright (C) 2020 - 2025 3NSoft Inc.

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

import { randomStr } from '../../../../shared-libs/randomStr.ts';
import { SingleProc } from '../../../../shared-libs/processes/single.ts';
import { FileLinkStoreService } from '../../../../types/services.types.ts';
import { getFileExtension } from '../../../../shared-libs/get-file-extension.ts';

export async function makeOutgoingFileLinkStore(): Promise<FileLinkStoreService> {
  const fileProc = new SingleProc();
  let fs: web3n.files.WritableFS | undefined;

  const initializing = async (): Promise<void> => {
    fs = await w3n.storage?.getAppLocalFS();
  };

  const checkFs = async (): Promise<void> => {
    if (!fs) {
      await initializing();
    }
  };

  const saveFile = async (data: ArrayBuffer, fileName?: string): Promise<string> => {
    let entityId = `file-${randomStr(15)}`;
    if (fileName) {
      const ext = getFileExtension(fileName);
      const updatedFileName = fileName.replace(`.${ext}`, '');
      entityId = `${updatedFileName}-${randomStr(3)}.${ext}`;
    }

    try {
      await checkFs();
      const uint8Array = new Uint8Array(data);
      await fileProc.startOrChain(() => fs!.writeBytes(entityId, uint8Array));
    } catch (e) {
      w3n.log('error', `Error saving file ${entityId} from ArrayBuffer. `, e);
    }

    return entityId;
  };

  const saveLink = async (entity: web3n.files.ReadonlyFile | web3n.files.ReadonlyFS): Promise<string> => {
    const entityId = randomStr(20);

    try {
      await checkFs();
      await fileProc.startOrChain(() => fs!.link(entityId, entity));
    } catch (e) {
      // FileException
      // eslint-disable-next-line
      if ((e as any).notLinkableFile) {
        const isFolder = !!(entity as web3n.files.ReadonlyFS).listFolder;
        if (!isFolder) {
          await fileProc.startOrChain(() => fs!.saveFile(entity as web3n.files.ReadonlyFile, entityId));
          return entityId;
        }
      }

      // FileException
      // eslint-disable-next-line
      if ((e as any).notLinkableFolder) {
        const isFolder = !!(entity as web3n.files.ReadonlyFS).listFolder;
        if (isFolder) {
          await fileProc.startOrChain(() => fs!.saveFolder(entity as web3n.files.ReadonlyFS, entityId));
          return entityId;
        }
      }

      w3n.log('error', `Error saving link to ${entity.name}.`, e);
    }

    return entityId;
  };

  const getLink = async (entityId: string): Promise<web3n.files.SymLink  | null | undefined> => {
    try {
      await checkFs();
      return await fileProc.startOrChain(() => fs!.readLink(entityId));
    } catch (e) {
      w3n.log('error', `Error getting link ${entityId}.`, e);
      const { notFound, path } = e as web3n.files.FileException;
      if (path === entityId && notFound) {
        return null;
      }
    }
  };

  const getFile = async (entityId: string): Promise<web3n.files.File | web3n.files.FS | null | undefined> => {
    try {
      const stat = await fs!.stat(entityId);
      if (stat.isLink) {
        const link = await getLink(entityId);
        if (link && link.isFile) {
          return await link.target() as web3n.files.File;
        }
        if (link && link.isFolder) {
          return await link.target() as web3n.files.FS;
        }
        return null;
      }

      if (stat.isFile) {
        return await fileProc.startOrChain(() => fs!.readonlyFile(entityId));
      }

      return await fileProc.startOrChain(() => fs!.readonlySubRoot(entityId));
    } catch (e) {
      w3n.log('error', `Error getting file ${entityId}.`, e);
    }
  };

  const deleteLink = async (entityId: string): Promise<void> => {
    try {
      await checkFs();
      await fileProc.startOrChain(() => fs!.deleteLink(entityId));
    } catch (e) {
      w3n.log('error', `Error deleting link ${entityId}.`, e);
    }
  };

  await initializing();

  return {
    saveFile,
    saveLink,
    getLink,
    getFile,
    deleteLink,
  };
}
