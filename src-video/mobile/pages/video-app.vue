<!--
 Copyright (C) 2024 3NSoft Inc.

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
import { onBeforeMount, onBeforeUnmount } from 'vue';
import { useAppStore } from '@video/common/store/app.store';
import { useHandleSystemMessages } from '@video/common/composables/use-handle-system-messages';
import { initializationServices } from '@video/common/services/service-provider';

const { initialize, stopWatching } = useAppStore();
const { initializeSystemMessagesHandler } = useHandleSystemMessages();

onBeforeMount(async () => {
  try {
    await initialize();
    await initializationServices();
    initializeSystemMessagesHandler();
  } catch (e) {
    console.error('ON_BEFORE_MOUNT ERROR: ', e);
    throw e;
  }
});

onBeforeUnmount(() => {
  stopWatching();
});
</script>

<template>
  <router-view />
</template>
