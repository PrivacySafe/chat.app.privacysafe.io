<!--
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
-->
<!--
 Shown when the window is up but its background component is not answering.

 The counterpart of the pre-mount screen in
 common/services/startup-failure-screen.ts, for the case where the failure is
 found by the first real call rather than by the connect: the app is mounted,
 and everything in it is about to do nothing. Both offer the same two ways
 out, because in the incident this comes from only a restart actually helped.
-->
<script lang="ts" setup>
  import { computed } from 'vue';
  import { storeToRefs } from 'pinia';
  import { useI18n } from 'vue-i18n';
  import { Ui3nButton } from '@v1nt1248/3nclient-lib';
  import { useAppStore } from '@main/common/store/app.store';

  const { t } = useI18n();
  const { backendState } = storeToRefs(useAppStore());

  const isShown = computed(() => (
    (backendState.value === 'unreachable') || (backendState.value === 'failed')
  ));

  const title = computed(() => ((backendState.value === 'failed')
    ? t('app.startup.failedTitle')
    : t('app.startup.unreachableTitle')));

  function reload(): void {
    location.reload();
  }

  function closeApp(): void {
    w3n.closeSelf!();
  }
</script>

<template>
  <div
    v-if="isShown"
    :class="$style.overlay"
  >
    <div :class="$style.box">
      <div :class="$style.title">
        {{ title }}
      </div>
      <div :class="$style.text">
        {{ t('app.startup.unreachableText') }}
      </div>
      <div :class="$style.actions">
        <ui3n-button @click="reload">
          {{ t('app.startup.retry') }}
        </ui3n-button>
        <ui3n-button
          type="secondary"
          @click="closeApp"
        >
          {{ t('app.startup.closeApp') }}
        </ui3n-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
  .overlay {
    position: absolute;
    inset: 0;
    z-index: 100;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--color-bg-block-primary-default);
  }

  .box {
    width: 360px;
    max-width: 90%;
    text-align: center;
  }

  .title {
    font-size: var(--font-16);
    font-weight: 600;
    color: var(--color-text-block-primary-default);
    margin-bottom: var(--spacing-s);
  }

  .text {
    font-size: var(--font-13);
    color: var(--color-text-block-secondary-default);
    margin-bottom: var(--spacing-m);
  }

  .actions {
    display: flex;
    justify-content: center;
    gap: var(--spacing-s);
  }
</style>
