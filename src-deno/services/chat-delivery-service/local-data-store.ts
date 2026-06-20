/*
 Copyright (C) 2026 3NSoft Inc.

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
import { DELIVERY_SERVICE_DATA_FILE_NAME } from '../../../shared-libs/constants/index.ts';
import { SingleProc } from '../../../shared-libs/processes/single.ts';
import { randomStr } from '../../../shared-libs/randomStr.ts';
import type { LocalDataStore, DeliveryServiceData } from '../../types/index.ts';

export async function localDataStore(): Promise<LocalDataStore> {
  const proc = new SingleProc();

  let file: web3n.files.WritableFile;
  let needsSaving = false;
  let data: DeliveryServiceData;

  async function initialize(): Promise<void> {
    const fs = await w3n.storage!.getAppLocalFS();
    file = await fs.writableFile(DELIVERY_SERVICE_DATA_FILE_NAME);

    const appFormFactor = (await w3n.ui?.uiFormFactor()) || '';
    const appFormFactorParcedValue = appFormFactor.split('+');
    const appDeviceId = appFormFactorParcedValue[0]
      ? `${appFormFactorParcedValue[0]}-${randomStr(20)}`
      : `app-${randomStr(20)}`;

    let doesFileNeedSave = false;
    if (file.isNew) {
      data = {
        appDeviceId,
        lastReceivedMessageTimestamp: 0,
      };
      doesFileNeedSave = true;
    } else {
      data = await file.readJSON<DeliveryServiceData>();
      if (!data.appDeviceId) {
        data.appDeviceId = appDeviceId;
        doesFileNeedSave = true;
      }
    }

    if (doesFileNeedSave) {
      await file.writeJSON(data);
    }
  }

  async function saveOrderly() {
    needsSaving = true;
    await proc.startOrChain(async () => {
      if (needsSaving) {
        await file.writeJSON(data);
        needsSaving = false;
      }
    });
  }

  function getAppDeviceId() {
    return data.appDeviceId;
  }

  function getLastReceivedMessageTimestamp() {
    return data.lastReceivedMessageTimestamp;
  }

  async function setLastReceivedMessageTimestamp(ts: number) {
    if (ts > data.lastReceivedMessageTimestamp) {
      data.lastReceivedMessageTimestamp = ts;
      await saveOrderly();
    }
  }

  await initialize();

  return {
    getAppDeviceId,
    getLastReceivedMessageTimestamp,
    setLastReceivedMessageTimestamp,
  };
}
