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
import { ref, computed, onBeforeMount, inject } from 'vue';
import { storeToRefs } from 'pinia';
import get from 'lodash/get';
import keyBy from 'lodash/keyBy';
import { I18N_KEY } from '@v1nt1248/3nclient-lib/plugins';
import { capitalize } from '@v1nt1248/3nclient-lib/utils';
import { Ui3nButton, Ui3nChip, Ui3nInput, Ui3nTooltip } from '@v1nt1248/3nclient-lib';
import type { ChatIdObj, PersonView } from '~/index';
import ContactList from '../contacts/contact-list.vue';
import ContactIcon from '../contacts/contact-icon.vue';
import { useChatsStore } from '@main/store/chats.store';
import { useAppStore } from '@main/store/app.store';
import { useContactsStore } from '@main/store/contacts.store';

interface ChatCreateDialogEmits {
  (ev: 'select', val: ChatIdObj): void;
  (ev: 'close'): void;
  (ev: 'confirm'): void;
  (ev: 'cancel'): void;
}

const emits = defineEmits<ChatCreateDialogEmits>();

const { $tr } = inject(I18N_KEY)!;

const { user } = storeToRefs(useAppStore());
const contactsStore = useContactsStore();
const { contactList: allContacts } = storeToRefs(contactsStore);
const { fetchContacts, addContact } = contactsStore;
const { createNewOneToOneChat, createNewGroupChat } = useChatsStore();

const searchText = ref<string>('');
const selectedContacts = ref<string[]>([]);
const groupChatModeStep = ref(1);
const chatName = ref('');

const nonSelectableContacts = computed<string[]>(() => allContacts.value
  .reduce((res, contact) => {
    if (contact.mail === user.value) {
      res.push(contact.id);
    }
    return res;
  }, [] as string[]),
);

const contacts = computed<Record<string, PersonView & { displayName: string }>>(() => keyBy(allContacts.value, 'id'));

const selectedContactList = computed<Array<PersonView & { displayName: string }>>(
  () => allContacts.value.filter(c => selectedContacts.value.includes(c.id)),
);

const isGroupChatMode = computed(() => selectedContacts.value.length > 1);

const actionLeftBtnText = computed(() => capitalize($tr(isGroupChatMode.value
  ? ((groupChatModeStep.value === 1) ? 'btn.text.close' : 'btn.text.back')
  : 'btn.text.close'
)));

const actionRightBtnText = computed(() => capitalize($tr(isGroupChatMode.value
  ? ((groupChatModeStep.value === 1) ? 'btn.text.next' : 'btn.text.create')
  : 'btn.text.create'
)));

onBeforeMount(async () => {
  await fetchContacts();
});

async function selectContacts(contactId: string) {
  const contactIndex = selectedContacts.value.indexOf(contactId);
  if (contactIndex === -1) {
    selectedContacts.value.push(contactId);
  } else {
    selectedContacts.value.splice(contactIndex, 1);
  }
}

function getContact(contactId: string): PersonView & { displayName: string } {
  return get(contacts.value, contactId);
}

function onActionLeftBtnClick() {
  if (isGroupChatMode.value && (groupChatModeStep.value === 2)) {
    groupChatModeStep.value = 1;
  } else {
    emits('close');
  }
}

async function onActionRightBtnClick() {
  if (isGroupChatMode.value && (groupChatModeStep.value === 1)) {
    groupChatModeStep.value = 2;
  } else {
    let chatId: ChatIdObj;
    if (isGroupChatMode.value) {
      const groupMembers = [
        user.value,
        ...selectedContacts.value.map(cId => contacts.value[cId].mail),
      ];
      const name = chatName.value.trim();
      chatId = await createNewGroupChat(name, groupMembers);
    } else {
      const {
        displayName: name, mail: peerAddr
      } = contacts.value[selectedContacts.value[0]];
      chatId = await createNewOneToOneChat(name, peerAddr);
    }
    emits('select', chatId);
  }
}

async function addNewContact(mail: string) {
  await addContact(mail);
}
</script>

<template>
  <div :class="$style.chatCreateDialog">
    <div :class="$style.chatCreateDialogBody">
      <template v-if="!isGroupChatMode || (isGroupChatMode && groupChatModeStep === 1)">
        <ui3n-input
          v-model="searchText"
          icon="round-search"
          clearable
          :class="$style.chatCreateDialogInput"
        />

        <div :class="$style.chatCreateDialogContent">
          <template v-if="selectedContacts.length > 1">
            <div :class="$style.chatCreateDialogSelectedInfo">
              {{ $tr('chat.create.dialog.selected.contacts') }}:
              {{ selectedContacts.length }}/{{ Object.values(allContacts).length }}
            </div>

            <div :class="$style.chatCreateDialogSelectedBody">
              <template
                v-for="contactId in selectedContacts"
                :key="contactId"
              >
                <ui3n-tooltip
                  placement="top"
                  :content="getContact(contactId).mail"
                >
                  <ui3n-chip
                    :max-width="104"
                    :class="$style.chatCreateDialogSelectedItem"
                  >
                    {{ getContact(contactId).displayName }}
                    <template #left>
                      <contact-icon
                        :name="getContact(contactId).displayName"
                        :size="24"
                        :readonly="true"
                      />
                    </template>
                  </ui3n-chip>
                </ui3n-tooltip>
              </template>
            </div>
          </template>
        </div>

        <div :class="$style.chatCreateDialogContentList">
          <contact-list
            :contact-list="Object.values(contacts)"
            :search-text="searchText"
            :selected-contacts="selectedContacts"
            :non-selectable-contacts="nonSelectableContacts"
            @select="selectContacts"
            @add:new="addNewContact"
          />
        </div>
      </template>

      <template v-else>
        <ui3n-input
          v-model="chatName"
          :label="$tr('chat.create.group.name.label')"
          :class="$style.chatCreateDialogInput"
        />

        <div :class="$style.chatCreateDialogContentList">
          <contact-list
            :contact-list="selectedContactList"
            :without-anchor="true"
            :readonly="true"
          />
        </div>
      </template>
    </div>

    <div :class="$style.chatCreateDialogActions">
      <ui3n-button
        type="secondary"
        @click="onActionLeftBtnClick"
      >
        {{ actionLeftBtnText }}
      </ui3n-button>

      <ui3n-button
        v-if="selectedContacts.length > 0"
        :disabled="isGroupChatMode && groupChatModeStep === 2 && !chatName"
        :class="$style.actionRightBtn"
        @click="onActionRightBtnClick"
      >
        {{ actionRightBtnText }}
      </ui3n-button>
    </div>
  </div>
</template>

<style lang="scss" module>
.chatCreateDialog {
  --chat-create-dialog-actions-height: 64px;

  position: relative;
  width: calc(var(--column-size) * 4);
  height: calc(95vh - var(--spacing-xxl));
  padding: var(--spacing-m) 0 0 var(--spacing-m);
  border-radius: var(--spacing-s);
  background-color: var(--color-bg-block-primary-default);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  overflow: hidden;
}

.chatCreateDialogBody {
  position: relative;
  height: calc(100% - var(--chat-create-dialog-actions-height));
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
}

.chatCreateDialogActions {
  position: relative;
  height: var(--chat-create-dialog-actions-height);
  padding-right: var(--spacing-m);
  display: flex;
  justify-content: space-between;
  align-items: center;
  column-gap: var(--spacing-s);
}

.chatCreateDialogInput {
  width: calc(100% - var(--spacing-m));
  margin-bottom: var(--spacing-s);

  :global(.ui3n-icon) {
    top: 10px;
  }
}

.chatCreateDialogContent {
  position: relative;
  width: 100%;
}

.chatCreateDialogSelectedInfo {
  font-size: var(--font-10);
  font-weight: 500;
  color: var(--color-text-block-secondary-default);
  margin-bottom: var(--spacing-s);
}

.chatCreateDialogSelectedBody {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: flex-start;
  margin-bottom: var(--spacing-s);
}

.chatCreateDialogSelectedItem {
  --font-size-sm: var(--font-10);
  --chip-text-small-margin: 0;
  --chip-small-padding: 0 var(--base-size);

  max-width: 104px;
  margin: 0 var(--spacing-xs) var(--spacing-xs) 0;
  padding-left: 0 !important;
}

.chatCreateDialogContentList {
  position: relative;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  flex-grow: 2;

  & > div > div > div {
    padding-right: var(--spacing-m) !important;
  }
}

.actionRightBtn {
  width: 64px !important;
}
</style>
