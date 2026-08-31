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
import type { ChatIdObj } from '../../../../types/asmail-msgs.types.ts';
import type { DB, SyncAspect, SyncEntityType } from '../../../types/index.ts';
import { chatIdToString } from '../../../../shared-libs/chat-ids.ts';

/**
 * The slice of the database these rules actually touch.
 *
 * Narrower than DB on purpose. It says what the rules depend on, and it lets a
 * spec hand them a plain in-memory object instead of casting one to DB - a cast
 * that switches off the very check that would catch the object drifting from
 * the interface (see P4-2: mocks cast with `as unknown as` kept compiling while
 * failing at runtime for three months).
 */
export type SyncVersionStore = Pick<DB, 'getSyncVersion' | 'setSyncVersion' | 'deleteSyncVersionsOf'>;

/**
 * Ordering token of a change, used to resolve conflicts between the user's own
 * devices by last-write-wins.
 *
 * ts comes from the hybrid logical clock (nextSyncStamp() in
 * local-data-store.ts), deviceId from getAppDeviceId().
 */
export interface SyncToken {
  ts: number;
  deviceId: string;
}

/**
 * Compares two ordering tokens, giving a total order: by ts, and by deviceId
 * when stamps are equal. A total order is what makes every device pick the same
 * winner for concurrent changes - a comparison that left ties unresolved would
 * let devices diverge.
 *
 * An absent stored token means nothing has been applied yet, so anything wins.
 */
export function isNewerToken(incoming: SyncToken, stored: SyncToken | undefined): boolean {
  if (!stored) {
    return true;
  }
  if (incoming.ts !== stored.ts) {
    return incoming.ts > stored.ts;
  }
  return incoming.deviceId > stored.deviceId;
}

export function chatEntityId(chatId: ChatIdObj): string {
  return chatIdToString(chatId);
}

export function msgEntityId(chatId: ChatIdObj, chatMessageId: string): string {
  return `${chatIdToString(chatId)}/${chatMessageId}`;
}

/**
 * Applies a change only if its token is newer than the one already recorded for
 * this aspect, and records the token when it does. This is the single place
 * where the last-write-wins rule lives.
 */
export async function applyIfNewer(
  {
    db,
    entityType,
    entityId,
    aspect,
    token,
  }: {
    db: SyncVersionStore;
    entityType: SyncEntityType;
    entityId: string;
    aspect: SyncAspect;
    token: SyncToken;
  },
  apply: () => Promise<void>,
): Promise<boolean> {
  const stored = db.getSyncVersion(entityType, entityId, aspect);
  if (!isNewerToken(token, stored)) {
    await w3n.log(
      'info',
      `Skipping stale sync of ${aspect} for ${entityType} ${entityId}: ` +
        `incoming ${token.ts}/${token.deviceId}, stored ${stored?.ts}/${stored?.deviceId}`,
    );
    return false;
  }

  await apply();
  await db.setSyncVersion(entityType, entityId, aspect, token);
  return true;
}

/**
 * Tells if an entity has a tombstone that is newer than the given token, i.e.
 * it was deleted after the change this token belongs to was made. Used to keep
 * a phantom that arrives after a deletion from resurrecting the entity.
 */
export function isDeletedLaterThan(
  db: SyncVersionStore,
  entityType: SyncEntityType,
  entityId: string,
  token: SyncToken,
): boolean {
  const tombstone = db.getSyncVersion(entityType, entityId, 'deleted');
  return !!tombstone && !isNewerToken(token, tombstone);
}

/**
 * Records a deletion: a tombstone that outlives the entity, plus removal of the
 * entity's other aspect versions.
 */
export async function recordDeletion(
  db: SyncVersionStore,
  entityType: SyncEntityType,
  entityId: string,
  token: SyncToken,
): Promise<void> {
  await db.deleteSyncVersionsOf(entityType, entityId);
  await db.setSyncVersion(entityType, entityId, 'deleted', {
    ...token,
    tombstonedAt: Date.now(),
  });
}
