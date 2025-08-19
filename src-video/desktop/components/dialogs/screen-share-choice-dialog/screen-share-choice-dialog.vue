<!--
 Copyright (C) 2024 - 2025 3NSoft Inc.

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
import { Ui3nSwitch } from '@v1nt1248/3nclient-lib';
import type { SharedStream } from '@video/common/types';
import { useScreenShareChoiceDialog } from './sharing-choice-dialog.ts';
import SharePreview from '@video/desktop/components/share-preview.vue';

export interface ScreenShareChoicesProps {
  initiallyShared: SharedStream[];
  initialDeskSoundShared: boolean;
}

export interface ScreenShareChoicesEmits {
  (event: 'select', value: unknown): void;
}

const props = defineProps<ScreenShareChoicesProps>();
const emits = defineEmits<ScreenShareChoicesEmits>();

const {
  selectAudio,
  windowChoices,
  screenChoices,
  onOptionSelectionChange,
  onDeskSoundChange,
} = useScreenShareChoiceDialog(props, emits);
</script>

<template>
  <div :class="$style.shareOptions">
    <div :class="$style.body">
      <div :class="$style.soundShare">
        <ui3n-switch
          v-model="selectAudio"
          size="24"
          @change="onDeskSoundChange"
        >
          {{ $tr('sharing.settings.sound.share') }}
        </ui3n-switch>
      </div>

      <div :class="$style.block">
        <div :class="$style.blockTitle">
          {{ $tr('sharing.settings.screens.title') }}:
        </div>

        <share-preview
          v-for="screen in screenChoices"
          :key="screen.srcId"
          :opts="screen"
          @selected="v => onOptionSelectionChange(screen, v)"
        />
      </div>

      <div :class="$style.block">
        <div :class="$style.blockTitle">
          {{ $tr('sharing.settings.windows.title') }}:
        </div>

        <share-preview
          v-for="frame in windowChoices"
          :key="frame.srcId"
          :opts="frame"
          @selected="v => onOptionSelectionChange(frame, v)"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
.shareOptions {
  position: relative;
  width: 100%;
  height: 100%;
  padding: var(--spacing-m);
}

.body {
  position: relative;
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.soundShare {
  margin-bottom: var(--spacing-m);
}

.block {
  position: relative;
  width: 100%;
  padding-top: var(--spacing-l);
  padding-right: var(--spacing-m);
  margin-bottom: var(--spacing-m);
  display: grid;
  grid-template-columns: repeat(auto-fill, 340px);
  gap: var(--spacing-m);
}

.blockTitle {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: var(--spacing-l);
  font-size: var(--font-16);
  font-weight: 600;
  line-height: var(--spacing-l);
  color: var(--color-text-control-primary-default);
}
</style>
