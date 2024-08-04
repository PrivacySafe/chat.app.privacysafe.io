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
  import { ref, computed, watch, onBeforeMount, toRefs, inject } from 'vue'
  import { get, keyBy } from 'lodash'
  import { useAppStore, useContactsStore, useChatsStore } from '../../store'
  import { I18nPlugin, I18N_KEY, Ui3nButton, Ui3nChip, Ui3nInput, Ui3nTabs } from '@v1nt1248/3nclient-lib'
  import ContactList from '../contacts/contact-list.vue'
  import ContactIcon from '../contacts/contact-icon.vue'

  const props = defineProps<{
    withoutOverlay?: boolean
  }>()
  const emit = defineEmits(['close'])

  const { $tr } = inject<I18nPlugin>(I18N_KEY)!

  const { user } = toRefs(useAppStore())
  const { contactList: allContacts } = toRefs(useContactsStore())
  const { fetchContactList, addContact } = useContactsStore()
  const { createChat } = useChatsStore()

  const tabs = ref({
    items: [
      { name: 'chat.create.dialog.tab.chat', id: 'regular' },
      { name: 'chat.create.dialog.tab.group', id: 'group' },
    ],
    current: 0,
  })
  const searchText = ref<string>('')
  const selectedContacts = ref<string[]>([])
  const multipleModeStep = ref(1)
  const groupChatName = ref('')

  const selectedChatType = computed<string>(() => tabs.value.items[tabs.value.current].id)
  const nonSelectableContacts = computed<string[]>(() => allContacts.value
    .reduce((res, contact) => {
      if (contact.mail === user.value) {
        res.push(contact.id)
      }
      return res
    }, [] as string[])
  )
  const contacts = computed<Record<string, PersonView & { displayName: string }>>(() => keyBy(allContacts.value, 'id'))
  const selectedContactList = computed<Array<PersonView & { displayName: string }>>(
    () => allContacts.value.filter(c => selectedContacts.value.includes(c.id))
  )

  onBeforeMount(async () => await fetchContactList())

  watch(
    () => selectedChatType.value,
    (val, oldValue) => {
      if (val !== oldValue) {
        selectedContacts.value = []
        multipleModeStep.value = 1
        groupChatName.value = ''
      }
    },
  )

  async function selectContacts(contactId: string) {
    if (selectedChatType.value === 'regular') {
      selectedContacts.value = [contactId]
      const person = get(contacts.value, [contactId, 'mail'])
      const members = [user.value, person]
      const chatId = await createChat({ members, admins: [user.value], name: person })
      closeDialog(chatId)
    } else {
      const contactIndex = selectedContacts.value.indexOf(contactId)
      if (contactIndex === -1) {
        selectedContacts.value.push(contactId)
      } else {
        selectedContacts.value.splice(contactIndex, 1)
      }
    }
  }

  function getContact(contactId: string): PersonView & { displayName: string } {
    return get(contacts.value, contactId)
  }

  function onFirstBtnClick() {
    if (
      selectedChatType.value === 'regular'
      || (selectedChatType.value === 'group' && multipleModeStep.value === 1)
    ) {
      emit('close')
    } else {
      multipleModeStep.value = 1
    }
  }

  async function onSecondBtnClick(){
    if (multipleModeStep.value === 1) {
      multipleModeStep.value = 2
    } else {
      const members = [
        user.value,
        ...selectedContacts.value.map(contactId => get(contacts.value, [contactId, 'mail'])),
      ]
      const chatId = await createChat({ members, admins: [user.value], name: groupChatName.value.trim() })
      closeDialog(chatId)
    }
  }

  async function addNewContact(mail: string) {
    await addContact(mail)
  }

  function closeDialog(chatId?: string) {
    if (!props.withoutOverlay) {
      emit('close', chatId)
    }
  }
</script>

<template>
  <div
    :class="[
      'chat-create-dialog__wrapper',
      { 'chat-create-dialog__wrapper--without-overlay': withoutOverlay }
    ]"
    @click.prevent.self="closeDialog(undefined)"
  >
    <div class="chat-create-dialog__body">
      <div class="chat-create-dialog__top">
        <ui3n-tabs
          v-model="tabs.current"
          class="chat-create-dialog__tabs"
        >
          <div
            v-for="item in tabs.items"
            :key="item.id"
            class="chat-create-dialog__tab"
          >
            {{ $tr(item.name) }}
          </div>
        </ui3n-tabs>
      </div>

      <div
        v-if="multipleModeStep === 1"
        class="chat-create-dialog__content"
      >
        <div class="chat-create-dialog__content-header">
          <ui3n-input
            v-model:value="searchText"
            icon="search"
            clearable
          />

          <template v-if="selectedChatType === 'group'">
            <div class="chat-create-dialog__selected-info">
              {{ $tr('chat.create.dialog.selected.contacts') }}:
              {{ selectedContacts.length }}/{{ Object.values(allContacts).length }}
            </div>

            <div
              v-if="selectedContacts.length"
              class="chat-create-dialog__selected-body"
            >
              <ui3n-chip
                v-for="contactId in selectedContacts"
                :key="contactId"
                :max-width="104"
                class="chat-create-dialog__selected-item"
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
            </div>
          </template>
        </div>

        <div class="chat-create-dialog__content-list">
          <contact-list
            :contact-list="Object.values(contacts)"
            :search-text="searchText"
            :selected-contacts="selectedContacts"
            :non-selectable-contacts="nonSelectableContacts"
            @select="selectContacts"
            @add:new="addNewContact"
          />
        </div>
      </div>

      <div
        v-else
        class="chat-create-dialog__content"
      >
        <div class="chat-create-dialog__content-header">
          <ui3n-input
            v-model:value="groupChatName"
            label="Group Name"
            clearable
          />

          <div class="chat-create-dialog__content-list">
            <contact-list
              :contact-list="selectedContactList"
              :without-anchor="true"
              :readonly="true"
            />
          </div>
        </div>
      </div>

      <div class="chat-create-dialog__buttons">
        <ui3n-button
          text-color="var(--blue-main, #0090ec)"
          color="var(--system-white, #fff)"
          @click="onFirstBtnClick"
        >
          {{ multipleModeStep === 1 ? $tr('btn.text.close') : $tr('btn.text.back') }}
        </ui3n-button>

        <ui3n-button
          v-if="selectedChatType === 'group'"
          :disabled="!selectedContacts.length || (multipleModeStep === 2 && !groupChatName)"
          @click="onSecondBtnClick"
        >
          {{ multipleModeStep === 1 ? $tr('btn.text.next') : $tr('btn.text.create') }}
        </ui3n-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
  @import "../../assets/styles/mixins";

  .chat-create-dialog__wrapper {
    position: fixed;
    z-index: 1000;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.5);

    .chat-create-dialog__body {
      position: relative;
      width: 380px;
      height: 90%;
      border-radius: var(--base-size);
      background-color: var(--system-white, #fff);
    }

    &--without-overlay {
      top: 5%;
      bottom: 5%;
      left: calc(50% - 190px);
      width: 380px;
      background-color: transparent;
      border-radius: var(--base-size);
      box-shadow: 0 2px 8px var(--black-30);

      .chat-create-dialog__body {
        width: 100%;
        height: 100%;
      }
    }
  }

  .chat-create-dialog {
    &__top {
      position: relative;
      width: 100%;
      height: calc(var(--base-size) * 6);
      border-bottom: 1px solid var(--gray-50, #f2f2f2);
      display: flex;
      justify-content: center;
      align-items: flex-end;

      .chat-create-dialog__tabs {
        --tab-active-color: var(--blue-main, #0090ec);
        --tabs-indicator-background: var(--blue-main, #0090ec);

        width: 220px;
      }

      .chat-create-dialog__tab {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 110px;
        font-size: 14px;
        font-weight: 500;
      }
    }

    &__content {
      position: relative;
      width: 100%;
      height: calc(100% - var(--base-size) * 14);
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: stretch;
      padding: calc(var(--base-size) * 2) calc(var(--base-size) * 2) var(--base-size);

      &-header {
        margin-bottom: var(--base-size);
      }

      &-list {
        overflow-x: hidden;
        overflow-y: auto;
        flex-grow: 2;
      }
    }

    &__buttons {
      --button-primary-color: var(--blue-main, #0090ec);
      --button-normal-height: calc(var(--base-size) * 4);

      position: relative;
      width: 100%;
      height: calc(var(--base-size) * 8);
      border-top: 1px solid var(--gray-50, #f2f2f2);
      display: flex;
      justify-content: center;
      align-items: center;

      .ui3n-button {
        margin: 0 var(--half-size);
        font-weight: 500;
        text-transform: capitalize;
      }
    }

    &__selected {
      &-info {
        margin-top: var(--base-size);
        font-size: var(--font-10);
        font-weight: 500;
        color: var(--black-30, #b3b3b3);
      }

      &-body {
        margin-top: var(--base-size);
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-start;
        align-items: flex-start;

        .ui3n-chip {
          .ui3n-chip__body {
            display: inline-block;
            font-weight: 600;
            @include text-overflow-ellipsis(calc(100% - var(--base-size) * 3));
          }
        }
      }

      &-item {
        --font-size-sm: var(--font-10);
        --chip-text-small-margin: 0;
        --chip-small-padding: 0 var(--base-size);

        max-width: calc(var(--base-size) * 13);
        margin: 0 var(--half-size) var(--half-size) 0;
        padding-left: 0 !important;
      }
    }
  }
</style>
