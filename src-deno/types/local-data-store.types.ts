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
export interface LocalDataStore {
  getAppDeviceId(): string;
  /**
   * Starts watching for another app instance using this same local data folder,
   * which would share this device's identity. Calls back once, and only in that
   * (misconfigured) case; the returned function stops the watch.
   */
  startForeignInstanceWatch(onForeign: (foreignStamp: string) => void): () => void;
  getLastReceivedMessageTimestamp(): number;
  setLastReceivedMessageTimestamp(ts: number): Promise<void>;
  nextSyncStamp(): Promise<number>;
  observeSyncStamp(ts: number): Promise<void>;
  /**
   * Whether a phantom from another device of this user has ever been seen here.
   * The synchronization indicator stays silent until it has: a user with one
   * device synchronizes with nobody, and every phantom in their inbox is their
   * own copy coming back.
   */
  hasSeenOtherDevice(): boolean;
  noteOtherDeviceSeen(deviceId: string): Promise<void>;
  nextCallSessionId(hostAddr: string): Promise<string>;
  /**
   * Whether this device still has to ask its siblings for all of their chats:
   * true from its first run until that ask is queued (see chat-resync.ts).
   */
  isInitialChatsSnapshotPending(): boolean;
  noteInitialChatsSnapshotRequested(): Promise<void>;
  /** Whether this device has already answered the 'resync:chats' ask. */
  wasChatsResyncAnswered(requestId: string): boolean;
  noteChatsResyncAnswered(requestId: string, now?: number): Promise<void>;
  /**
   * The blacklist as it was last seen, or undefined when none was ever stored.
   *
   * The two answers must stay distinguishable: an empty list means "nobody was
   * blocked when we last looked", while undefined means "we have never looked".
   * The blacklist tracker turns the first into a delta and the second into a
   * baseline - conflating them would make the first run of a build read every
   * already-blocked contact as blocked just now.
   */
  getCachedBlacklist(): string[] | undefined;
  setCachedBlacklist(list: string[]): Promise<void>;
}
