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
import type { PersonView } from '~/index';
import ContactIcon from './contact-icon.vue';

defineProps<{
  contact: PersonView & { displayName: string };
  selected: boolean;
  withoutAnchor: boolean;
  readonly: boolean;
}>();

const emit = defineEmits(['click']);
</script>

<template>
  <div
    :class="[
      $style.contactListItem,
      withoutAnchor && $style.withoutAnchor,
      readonly && $style.readonly,
    ]"
    v-on="readonly ? {} : { click: () => emit('click', contact.id) }"
  >
    <contact-icon
      :name="contact.displayName"
      :size="36"
      :selected="selected"
      :readonly="true"
    />
    <span :class="[$style.name, selected && $style.nameSelected]">
      {{ contact.displayName }}
    </span>
  </div>
</template>

<style lang="scss" module>
@use '../../assets/styles/mixins' as mixins;

.contactListItem {
  position: relative;
  width: 100%;
  height: var(--spacing-xxl);
  display: flex;
  justify-content: flex-start;
  align-items: center;
  column-gap: var(--spacing-s);
  padding: 0 var(--spacing-m);
  font-size: var(--font-14);
  font-weight: 500;
  color: var(--color-text-control-primary-default);

  &:not(.readonly) {
    cursor: pointer;

    &:hover {
      background-color: var(--color-bg-chat-bubble-general-bg);
    }
  }
}

.withoutAnchor {
  padding: 0;
}

.readonly {
  cursor: default;
}

.name {
  display: inline-block;
  margin-left: var(--spacing-s);
  @include mixins.text-overflow-ellipsis(calc(100% - calc(var(--spacing-s) * 5.5)));
}

.nameSelected {
  color: var(--color-text-control-accent-default);
}
</style>
