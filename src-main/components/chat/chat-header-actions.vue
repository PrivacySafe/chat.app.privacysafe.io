<!--
 Copyright (C) 2020 - 2024 3NSoft Inc.

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
-->

<script lang="ts" setup>
import { computed, inject } from 'vue';
import { storeToRefs } from 'pinia';
import size from 'lodash/size';
import { I18N_KEY, I18nPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { chatMenuItems } from '@main/constants';
import { Ui3nButton, Ui3nMenu, Ui3nIcon } from '@v1nt1248/3nclient-lib';
import { useChatStore } from '@main/store/chat.store';

const emit = defineEmits(['select:action']);

const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
const { currentChat } = storeToRefs(useChatStore());

const chatType = computed(() => {
  const currentChatValue = currentChat.value;
  const { members = [] } = currentChatValue || {};
  return size(members) > 2 ? 'group' : 'single';
});

const availableMenuItems = computed(() => chatMenuItems
  .filter(i => i.chatTypes.includes(chatType.value))
  .map(item => ({
    ...item,
    text: $tr(item.text)
  }))
);

function selectAction(compositeAction: string) {
  emit('select:action', compositeAction);
}
</script>

<template>
  <ui3n-menu
    :offset-y="4"
    :offset-x="-40"
  >
    <ui3n-button
      type="custom"
      color="var(--color-bg-button-tritery-default)"
      text-color="var(--color-text-button-tritery-default)"
      icon="outline-arrow-drop-down"
      icon-size="16"
      icon-color="var(--color-icon-button-tertiary-default)"
      icon-posizion="right"
    >
      {{ $tr('chat.header.actions.btn') }}
    </ui3n-button>

    <template #menu>
      <div :class="$style.chatHeaderActionsMenu">
        <div
          v-for="item in availableMenuItems"
          :key="item.icon"
          :class="[
            $style.chatHeaderActionsMenuItem,
            item.margin && $style.margin,
            item.isAccent && $style.chatHeaderActionsMenuItemAccent,
            item.disabled && $style.disabled,
          ]"
          v-on="item.disabled ? {} : { click: () => selectAction(item.action) }"
        >
          <ui3n-icon
            :icon="item.icon"
            width="12"
            height="12"
            :color="item.isAccent ? 'var(--warning-content-default)': 'var(--color-icon-control-primary-default)'"
          />
          {{ item.text }}
        </div>
      </div>
    </template>
  </ui3n-menu>
</template>

<style lang="scss" module>
.chatHeaderActionsMenu {
  --chat-header-menu-width: 145px;

  position: relative;
  width: var(--chat-header-menu-width);
  background-color: var(--color-bg-control-secondary-default);
  border-radius: var(--spacing-xs);
  padding: var(--spacing-xs);
}

.chatHeaderActionsMenuItem {
  position: relative;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  column-gap: var(--spacing-s);
  padding: 0 var(--spacing-xs);
  height: var(--spacing-ml);
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-control-primary-default);
  border-radius: 2px;
  cursor: pointer;

  &:hover {
    background-color: var(--color-bg-control-primary-hover);
    color: var(--color-text-control-accent-default);
  }
}

.chatHeaderActionsMenuItemAccent {
  color: var(--warning-content-default);

  &:hover {
    background-color: var(--warning-fill-hover);
    color: var(--warning-content-default);
  }
}

.margin {
  margin-top: var(--spacing-xs);
}

.disabled {
  pointer-events: none;
  opacity: 0.5;
  cursor: default;
}
</style>
