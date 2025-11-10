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
import keyBy from 'lodash/keyBy';
import { I18N_KEY, I18nPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { capitalize } from '@v1nt1248/3nclient-lib/utils';
import { Ui3nButton, Ui3nChip, Ui3nInput, Ui3nProgressCircular, Ui3nTooltip } from '@v1nt1248/3nclient-lib';
import type { ChatIdObj, PersonView } from '~/index';
import { useChatsStore } from '@main/common/store/chats.store';
import { useAppStore } from '@main/common/store/app.store';
import { useContactsStore } from '@main/common/store/contacts.store';
import ContactList from '@main/common/components/contacts/contact-list.vue';
import ContactIcon from '@main/common/components/contacts/contact-icon.vue';

interface ChatCreateDialogEmits {
  (ev: 'select', val: ChatIdObj): void;
  (ev: 'close'): void;
  (ev: 'confirm'): void;
  (ev: 'cancel'): void;
}

const emits = defineEmits<ChatCreateDialogEmits>();

const { $tr } = inject<I18nPlugin>(I18N_KEY)!;

const { user } = storeToRefs(useAppStore());

const contactsStore = useContactsStore();
const { contactList: allContacts } = storeToRefs(contactsStore);
const { fetchContacts, addContact } = contactsStore;

const { createNewOneToOneChat, createNewGroupChat } = useChatsStore();

const isProcessing = ref(false);
const searchText = ref<string>('');
const selectedContacts = ref<(PersonView & { displayName: string })[]>([]);
const groupChatModeStep = ref(1);
const chatName = ref('');

const contacts = computed<Record<string, PersonView & { displayName: string }>>(() => keyBy(allContacts.value, 'id'));

const nonSelectableContacts = computed(() => {
  const me = allContacts.value.find(c => c.mail === user.value);
  return me ? [me] : [];
});

const isGroupChatMode = computed(() => selectedContacts.value.length > 1);

const actionLeftBtnText = computed(() => isGroupChatMode.value
  ? $tr(groupChatModeStep.value === 1 ? 'btn.text.close' : 'btn.text.back')
  : $tr('btn.text.close'),
);

const actionRightBtnText = computed(() => isGroupChatMode.value
  ? $tr(groupChatModeStep.value === 1 ? 'btn.text.next' : 'btn.text.create')
  : $tr('btn.text.create'),
);

function getSelectedContactIndex(contact: PersonView & { displayName: string }): number {
  return selectedContacts.value.findIndex(c => c.mail === contact.mail);
}

async function selectContacts(contact: PersonView & { displayName: string }) {
  const contactIndex = getSelectedContactIndex(contact);
  if (contactIndex === -1) {
    selectedContacts.value.push(contact);
  } else {
    selectedContacts.value.splice(contactIndex, 1);
  }
}

function onActionLeftBtnClick() {
  if (isGroupChatMode.value && groupChatModeStep.value === 2) {
    groupChatModeStep.value = 1;
  } else {
    emits('close');
  }
}

async function onActionRightBtnClick() {
  if (isGroupChatMode.value && groupChatModeStep.value === 1) {
    groupChatModeStep.value = 2;
    return;
  }

  try {
    isProcessing.value = true;
    let chatId: ChatIdObj | undefined;
    if (isGroupChatMode.value) {
      const groupMembers = selectedContacts.value.reduce((res, c) => {
        const { mail } = c;
        res[mail] = { hasAccepted: false };
        return res;
      }, { [user.value]: { hasAccepted: true } });

      const name = chatName.value.trim();
      chatId = await createNewGroupChat(name, groupMembers);
    } else {
      const { displayName: name, mail: peerAddr } = selectedContacts.value[0];
      chatId = await createNewOneToOneChat(name, peerAddr);
    }

    emits('select', chatId!);
    emits('confirm');
  } finally {
    isProcessing.value = false;
  }
}

async function addNewContact(mail: string) {
  await addContact(mail);
}

onBeforeMount(async () => {
  await fetchContacts();
});
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
                v-for="contact in selectedContacts"
                :key="contact.id"
              >
                <ui3n-tooltip
                  placement="top"
                  :content="contact.mail"
                >
                  <ui3n-chip
                    :max-width="104"
                    :class="$style.chatCreateDialogSelectedItem"
                  >
                    {{ contact.displayName }}
                    <template #left>
                      <contact-icon
                        :name="contact.displayName"
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
            :contact-list="selectedContacts"
            :without-anchor="true"
            :readonly="true"
          />
        </div>
      </template>
    </div>

    <div :class="$style.chatCreateDialogActions">
      <ui3n-button
        type="secondary"
        :disabled="isProcessing"
        @click="onActionLeftBtnClick"
      >
        {{ capitalize(actionLeftBtnText) }}
      </ui3n-button>

      <ui3n-button
        v-if="selectedContacts.length > 0"
        :disabled="(isGroupChatMode && groupChatModeStep === 2 && !chatName) || isProcessing"
        :class="$style.actionRightBtn"
        @click="onActionRightBtnClick"
      >
        {{ capitalize(actionRightBtnText) }}
      </ui3n-button>
    </div>

    <div
      v-if="isProcessing"
      :class="$style.processing"
    >
      <ui3n-progress-circular
        indeterminate
        size="80"
      />
    </div>
  </div>
</template>

<style lang="scss" module>
.chatCreateDialog {
  --chat-create-dialog-actions-height: 64px;

  position: relative;
  width: 100%;
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

.processing {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
  background-color: var(--black-12);
}
</style>
