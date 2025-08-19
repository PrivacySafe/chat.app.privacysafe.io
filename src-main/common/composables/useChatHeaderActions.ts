/*
 Copyright (C) 2025 3NSoft Inc.

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
import { computed, ComputedRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatStore } from '@main/common/store/chat.store';
import { chatMenuItems } from '@main/common/constants';

export function useChatHeaderActions(
  props: ComputedRef<{ disabled?: boolean }>,
  emits: { (event: 'select:action', value: string): void },
) {
  const { currentChat, isAdminOfGroupChat } = storeToRefs(useChatStore());

  const canLeaveAndDeleteChat = computed(() => {
    if (!currentChat.value?.isGroupChat) {
      return true;
    }

    const { members, admins } = currentChat.value;
    if (!isAdminOfGroupChat.value) {
      return true;
    }

    if (admins.length > 1) {
      return true;
    }

    return Object.keys(members).length === 1
  });

  const availableMenuItems = computed(() => chatMenuItems
    .filter(i => {
      if (currentChat.value?.isGroupChat) {
        if (i.chatTypes.includes('group')) {
          return true;
        }

        if (isAdminOfGroupChat.value) {
          return i.chatTypes.includes('group&admin');
        }

        return false;
      }

      return i.chatTypes.includes('single');
    })
    .filter(i => i.action !== 'chat:delete' || (i.action === 'chat:delete' && canLeaveAndDeleteChat.value)),
  );

  function selectAction(compositeAction: string) {
    if (props.value.disabled) {
      return;
    }

    emits('select:action', compositeAction);
  }

  return {
    availableMenuItems,
    selectAction,
  };
}
