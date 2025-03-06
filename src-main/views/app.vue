<!--
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
-->

<script lang="ts" setup>
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import size from 'lodash/size';
import { Ui3nMenu, Ui3nRipple } from '@v1nt1248/3nclient-lib';
import { getDeliveryErrors } from '@v1nt1248/3nclient-lib/utils';
import prLogo from '../assets/images/privacysafe-logo.svg';
import { makeServiceCaller } from '@shared/ipc/ipc-service-caller';
import { appDeliverySrvProxy } from '@main/services/services-provider';
import { UISettings } from '@main/helpers/ui-settings';
import type { AppDeliveryService } from '~/index';
import ContactIcon from '../components/contacts/contact-icon.vue';
import { makeIncomingMessageHandler } from '@main/ctrl-funcs/handle-incoming-message';
import { handleUpdateMessageStatus } from '@main/ctrl-funcs/system-message-handlers/handle-update-message-status';
import { useChatsStore } from '@main/store/chats';
import { useAppStore } from '@main/store/app';
import { useContactsStore } from '@main/store/contacts';

const vUi3nRipple = Ui3nRipple;

const appStore = useAppStore();
const contactsStore = useContactsStore();
const chatsStore = useChatsStore();

const { appVersion, user: me, connectivityStatus } = storeToRefs(appStore);
const {
  fetchInitData,
  fetchConnectivityStatus,
  setLang,
  setColorTheme,
  setAppWindowSize,
} = appStore;

const { fetchContactList } = contactsStore;

const { fetchChatList: refreshChatList } = chatsStore;

const appElement = ref<Element | null>(null);

const connectivityStatusText = computed(() =>
  connectivityStatus.value === 'online' ? 'app.status.connected.online' : 'app.status.connected.offline',
);
const connectivityTimerId = ref<ReturnType<typeof setInterval> | undefined>();

const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { contentRect, target } = entry;
    const { className } = target;
    const { width, height } = contentRect;
    if (className === 'app') {
      setAppWindowSize({ width, height });
    }
  }
});

async function appExit() {
  w3n.closeSelf!();
}

onBeforeMount(async () => {
  try {
    await fetchContactList();
    await fetchInitData();
    await fetchConnectivityStatus();

    connectivityTimerId.value = setInterval(fetchConnectivityStatus, 60000);

    const config = await UISettings.makeResourceReader();
    config.watchConfig({
      next: appConfig => {
        const { lang, colorTheme } = appConfig;
        setLang(lang);
        setColorTheme(colorTheme);
      },
    });

    await refreshChatList();

    const deliverySrvConnection = await w3n.rpc!.thisApp!('ChatDeliveryService');
    const deliverSrv = makeServiceCaller(
      deliverySrvConnection,
      [],
      ['watchIncomingMessages', 'watchOutgoingMessages'],
    ) as AppDeliveryService;

    deliverSrv.watchIncomingMessages({
      next: makeIncomingMessageHandler(chatsStore, contactsStore, me.value),
      error: (e) => console.error(e),
      complete: () => deliverySrvConnection.close(),
    });

    deliverSrv.watchOutgoingMessages({
      next: (val) => {
        const { id, progress } = val;
        const { allDone, recipients } = progress;
        if (allDone) {
          appDeliverySrvProxy.removeMessageFromDeliveryList([id]);
          const errors = getDeliveryErrors(progress);
          const { localMeta = {} } = progress;
          const { path } = localMeta;

          if (!path.includes('system')) {
            // TODO it's necessary to change when we will add new delivery status (not only 'sent' or 'error')
            const status = size(errors) === 0 || size(recipients) > size(errors) ? 'sent' : 'error';

            handleUpdateMessageStatus(chatsStore, { msgId: id, value: status });
          }
        }
      },
      error: (e) => console.error(e),
      complete: () => deliverySrvConnection.close(),
    });
  } catch (e) {
    console.error('MOUNT ERROR: ', e);
    throw e;
  }
});

onMounted(() => {
  if (appElement.value) {
    const { width, height } = appElement.value.getBoundingClientRect();
    setAppWindowSize({ width, height });
    resizeObserver.observe(appElement.value as Element);
  }
});

onBeforeUnmount(() => {
  connectivityTimerId.value && clearInterval(connectivityTimerId.value!);
});
</script>

<template>
  <div
    ref="appElement"
    :class="$style.app"
  >
    <div :class="$style.toolbar">
      <div :class="$style.toolbarTitle">
        <img
          :src="prLogo"
          alt="logo"
          :class="$style.toolbarLogo"
        >
        <div :class="$style.delimiter">
          /
        </div>
        <div :class="$style.info">
          {{ $tr('app.title') }}
          <div :class="$style.version">
            v {{ appVersion }}
          </div>
        </div>
      </div>

      <div :class="$style.user">
        <div :class="$style.userInfo">
          <span :class="$style.mail">
            {{ me }}
          </span>
          <span :class="$style.connection">
            {{ $tr('app.status') }}:
            <span :class="connectivityStatusText === 'app.status.connected.online' && $style.connectivity">
              {{ $tr(connectivityStatusText) }}
            </span>
          </span>
        </div>
        <ui3n-menu
          position-strategy="fixed"
          :offset-y="4"
        >
          <div
            v-ui3n-ripple
            :class="$style.icon"
          >
            <contact-icon
              :name="me"
              :size="36"
              :readonly="true"
            />
          </div>

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
    </div>

    <div :class="$style.content">
      <router-view v-slot="{ Component }">
        <transition>
          <component :is="Component" />
        </transition>
      </router-view>
    </div>

    <div id="notification" />
  </div>
</template>

<style lang="scss" module>
@use '../assets/styles/mixins' as mixins;

.app {
  --main-toolbar-height: calc(var(--spacing-s) * 9);

  position: fixed;
  inset: 0;
}

.toolbar {
  position: relative;
  width: 100%;
  height: var(--main-toolbar-height);
  padding: 0 var(--spacing-m);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--color-border-block-primary-default);
}

.toolbarTitle {
  display: flex;
  justify-content: flex-start;
  align-items: center;
}

.toolbarLogo {
  position: relative;
  top: -2px;
  margin-right: var(--spacing-m);
  height: var(--spacing-l);
}

.delimiter {
  font-size: 20px;
  font-weight: 500;
  color: var(--color-text-control-accent-default);
  margin-right: var(--spacing-m);
  padding-bottom: 2px;
}

.info {
  position: relative;
  width: max-content;
  font-size: var(--font-16);
  font-weight: 500;
  color: var(--color-text-control-primary-default);
  display: flex;
  justify-content: flex-start;
  align-items: center;
  gap: var(--spacing-s);
  padding-bottom: calc(var(--spacing-xs) / 2);
}

.version {
  font-size: var(--font-16);
  font-weight: 500;
  color: var(--color-text-control-secondary-default);
  line-height: var(--font-16);
}

.user {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.userInfo {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-end;
  margin-right: var(--spacing-m);

  span:not(.connectivity) {
    color: var(--color-text-control-primary-default);
    line-height: 1.4;
  }
}


.mail {
  font-size: var(--font-14);
  font-weight: 600;
}

.connection {
  font-size: var(--font-12);
  font-weight: 500;
}

.connectivity {
  color: var(--success-content-default);
}

.icon {
  position: relative;
  cursor: pointer;
  overflow: hidden;
  border-radius: 50%;
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

.content {
  position: fixed;
  left: 0;
  right: 0;
  top: calc(var(--main-toolbar-height) + 1px);
  bottom: 0;
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
  align-content: flex-end;
}
</style>
