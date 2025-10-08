<!--
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
-->
<script lang="ts" setup>
import { computed } from 'vue';
import { Ui3nButton, Ui3nIcon, Ui3nMenu } from '@v1nt1248/3nclient-lib';
import { useChatHeaderActions } from '@main/common/composables/useChatHeaderActions';
import type { ChatListItemView } from '~/chat.types.ts';

const props = defineProps<{
  chat: ChatListItemView;
  disabled?: boolean;
}>();
const emits = defineEmits<{
  (event: 'select:action', value: string): void;
}>();

const propsValue = computed(() => props);

const { isMenuOpen, availableMenuItems, subMenusState, selectAction, isSubItemSelected } =
  useChatHeaderActions(propsValue, emits);
</script>

<template>
  <ui3n-menu
    v-model="isMenuOpen"
    :offset-y="4"
    :close-on-click="false"
    :disabled="disabled"
    :class="$style.menu"
  >
    <ui3n-button
      type="icon"
      color="var(--color-bg-block-primary-default)"
      icon="round-more-vert"
      icon-size="20"
      icon-color="var(--color-icon-block-primary-default)"
      :disabled="disabled"
    />

    <template #menu>
      <div :class="$style.chatHeaderActionsMenu">
        <div
          v-for="item in availableMenuItems"
          :key="item.action"
          :class="[
            $style.chatHeaderActionsMenuItem,
            item.margin && $style.margin,
            item.isAccent && $style.chatHeaderActionsMenuItemAccent,
            item.subMenu && $style.withSubMenu,
            (disabled || item.disabled) && $style.disabled,
          ]"
          v-on="item.disabled ? {} : { click: () => selectAction(item) }"
        >
          <ui3n-icon
            :icon="item.icon"
            size="14"
            :color="item.isAccent ? 'var(--warning-content-default)': 'var(--color-icon-control-primary-default)'"
            :class="$style.icon"
          />

          {{ $tr(item.text) }}

          <ui3n-icon
            v-if="item.subMenu"
            icon="round-keyboard-arrow-right"
            size="14"
            color="var(--color-icon-control-primary-default)"
            :class="$style.icon"
          />

          <div
            v-if="item.subMenu && subMenusState[item.action]"
            :class="$style.subMenu"
          >
            <div
              v-for="subItem in item.subMenu"
              :key="subItem.action"
              :class="[
                $style.chatHeaderActionsMenuItem,
                $style.subMenuItem,
                subItem.margin && $style.margin,
                subItem.isAccent && $style.chatHeaderActionsMenuItemAccent,
                isSubItemSelected(subItem) && $style.isSelected,
                (disabled || subItem.disabled) && $style.disabled,
              ]"
              v-on="(subItem.disabled || subItem.subMenu) ? {} : { click: () => selectAction(subItem) }"
            >
              {{ $tr(subItem.text) }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </ui3n-menu>
</template>

<style lang="scss" module>
@keyframes scale {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(0.75);
  }

  100% {
    transform: scale(1);
  }
}

.menu {
  div:last-child {
    overflow: visible !important;
  }
}

.chatHeaderActionsMenu {
  --chat-header-menu-width: 192px;
  --chat-header-menu-item-height: var(--spacing-l);

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
  height: var(--chat-header-menu-item-height);
  font-size: 13px;
  font-weight: 400;
  color: var(--color-text-control-primary-default);
  border-radius: 2px;
  cursor: pointer;

  &:hover {
    background-color: var(--color-bg-control-primary-hover);
    color: var(--color-text-control-accent-default);

    .icon {
      animation: scale 0.4s ease-in-out;
    }

    :global(.ui3n-icon) {
      color: var(--color-icon-control-accent-hover);
    }
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

.subMenu {
  position: absolute;
  padding: var(--spacing-xs);
  background-color: var(--color-bg-control-secondary-default);
  border-radius: var(--spacing-xs);
  width: 90px;
  top: 0;
  left: -90px;
  min-height: calc(var(--chat-header-menu-item-height) + var(--spacing-xs) * 2);
  box-shadow: 0 0 2px 0 var(--shadow-key-1), 0 2px 5px 0 var(--shadow-key-2);
}

.subMenuItem {
  padding-left: var(--spacing-s);
}

.isSelected {
  background-color: var(--color-bg-control-primary-hover);
}
</style>
