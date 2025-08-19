<!--
 Copyright (C) 2024 3NSoft Inc.

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
import { computed, type VNode } from 'vue';
import { Ui3nLongPress as vUi3nLongPress } from '@v1nt1248/3nclient-lib';
import type { PersonView } from '~/index';
import ContactIcon from './contact-icon.vue';

const props = defineProps<{
  contact: PersonView & { displayName: string };
  selected: boolean;
  withoutAnchor: boolean;
  readonly: boolean;
}>();
const emits = defineEmits<{
  (event: 'click', value: PersonView & { displayName: string }): void;
  (event: 'click:right', value: { contactId: string; mail: string }): void;
}>();
defineSlots<{
  extra?: (props: { contactId: string, mail: string }) => VNode;
}>();

const contactIconSize = 36;
const contactIconSizeCss = computed(() => `${contactIconSize}px`);

const contactElId = computed(() => {
  const parts = props.contact.mail.split('@');
  return parts && parts[0] ? `item-${parts[0]}` : '';
});

function onClick() {
  emits('click', props.contact);
}

function onClickRight() {
  emits('click:right', { contactId: props.contact.id, mail: props.contact.mail });
}
</script>

<template>
  <div
    :id="contactElId"
    v-ui3n-long-press="{ handler: () => onClickRight(), delay: 1000 }"
    :class="[
      $style.contactListItem,
      withoutAnchor && $style.withoutAnchor,
      readonly && $style.readonly,
    ]"
    v-on="readonly ? {} : { click: onClick }"
    @click.right="onClickRight"
  >
    <contact-icon
      :name="contact.displayName"
      :size="contactIconSize"
      :selected="selected"
      :readonly="true"
    />

    <span :class="[$style.name, selected && $style.nameSelected]">
      {{ contact.displayName }}
    </span>

    <div
      v-if="$slots.extra"
      :class="$style.extra"
    >
      <slot
        name="extra"
        :contact-id="contact.id"
        :mail="contact.mail"
      />
    </div>
  </div>
</template>

<style lang="scss" module>
@use '@main/common/assets/styles/_mixins.scss' as mixins;

.contactListItem {
  --contact-list-item-height: 48px;
  --contact-list-item-icon-size: v-bind(contactIconSizeCss);

  position: relative;
  width: 100%;
  height: var(--contact-list-item-height);
  display: flex;
  justify-content: flex-start;
  align-items: center;
  column-gap: var(--spacing-s);
  padding: 0 var(--spacing-m);
  font-size: var(--font-14);
  font-weight: 500;
  color: var(--color-text-control-primary-default);
  user-select: none;

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
  flex-grow: 1;
  @include mixins.text-overflow-ellipsis(calc(100% - var(--contact-list-item-icon-size)));
}

.nameSelected {
  color: var(--color-text-control-accent-default);
}

.extra {
  position: relative;
  min-width: 48px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
}
</style>
