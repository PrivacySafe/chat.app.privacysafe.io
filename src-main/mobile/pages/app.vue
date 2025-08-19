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
import { onBeforeMount } from 'vue';
import { Ui3nButton, Ui3nMenu } from '@v1nt1248/3nclient-lib';
import { useAppView } from '@main/common/composables/useAppView';
import { useChatsView } from '@main/common/composables/useChatsView.ts';
import { useAppStore } from '@main/common/store/app.store';

const { appExit } = useAppView();
const { setMobileMode } = useAppStore();
const { openCreateChatDialog } = useChatsView();

onBeforeMount(() => {
  setMobileMode(true);
});
</script>

<template>
  <section :class="$style.app">
    <div :class="$style.toolbar">
      <ui3n-button @click.stop.prevent="() => openCreateChatDialog(true)">
        {{ $tr('btn.text.new') }}
      </ui3n-button>

      <div :class="$style.title">
        {{ $tr('app.title') }}
      </div>

      <ui3n-menu>
        <ui3n-button
          type="icon"
          color="var(--color-bg-block-primary-default)"
          icon="round-more-vert"
          icon-size="20"
          icon-color="var(--color-icon-table-primary-default)"
        />

        <template #menu>
          <div :class="$style.menu">
            <div
              :class="$style.menuItem"
              @click="appExit"
            >
              {{ $tr('app.exit') }}
            </div>
          </div>
        </template>
      </ui3n-menu>
    </div>

    <div :class="$style.body">
      <router-view v-slot="{ Component }">
        <transition>
          <component :is="Component" />
        </transition>
      </router-view>
    </div>

    <div id="notification" />
  </section>
</template>

<style lang="scss" module>
@use '@main/common/assets/styles/_mixins.scss' as mixins;

.app {
  --main-toolbar-height: 48px;

  position: fixed;
  inset: 0;
  overflow: hidden;
}

.toolbar {
  width: 100%;
  padding: 0 var(--spacing-m);
  height: var(--main-toolbar-height);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--color-bg-block-primary-default);
  border-bottom: 1px solid var(--color-border-block-primary-default);
}

.title {
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: var(--font-16);
  font-weight: 700;
  color: var(--color-text-block-primary-default);
  column-gap: var(--spacing-s);
}

.body {
  position: fixed;
  left: 0;
  right: 0;
  top: calc(var(--main-toolbar-height) + 1px);
  bottom: 0;
}

.menu {
  position: relative;
  background-color: var(--color-bg-control-secondary-default);
  width: max-content;
  border-radius: var(--spacing-xs);
  @include mixins.elevation(1);
}

.menuItem {
  position: relative;
  width: 60px;
  height: var(--spacing-l);
  padding: 0 var(--spacing-s);
  font-size: var(--font-13);
  font-weight: 500;
  color: var(--color-text-control-primary-default);
  display: flex;
  justify-content: flex-start;
  align-items: center;
  cursor: pointer;

  &:hover {
    background-color: var(--color-bg-control-primary-hover);
    color: var(--color-text-control-accent-default);
  }
}

#notification {
  position: fixed;
  bottom: var(--spacing-xs);
  left: var(--spacing-m);
  right: var(--spacing-m);
  z-index: 5000;
  height: auto;
  display: flex;
  justify-content: center;
  align-content: center;
}
</style>
