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
import { computed } from 'vue';
import { Ui3nButton } from '@v1nt1248/3nclient-lib';
import { mailReg } from '@v1nt1248/3nclient-lib/utils';
import type { PersonView } from '~/index';
import ContactListItem from './contact-list-item.vue';

const props = defineProps<{
  contactList: Array<PersonView & { displayName: string }>;
  searchText?: string;
  selectedContacts?: string[];
  nonSelectableContacts?: string[];
  withoutAnchor?: boolean;
  readonly?: boolean;
}>();
const emit = defineEmits(['select', 'add:new']);

const contactListProps = computed(() => {
  const {
    contactList = [],
    searchText = '',
    selectedContacts = [],
    nonSelectableContacts = [],
    withoutAnchor = false,
    readonly = false,
  } = props;
  return { contactList, searchText, selectedContacts, nonSelectableContacts, withoutAnchor, readonly };
});

const contactListByLetters = computed<Record<string, Array<PersonView & { displayName: string }>>>(() => {
  return contactListProps.value.contactList
    .filter(c => c.displayName.toLocaleLowerCase().includes(contactListProps.value.searchText.toLocaleLowerCase()))
    .reduce((res, item) => {
      const letter = contactListProps.value.withoutAnchor ? 'one' : item.displayName[0].toUpperCase();
      if (!res[letter]) {
        res[letter] = [];
      }

      res[letter].push(item);
      return res;
    }, {} as Record<string, Array<PersonView & { displayName: string }>>);
});

const isMailValid = computed<boolean>(() => mailReg.test(props.searchText || ''));

function selectContact(contactId: string) {
  emit('select', contactId);
}

function addNewContact(ev: Event) {
  ev.stopPropagation();
  ev.preventDefault();
  if (isMailValid.value) {
    emit('add:new', props.searchText as string);
  }
}
</script>

<template>
  <div :class="$style.contactList">
    <div
      v-if="Object.keys(contactListByLetters).length"
      :class="$style.contactListContent"
    >
      <div
        v-for="letter in Object.keys(contactListByLetters)"
        :key="letter"
        :class="$style.contactSubList"
      >
        <div
          v-if="letter !== 'one'"
          :class="$style.contactSubListTitle"
        >
          {{ letter }}
        </div>

        <contact-list-item
          v-for="contact in contactListByLetters[letter]"
          :key="contact.id"
          :contact="contact"
          :selected="contactListProps.selectedContacts.includes(contact.id)"
          :without-anchor="contactListProps.withoutAnchor"
          :readonly="contactListProps.readonly || (nonSelectableContacts || []).includes(contact.id)"
          @click="selectContact"
        />
      </div>
    </div>

    <div
      v-else
      :class="$style.contactListContentInfo"
    >
      <ui3n-button
        type="secondary"
        :size="'small'"
        v-on="!isMailValid ? {} : { click: (ev: Event) => addNewContact(ev) }"
      >
        Add {{ searchText }}
      </ui3n-button>
    </div>
  </div>
</template>

<style lang="scss" module>
.contactList,
.contactListContent{
  position: relative;
  width: 100%;
}

.contactSubList {
  padding: var(--spacing-xs) 0;
}

.contactSubListTitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-block-accent-default);
  line-height: 1;
  margin-bottom: var(--spacing-xs);
}

.contactListContentInfo {
  position: relative;
  width: 100%;
  height: var(--spacing-xxl);
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
