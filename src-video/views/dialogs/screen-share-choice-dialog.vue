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
import SharePreview from '@video/components/share-preview.vue';
import { ScreenShareChoicesProps, useScreenShareChoiceDialog } from './sharing-choice-dialog';
import { ref } from 'vue';

const props = defineProps<ScreenShareChoicesProps>();
const emits = defineEmits([ 'select' ]);

const {
  windowChoices, screenChoices, onOptionSelectionChange, onDeskSoundChange
} = useScreenShareChoiceDialog(
  props, emits
);

const selectAudio = ref(props.initialDeskSoundShared);

</script>

<template>
  <div :class=$style.shareOptions>

    <div :class=$style.soundShare>
      <ui3n-switch
        v-model=selectAudio
        @change="onDeskSoundChange"
        size="24"
      >
        Share sound
      </ui3n-switch>
    </div>

    <h2>Screens:</h2>

    <share-preview :class=$style.shareOption
      v-for="screen in screenChoices"
      :opts=screen
      @selected="v => onOptionSelectionChange(screen, v)"
    />

    <h2>Windows:</h2>

    <share-preview :class=$style.shareOption
      v-for="frame in windowChoices"
      :opts=frame
      @selected="v => onOptionSelectionChange(frame, v)"
    />

  </div>
</template>

<style lang="scss" module>

.shareOptions {
  font-size: var(--font-14);
  font-weight: 400;
  color: var(--color-text-block-primary-default);
  padding: var(--spacing-l) var(--spacing-m);
}

.soundShare {
  margin-bottom: var(--spacing-l);
}

.shareOption {
  width: 100%;
  text-align: center;
  margin-bottom: var(--spacing-l);
}

</style>
