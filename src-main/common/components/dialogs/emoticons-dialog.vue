<!--
 Copyright (C) 2020 - 2024 3NSoft Inc.

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
import { emoticons } from '@v1nt1248/3nclient-lib/utils';
import { Ui3nClickOutside, Ui3nEmoji } from '@v1nt1248/3nclient-lib';

const vOnClickOutside = Ui3nClickOutside;

defineProps<{
  open: boolean;
}>();
const emit = defineEmits(['close', 'select']);

const emoticonsByGroups = Object.keys(emoticons).reduce(
  (res, id) => {
    const { group, value } = emoticons[id];
    if (!res[group]) {
      res[group] = [];
    }
    res[group].push({ id, value });

    return res;
  },
  {} as Record<string, { id: string, value: string }[]>,
);
const groups = Object.keys(emoticonsByGroups);
const peopleGrInd = groups.findIndex(g => (g.toLowerCase() == 'people'));
if (peopleGrInd > 0) {
  const peopleGr = groups.splice(peopleGrInd, 1)[0];
  groups.unshift(peopleGr);
}

function closeDialog() {
  emit('close');
}

function selectEmoticon({ id, value }: { id: string, value: string }) {
  emit('select', { id, value });
  closeDialog();
}
</script>

<template>
  <div
    v-if="open"
    v-on-click-outside="closeDialog"
    :class="$style.emoticonsDialog"
  >
    <div :class="$style.emoticonsDialogBody">
      <div
        v-for="group in groups"
        :key="group"
        :class="$style.emoticonsDialogGroup"
      >
        <!--
        <h4 :class="$style.emoticonsDialogGroupName">
          {{ group }}
        </h4>
         -->
        <div :class="$style.emoticonsDialogGroupBody">
          <ui3n-emoji
            v-for="emoticon in emoticonsByGroups[group]"
            :key="emoticon.id"
            :emoji="emoticon.id"
            :size="28"
            @click="selectEmoticon({ id: emoticon.id, value: emoticon.value })"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
@use '@main/common/assets/styles/_mixins.scss' as mixins;

.emoticonsDialog {
  --emoticons-dialog-padding: calc(var(--spacing-s) * 1.5);

  position: absolute;
  width: 204px;
  height: 200px;
  padding: var(--emoticons-dialog-padding) var(--spacing-s) var(--emoticons-dialog-padding);
  background-color: var(--color-bg-block-primary-default);
  border-radius: var(--spacing-xs);
  bottom: 100%;
  left: calc(var(--spacing-xs) / 2);
  z-index: 5;
  @include mixins.block-shadow();

  &::before,
  &::after {
    content: ' ';
    position: absolute;
    width: 0;
    height: 0;
  }

  &::before {
    left: 8px;
    bottom: -12px;
    border: 6px solid;
    border-color: var(--color-text-chat-bubble-other-default) transparent transparent transparent;
  }

  &::after {
    left: 9px;
    bottom: -10px;
    border: 5px solid;
    border-color: var(--color-bg-block-primary-default) transparent transparent transparent;
  }
}

.emoticonsDialogBody {
  position: relative;
  width: 100%;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;

  .emoticonsDialogGroup:last-child {
    padding-bottom: 0;
  }
}

.emoticonsDialogGroup {
  padding-bottom: var(--spacing-s);
}

.emoticonsDialogGroupBody {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  row-gap: var(--spacing-s);
}
</style>
