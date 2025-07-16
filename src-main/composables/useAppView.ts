/*
 Copyright (C) 2020 - 2025 3NSoft Inc.

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

import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatsStore } from '@main/store/chats.store';
import { useAppStore } from '@main/store/app.store';
import { useContactsStore } from '@main/store/contacts.store';

export type AppViewInstance = ReturnType<typeof useAppView>;

export function useAppView() {

  const appStore = useAppStore();
  const contactsStore = useContactsStore();
  const chatsStore = useChatsStore();

  const {
    appVersion,
    user: me,
    connectivityStatus,
    appElement
  } = storeToRefs(appStore);

  const connectivityStatusText = computed(() =>
    connectivityStatus.value === 'online' ? 'app.status.connected.online' : 'app.status.connected.offline',
  );

  async function appExit() {
    w3n.closeSelf!();
  }

  async function doBeforeMount() {
    try {
      await appStore.initialize();
      await contactsStore.initialize();
      await chatsStore.initialize(me.value);
    } catch (e) {
      console.error('MOUNT ERROR: ', e);
      throw e;
    }
  }

  function doBeforeUnmount() {
    chatsStore.stopWatching();
    appStore.stopWatching();
  }

  return {
    appExit,
    appElement,
    appVersion,
    connectivityStatusText,
    doBeforeMount,
    doBeforeUnmount,
    me,
  };
}