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
  import { computed, inject, ref, toRefs } from 'vue'
  import { cloneDeep, isEqual, size } from 'lodash'
  import { useAppStore, useContactsStore, useChatsStore } from '../../store'
  import { getChatName } from '../../helpers/chat-ui.helper'
  import { I18nPlugin, I18N_KEY, Ui3nButton, Ui3nIcon, Ui3nInput } from '@v1nt1248/3nclient-lib'
  import ChatAvatar from '../chat/chat-avatar.vue'
  import ContactList from '../contacts/contact-list.vue'

  const props = defineProps<{
    chat: ChatView & { unread: number } & ChatMessageView<MessageType>;
  }>()

  const emit = defineEmits(['close'])

  const { $tr } = inject<I18nPlugin>(I18N_KEY)!
  const { contactList: allContact } = toRefs((useContactsStore()))
  const { user } = toRefs(useAppStore())
  const { updateMembers } = useChatsStore()
  const nonSelectableUserMails = ['support@3nweb.com']

  const showAvatar = ref(true)
  const editMembersMode = ref(false)
  const memberSearch = ref('')
  const userSearch = ref('')
  const initialSelectedUsers = ref<string[]>([])
  const selectedUsers = ref<string[]>([])
  const nonSelectableUsers = computed<string[]>(
    () => allContact.value
      .filter(c => nonSelectableUserMails.includes(c.mail))
      .map(c => c.id)
  )
  const isGroupChat = computed<boolean>(() => size(props.chat.members) > 2)
  const isUserAdmin = computed(() => props.chat.admins.includes(user.value))
  const members = computed<Array<PersonView & { displayName: string }>>(
    () => allContact.value.filter(c => props.chat.members.includes(c.mail))
  )
  const filteredMembers = computed(
    () => members.value
      .filter(m => m.displayName.toLowerCase().includes(memberSearch.value.toLowerCase()))
  )
  const addBtnDisable = computed(() => isEqual(
    initialSelectedUsers.value.slice().sort(),
    selectedUsers.value.slice().sort(),
  ))

  const closeDialog = () => emit('close')

  const openEditMode = () => {
    showAvatar.value = false
    editMembersMode.value = true
    userSearch.value = memberSearch.value
    selectedUsers.value = cloneDeep(members.value.map(m => m.id))
    initialSelectedUsers.value = cloneDeep(selectedUsers.value)
  }

  const back = () => {
    if (showAvatar.value) {
      return
    }

    if (!editMembersMode.value) {
      showAvatar.value = true
    } else {
      editMembersMode.value = false
      showAvatar.value = true
      userSearch.value = ''
    }
  }

  const selectUsers = (userId: string) => {
    const userIndex = selectedUsers.value.indexOf(userId)
    if (userIndex === -1) {
      selectedUsers.value.push(userId)
    } else {
      selectedUsers.value.splice(userIndex, 1)
    }
  }

  const _updateMembers = () => {
    const updatedMembers = allContact.value.reduce((res, c) => {
      const { id, mail } = c
      if (selectedUsers.value.includes(id)) {
        res.push(mail)
      }
      return res
    }, [] as string[])
    updateMembers(props.chat, updatedMembers)
    closeDialog()
  }
</script>

<template>
  <div class="chat-info-dialog">
    <div class="chat-info-dialog__title">
      {{ $tr('chat.info.dialog.title') }}

      <ui3n-button
        round
        color="transparent"
        icon="close"
        icon-size="16"
        icon-color="#828282"
        @click="closeDialog"
      />
    </div>

    <div
      :class="[
        'chat-info-dialog__content',
        { 'chat-info-dialog__content--without-avatar': !showAvatar },
      ]"
    >
      <template v-if="!editMembersMode">
        <div
          v-if="showAvatar"
          class="chat-info-dialog__info"
        >
          <chat-avatar
            :name="getChatName(props.chat)"
            size="64"
            :shape="isGroupChat ? 'decagon' : 'circle'"
          />

          <div class="chat-info-dialog__info-content">
            <span class="chat-info-dialog__name">
              {{ getChatName(props.chat) }}
            </span>

            <span class="chat-info-dialog__text">
              {{ props.chat.members.length }} {{ $tr('chat.info.dialog.users') }}
            </span>
          </div>
        </div>

        <div class="chat-info-dialog__body">
          <div class="chat-info-dialog__users">
            <div class="chat-info-dialog__users-toolbar">
              <div class="chat-info-dialog__users-title">
                <ui3n-icon
                  icon="account-circle"
                  width="20"
                  height="20"
                  color="var(--black-90)"
                />
                {{ $tr('chat.info.dialog.users') }}
              </div>
              <ui3n-button
                v-if="isUserAdmin"
                color="transparent"
                text-color="var(--blue-main, #0090ec)"
                @click="openEditMode"
              >
                {{ $tr('chat.info.dialog.update.members.btn.text') }}
              </ui3n-button>
            </div>
            <ui3n-input
              v-model:value="memberSearch"
              icon="search"
              clearable
              :placeholder="$tr('chat.info.dialog.search.input.placeholder')"
              @focus="showAvatar = false"
            />
            <div class="chat-info-dialog__users-list">
              <contact-list
                :contact-list="filteredMembers"
                :without-anchor="true"
                :readonly="true"
              />
            </div>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="chat-info-dialog__body">
          <div class="chat-info-dialog__users">
            <div class="chat-info-dialog__users-toolbar">
              <div class="chat-info-dialog__users-title">
                <ui3n-icon
                  icon="person"
                  width="20"
                  height="20"
                  color="var(--black-90)"
                />
                {{ $tr('chat.info.dialog.update.members.btn.text') }}
              </div>
            </div>
            <ui3n-input
              v-model:value="userSearch"
              icon="round-search"
              clearable
              :placeholder="$tr('chat.info.dialog.search.input.placeholder')"
              @focus="showAvatar = false"
            />

            <div class="chat-info-dialog__users-list">
              <contact-list
                :contact-list="allContact"
                :search-text="userSearch"
                :without-anchor="true"
                :selected-contacts="selectedUsers"
                :non-selectable-contacts="nonSelectableUsers"
                @select="selectUsers"
              />
            </div>
          </div>
        </div>
      </template>
    </div>

    <div class="chat-info-dialog__actions">
      <ui3n-button
        color="transparent"
        text-color="var(--blue-main, #0090ec)"
        :class="{ 'chat-info-dialog__btn--hidden' : showAvatar }"
        @click="back"
      >
        {{ $tr('chat.info.dialog.btn.back.text') }}
      </ui3n-button>

      <ui3n-button
        v-if="!editMembersMode"
        color="transparent"
        text-color="var(--blue-main, #0090ec)"
        @click="closeDialog"
      >
        {{ $tr('chat.info.dialog.btn.close.text') }}
      </ui3n-button>

      <ui3n-button
        v-else
        :disabled="addBtnDisable"
        @click="_updateMembers"
      >
        {{ $tr('chat.info.dialog.btn.update.text') }}
      </ui3n-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import "../../assets/styles/mixins";

  .chat-info-dialog {
    --button-mini-font-size: var(--font-12);
    --button-primary-color: var(--blue-main);

    position: relative;
    width: calc(var(--column-size) * 4);
    height: calc(var(--column-size) * 5);
    background-color: var(--system-white);
    border-radius: var(--base-size);

    &__title {
      display: flex;
      width: 100%;
      justify-content: flex-start;
      align-items: center;
      padding:
        calc(var(--base-size) * 2)
        calc(var(--base-size) * 3)
        calc(var(--base-size) * 2 - 1px)
        calc(var(--base-size) * 2);
      font-size: var(--font-13);
      font-weight: 600;
      color: var(--black-90);
      line-height: var(--font-16);
      border-bottom: 1px solid var(--gray-50);

      .ui3n-button {
        position: absolute;
        right: var(--half-size);
        padding: 2px;
      }
    }

    &__content {
      position: relative;
      width: 100%;
      height: calc(100% - calc(var(--base-size) * 13) - var(--half-size));
      margin-bottom: var(--half-size);

      &--without-avatar {
        .chat-info-dialog__body {
          height: 100%;
        }
      }
    }

    &__info {
      position: relative;
      width: 100%;
      height: calc(var(--base-size) * 12);
      display: flex;
      justify-content: flex-start;
      align-items: center;
      padding: calc(var(--base-size) * 2);
      border-bottom: 1px solid var(--gray-50);

      &-content {
        position: relative;
        margin-left: var(--base-size);
      }
    }

    &__name {
      display: block;
      font-size: var(--font-14);
      line-height: var(--font-24);
      font-weight: 500;
      color: var(--black-90);
    }

    &__text {
      display: block;
      font-size: var(--font-11);
      line-height: var(--font-16);
      font-weight: 500;
      color: var(--black-30);
    }

    &__body {
      position: relative;
      width: 100%;
      height: calc(100% - var(--base-size) * 12);
      padding: calc(var(--base-size) * 2) calc(var(--base-size) * 2) var(--base-size);
    }

    &__users {
      position: relative;
      width: 100%;
      height: 100%;

      &-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--base-size);
      }

      &-title {
        display: flex;
        justify-content: flex-start;
        align-items: center;
        margin-right: var(--half-size);
        font-size: var(--font-14);
        font-weight: 500;
        color: var(--black-90);
        text-transform: capitalize;

        .iconify {
          margin-right: 5px;
        }
      }

      &-list {
        position: relative;
        width: 100%;
        margin-top: var(--half-size);
        height: calc(100% - var(--base-size) * 8 - var(--half-size));
        overflow-y: auto;
      }
    }

    &__actions {
      position: relative;
      display: flex;
      width: 100%;
      height: calc(var(--base-size) * 7 - 1px);
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--gray-50);
      padding: 0 calc(var(--base-size) * 2);

      .ui3n-button {
        text-transform: capitalize;
      }
    }

    &__btn {
      &--hidden {
        pointer-events: none;
        opacity: 0;
        cursor: default;
      }
    }
  }
</style>
