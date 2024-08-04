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
  import { computed } from 'vue'
  import { emoticons, Ui3nClickOutside, Ui3nEmoji } from "@v1nt1248/3nclient-lib";

  const vOnClickOutside = Ui3nClickOutside

  defineProps<{
    open: boolean;
  }>()
  const emit = defineEmits(['close', 'select'])

  const emoticonsByGroups = computed(() => {
    return Object.keys(emoticons).reduce((res, id) => {
      const { group, value } = emoticons[id]
      if (!res[group]) {
        res[group] = []
      }
      res[group].push({ id, value })

      return res
    }, {} as Record<string, { id: string, value: string }[]>)
  })

  const closeDialog = () => {
    emit('close')
  }

  const selectEmoticon = ({ id, value }: { id: string, value: string }) => {
    emit('select', { id, value })
    closeDialog()
  }
</script>

<template>
  <div
    v-if="open"
    v-on-click-outside="closeDialog"
    class="emoticons-dialog"
  >
    <div class="emoticons-dialog__body">
      <div
        v-for="group in Object.keys(emoticonsByGroups)"
        :key="group"
        class="emoticons-dialog__group"
      >
        <h4 class="emoticons-dialog__group-name">
          {{ group }}
        </h4>
        <div class="emoticons-dialog__group-body">
          <ui3n-emoji
            v-for="emoticon in emoticonsByGroups[group]"
            :key="emoticon.id"
            :emoji="emoticon.id"
            :size="20"
            class="emoticons-dialog__emoji"
            @click="selectEmoticon({ id: emoticon.id, value: emoticon.value })"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import "../../assets/styles/mixins";

  .emoticons-dialog {
    --emoticons-dialog-padding: calc(var(--base-size) * 1.5);

    position: absolute;
    width: 200px;
    height: 200px;
    padding: var(--emoticons-dialog-padding) var(--base-size) var(--emoticons-dialog-padding);
    background-color: var(--system-white);
    border-radius: var(--half-size);
    bottom: 100%;
    left: calc(var(--half-size) * 1.5);
    z-index: 5;
    @include block-shadow;

    &__body {
      position: relative;
      width: 100%;
      height: 100%;
      overflow-x: hidden;
      overflow-y: auto;

      .emoticons-dialog__group:last-child {
        padding-bottom: 0;
      }
    }

    &__group {
      padding-bottom: var(--base-size);

      &-name {
        font-size: var(--font-12);
        margin: 0 0 var(--base-size);
      }

      &-body {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        grid-row-gap: var(--base-size);
      }
    }

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
      border-color: var(--black-30) transparent transparent transparent;
    }

    &::after {
      left: 9px;
      bottom: -10px;
      border: 5px solid;
      border-color: var(--system-white) transparent transparent transparent;
    }
  }
</style>
