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
import { computed, onBeforeMount, onBeforeUnmount } from 'vue';
import { storeToRefs } from 'pinia';
import { useCommandHandler } from '@main/common/composables/useCommandHandler';
import { useAppStore } from '@main/common/store/app.store';
import { useContactsStore } from '@main/common/store/contacts.store';
import { useInitialize } from '@main/common/composables/useInitialize';
import { chatService } from '@main/common/services/external-services.ts';

export type AppViewInstance = ReturnType<typeof useAppView>;

export function useAppView() {
  const { start: startHandlingCommands } = useCommandHandler();

  const appStore = useAppStore();
  const contactsStore = useContactsStore();

  const {
    commonLoading,
    appVersion,
    user: me,
    connectivityStatus,
    customLogoSrc,
  } = storeToRefs(appStore);

  const { initialize, stopMessagesProcessing, stopVideoCallsWatching } = useInitialize();

  const connectivityStatusText = computed(() =>
    connectivityStatus.value === 'online' ? 'app.status.connected.online' : 'app.status.connected.offline',
  );

  async function openDashboard() {
    await w3n.shell!.openDashboard!();
  }

  async function appExit() {
    w3n.closeSelf!();
  }

  async function deleteExpiredMessages() {
    return chatService.deleteExpiredMessages(Date.now());
  }

  let deleteExpiredMessagesTimerId: ReturnType<typeof setInterval> | null = null;

  onBeforeMount(async () => {
    try {
      await appStore.initialize();
      await contactsStore.initialize();
      await initialize();
      await startHandlingCommands();

      deleteExpiredMessagesTimerId = setInterval(() => deleteExpiredMessages(), 60000);
    } catch (e) {
      console.error('Error while the app component mounting. ', e);
      throw e;
    }
  });

  onBeforeUnmount(() => {
    stopMessagesProcessing.value && stopMessagesProcessing.value();
    stopVideoCallsWatching.value && stopVideoCallsWatching.value();
    appStore.stopWatching();
    deleteExpiredMessagesTimerId && clearInterval(deleteExpiredMessagesTimerId);
  });

  return {
    commonLoading,
    me,
    customLogoSrc,
    appVersion,
    connectivityStatusText,
    openDashboard,
    appExit,
  };
}
