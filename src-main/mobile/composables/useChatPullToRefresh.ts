/*
 Copyright (C) 2026 3NSoft Inc.

 This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU General Public License as published by the Free Software
 Foundation, either version 3 of the License, or (at your option) any later
 version.

 This program is distributed in the hope that it will be useful, but WITHOUT
 ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more
 details.

 You should have received a copy of the GNU General Public License along with
 this program.  If not, see <http://www.gnu.org/licenses/>.
*/
import { type ComputedRef, type Ref } from 'vue';
import { useSwipe } from '@vueuse/core';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { useForceRefreshChat } from '@main/common/composables/useForceRefreshChat';

/**
 * How far the finger must travel before the drag counts as a pull. Long enough
 * not to fire on a stray movement made while reading.
 */
const PULL_TO_REFRESH_THRESHOLD_PX = 60;

export function useChatPullToRefresh(
  messageListElement: Ref<Nullable<HTMLDivElement>>,
  disabled: ComputedRef<boolean>,
) {
  const { forceRefreshChat } = useForceRefreshChat();
  let refreshing = false;

  async function refresh() {
    if (refreshing || disabled.value) {
      return;
    }
    refreshing = true;
    try {
      await forceRefreshChat();
    } finally {
      refreshing = false;
    }
  }

  useSwipe(messageListElement, {
    threshold: PULL_TO_REFRESH_THRESHOLD_PX,
    onSwipeEnd: (_e, direction) => {
      if (direction !== 'down') {
        return;
      }

      // Only from the top, as Gmail does it: lower down, a downward drag is
      // ordinary scrolling through older messages, not a request to fetch.
      const el = messageListElement.value;
      if (el && el.scrollTop > 0) {
        return;
      }

      void refresh();
    },
  });
}
