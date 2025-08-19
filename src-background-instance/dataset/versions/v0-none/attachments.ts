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

  const saveLink = async (file: web3n.files.ReadonlyFile): Promise<string> => {
    const fileId = randomStr(20);

    try {
      await checkFs();
      await fileProc.startOrChain(() => fs!.link(fileId, file));
    } catch (e) {
      // FileException
      // eslint-disable-next-line
      if ((e as any).notLinkableFile) {
        await fileProc.startOrChain(() => fs!.saveFile(file, fileId));
        return fileId;
      }

      console.error(`Error saving link to ${file.name}. `, e);

    }

    return fileId;
  };

  const getLink = async (fileId: string): Promise<web3n.files.SymLink  | null | undefined> => {
    try {
      await checkFs();
      return await fileProc.startOrChain(() => fs!.readLink(fileId));
    } catch (e) {
      console.error(`Error getting link ${fileId}. `, e);
      const { notFound, path } = e as web3n.files.FileException;
      if (path === fileId && notFound) {
        return null;
      }
    }
  };

  const getFile = async (fileId: string): Promise<web3n.files.File | null | undefined> => {
    try {
      const stat = await fs!.stat(fileId);
      if (stat.isLink) {
        const link = await getLink(fileId);
        if (link && link.isFile) {
          return await link.target() as web3n.files.File;
        }
        return null;
      }

      return await fileProc.startOrChain(() => fs!.readonlyFile(fileId));
    } catch (e) {
      console.error(`Error getting file ${fileId}. `, e);
    }
  };

  const deleteLink = async (fileId: string): Promise<void> => {
    try {
      await checkFs();
      await fileProc.startOrChain(() => fs!.deleteLink(fileId));
    } catch (e) {
      console.error(`Error deleting link ${fileId}. `, e);
    }
  };

  await initializing();

  return {
    saveLink,
    getLink,
    getFile,
    deleteLink,
  };
}
