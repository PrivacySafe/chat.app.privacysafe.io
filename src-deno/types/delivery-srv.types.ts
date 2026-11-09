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
export interface DeliveryServiceData {
  appDeviceId: string;
  lastReceivedMessageTimestamp: number;
  /**
   * Stamp of the run of the background component that wrote this file last.
   * Backs the detection of a second app instance started on the same data
   * folder, which would share this file's appDeviceId and make synchronization
   * between devices impossible (see startForeignInstanceWatch).
   */
  instanceStamp?: string;
  /**
   * Highest synchronization stamp this device has either issued or seen in a
   * received phantom. Backs the hybrid logical clock that orders changes
   * between devices of the same user (see nextSyncStamp/observeSyncStamp).
   */
  lastSyncClockTs?: number;
  /**
   * Number of call sessions this device has ever hosted. Backs the counter part
   * of WebRTCMsg.callSessionId, and is persisted so that a restart of the
   * background component cannot hand out an id a previous call already used.
   */
  lastCallSessionCounter?: number;
  /**
   * The first phantom from another device of this user that this device ever
   * saw - the only proof the app has that the user synchronizes with anything
   * at all. Until it exists, the synchronization indicator stays silent: a user
   * with one device has nobody to synchronize with, and every phantom in their
   * inbox is their own copy coming back to them.
   *
   * The device id and the time, rather than a bare flag, for the same reason
   * `appDeviceId` is printed at start-up: when something looks wrong, the
   * question is always *which* device and *when*.
   */
  otherDeviceSeen?: {
    deviceId: string;
    at: number;
  };
  /**
   * Set when this file is created, i.e. on the first run of this device, and
   * removed once the 'resync:chats' ask for all chats is in the phantom
   * journal (from there it is delivered however long that takes).
   *
   * A flag that is removed, rather than "the file was new", because the first
   * run can end before the ask is queued, and the second run must still ask.
   * A file written by an older build has no flag and never asks: that device
   * is not new, and its missing chats are asked for one by one as their
   * phantoms arrive (see chat-resync.ts).
   */
  initialChatsSnapshotPending?: true;
  /**
   * 'resync:chats' asks this device has answered: requestId -> when.
   *
   * Persisted, unlike the per-session dedup of record asks, because an answer
   * here is the whole history of the chats asked for, and an ask stays in the
   * shared inbox - and is replayed by catch-up scans - for up to 15 days.
   * Entries older than that are pruned.
   */
  answeredChatsResyncs?: Record<string, number>;
  /**
   * Cached blacklist of contact email addresses persisted so that Deno can
   * immediately filter incoming messages on startup without waiting for RPC
   * to the contacts app.
   */
  cachedBlacklist?: string[];
}
