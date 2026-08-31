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
import type { ChatSrv, DB, LocalDataStore, VideoChatSrv } from '../../types/index.ts';
import type { SyncActivityTracker } from '../../utils/sync-activity.ts';
import { inboxDispatcher } from './inbox-dispatcher.ts';
import { deliveryMonitor } from './delivery-monitor.ts';
import { startDeliveryReconcile } from './delivery-reconcile.ts';

/**
 * Mail Service
 * 
 * Coordinator service that combines:
 * - Inbox Dispatcher: handles incoming messages
 * - Delivery Monitor: tracks outgoing message delivery progress
 */
export async function mailService({
  ownAddr,
  db,
  localDataStoreSrv,
  chatsSrv,
  videoChatSrv,
  syncActivity,
}: {
  ownAddr: string;
  db: DB;
  localDataStoreSrv: LocalDataStore;
  chatsSrv: ChatSrv;
  videoChatSrv: VideoChatSrv;
  syncActivity: SyncActivityTracker;
}) {
  const appDeviceId = localDataStoreSrv.getAppDeviceId();

  // Start inbox dispatcher for handling incoming messages
  const inbox = await inboxDispatcher({
    chatsSrv,
    videoChatSrv,
    localDataStoreSrv,
    db,
    syncActivity,
  });

  // Start delivery monitor for tracking outgoing message progress
  const delivery = await deliveryMonitor({
    ownAddr,
    appDeviceId,
    db,
    chatsSrv,
    nextSyncStamp: () => localDataStoreSrv.nextSyncStamp(),
  });

  // Start the reconcile sweep for deliveries the platform never finishes
  // (stuck 'sending' messages, blocked delivery queue) - see the module doc.
  const reconcile = startDeliveryReconcile({
    ownAddr,
    sourceDeviceId: appDeviceId,
    db,
    emitEventsOutward: chatsSrv.emitEventsOutward,
    nextSyncStamp: () => localDataStoreSrv.nextSyncStamp(),
    hasAnyCallInProgress: () => videoChatSrv.hasAnyCallInProgress(),
  });

  return {
    stopDeliveryService: () => {
      inbox.stop();
      delivery.stop();
      reconcile.stop();
    },
  };
}