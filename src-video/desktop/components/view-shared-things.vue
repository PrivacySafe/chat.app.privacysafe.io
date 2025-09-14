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
<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import size from 'lodash/size';
import { I18N_KEY } from '@v1nt1248/3nclient-lib/plugins';
import {
  Ui3nButton,
  Ui3nIcon,
  Ui3nRipple as vUi3nRipple,
  Ui3nTooltip,
  type Nullable,
} from '@v1nt1248/3nclient-lib';
import type { OwnScreen } from '@video/common/types';
import { useStreamsStore } from '@video/common/store/streams.store.ts';
import VideoStream from '@video/common/components/video-stream.vue';

interface PeerShared {
  peerAddr: string;
  peerName: string;
  stream: MediaStream;
}

const props = defineProps<{
  things: (OwnScreen | PeerShared)[];
}>();

const { $tr } = inject(I18N_KEY)!;

const streamsStore = useStreamsStore();
const { isSharingOwnDeskSound } = storeToRefs(streamsStore);
const { setOwnDeskSoundSharing, removeOwnScreen } = streamsStore;

const currentSharedItem = ref(0);

const processedSharedItems = computed(() => props.things.map((thing) => ({
  ...thing,
  id: (thing as OwnScreen).srcId || (thing as PeerShared).peerAddr,
})));

const selectedSharedItem = ref<Nullable<OwnScreen | PeerShared>>(processedSharedItems.value[0]);

function selectSharedItem(index: number) {
  currentSharedItem.value = index;
  selectedSharedItem.value = null;
  nextTick(() => {
    selectedSharedItem.value = processedSharedItems.value[currentSharedItem.value];
  });
}

watch(
  () => size(processedSharedItems.value),
  (val, oldVal) => {
    if (val !== oldVal) {
      size(processedSharedItems.value) > 0 && selectSharedItem(0);
    }
  }
);
</script>

<template>
  <div
    :class="[
      $style.viewSharedThings,
      isSharingOwnDeskSound && $style.withDeskSound,
      size(things) > 1 && $style.withTabs
    ]"
  >
    <div
      v-if="isSharingOwnDeskSound"
      :class="$style.title"
    >
      <div :class="$style.name">
        <ui3n-icon
          icon="round-volume-up"
          width="16"
          height="16"
        />

        <span>{{ $tr('sharing.desktop.sound') }}</span>
      </div>

      <ui3n-button
        type="icon"
        size="small"
        color="var(--color-bg-block-primary-default)"
        icon="round-close"
        icon-color="var(--color-icon-table-primary-default)"
        icon-size="20"
        @click.stop.prevent="setOwnDeskSoundSharing(false)"
      />
    </div>

    <div
      v-if="size(things) > 1"
      :class="$style.tabs"
    >
      <div
        v-for="(item, index) in processedSharedItems"
        :key="item.id"
        v-ui3n-ripple
        :class="[$style.tab, index === currentSharedItem && $style.selected]"
        @click.stop.prevent="selectSharedItem(index)"
      >
        <ui3n-tooltip
          :content="(item as OwnScreen).name || (item as PeerShared).peerAddr"
          placement="top-start"
          position-strategy="fixed"
        >
          <div :class="$style.tabBody">
            {{ index }}
          </div>
        </ui3n-tooltip>
      </div>
    </div>

    <div :class="$style.body">
      <div :class="[$style.title, $style.withPadding, $style.selected]">
        <div :class="$style.name">
          {{ (selectedSharedItem as OwnScreen)?.name || (selectedSharedItem as PeerShared)?.peerAddr }}
        </div>

        <ui3n-button
          v-if="(selectedSharedItem as OwnScreen)?.srcId"
          type="icon"
          size="small"
          icon="round-close"
          icon-size="20"
          @click.stop.prevent="removeOwnScreen((selectedSharedItem as OwnScreen).srcId)"
        />
      </div>

      <video-stream
        v-if="selectedSharedItem"
        :stream="selectedSharedItem.stream"
      />
    </div>
  </div>
</template>

<style lang="scss" module>
.viewSharedThings {
  position: relative;
  width: 100%;
  height: 100%;
  padding-left: var(--spacing-l);
  background-color: var(--color-bg-block-primary-default);
  color: var(--color-text-block-primary-default);

  &.withDeskSound {
    padding-top: var(--spacing-xl);

    .tabs {
      top: var(--spacing-xl);
    }
  }

  &.withTabs {
    padding-left: var(--spacing-xl);
  }
}

.title {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: var(--spacing-xl);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-16);
  font-weight: 600;
  border-bottom: 1px solid var(--color-border-block-primary-default);
}

.withPadding {
  padding: 0 var(--spacing-m);
}

.name {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  column-gap: var(--spacing-s);
}

.tabs {
  position: absolute;
  left: 0;
  width: var(--spacing-xl);
  top: 0;
  bottom: 0;
  border-right: 1px solid var(--color-border-block-primary-default);
}

.selected {
  background-color: var(--color-bg-control-primary-hover);
}

.tab {
  position: relative;
  width: var(--spacing-xl);
  height: var(--spacing-xl);
  border-radius: var(--spacing-xs);
  overflow: hidden;

  &:hover {
    background-color: var(--color-bg-control-primary-hover);
  }

  &:not(.selectedTab) {
    cursor: pointer;
  }
}

.tabBody {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: var(--font-16);
  font-weight: 600;
}

.body {
  position: relative;
  width: 100%;
  height: 100%;
  padding-top: var(--spacing-l);
}
</style>
