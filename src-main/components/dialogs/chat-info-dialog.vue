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
import { computed, inject, ref } from 'vue';
import { storeToRefs } from 'pinia';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import size from 'lodash/size';
import { I18nPlugin, I18N_KEY } from '@v1nt1248/3nclient-lib/plugins';
import { Ui3nButton, Ui3nIcon, Ui3nInput } from '@v1nt1248/3nclient-lib';
import { capitalize } from '@v1nt1248/3nclient-lib/utils';
import { getChatName } from '@main/helpers/chat-ui.helper';
import type { ChatView, ChatMessageView, MessageType, PersonView } from '~/index';
import ChatAvatar from '../chat/chat-avatar.vue';
import ContactList from '../contacts/contact-list.vue';
import { updateMembers } from '@main/ctrl-funcs';
import { useChatsStore } from '@main/store/chats';
import { useAppStore } from '@main/store/app';
import { useContactsStore } from '@main/store/contacts';

const props = defineProps<{
  chat: ChatView & { unread: number } & ChatMessageView<MessageType>;
}>();

const emit = defineEmits(['close']);

const { $tr } = inject<I18nPlugin>(I18N_KEY)!;

const { contactList: allContact } = storeToRefs((useContactsStore()));
const { user } = storeToRefs(useAppStore());
const chatsStore = useChatsStore();

const nonSelectableUserMails = ['support@3nweb.com'];

const editMembersMode = ref(false);
const memberSearch = ref('');
const userSearch = ref('');
const initialSelectedUsers = ref<string[]>([]);
const selectedUsers = ref<string[]>([]);

const nonSelectableUsers = computed<string[]>(
  () => allContact.value
    .filter(c => nonSelectableUserMails.includes(c.mail))
    .map(c => c.id),
);
const isGroupChat = computed<boolean>(() => size(props.chat.members) > 2);

const isUserAdmin = computed(() => props.chat.admins.includes(user.value));

const members = computed<Array<PersonView & { displayName: string }>>(
  () => allContact.value.filter(c => props.chat.members.includes(c.mail)),
);

const filteredMembers = computed(
  () => members.value
    .filter(m => m.displayName.toLowerCase().includes(memberSearch.value.toLowerCase())),
);

const addBtnDisable = computed(() => isEqual(
  initialSelectedUsers.value.slice().sort(),
  selectedUsers.value.slice().sort(),
));

function closeDialog() {
  emit('close');
}

function openEditMode() {
  editMembersMode.value = true;
  userSearch.value = memberSearch.value;
  selectedUsers.value = cloneDeep(members.value.map(m => m.id));
  initialSelectedUsers.value = cloneDeep(selectedUsers.value);
}

function back() {
  editMembersMode.value = false;
  userSearch.value = '';
}

function selectUsers(userId: string) {
  const userIndex = selectedUsers.value.indexOf(userId);
  if (userIndex === -1) {
    selectedUsers.value.push(userId);
  } else {
    selectedUsers.value.splice(userIndex, 1);
  }
}

function _updateMembers() {
  const updatedMembers = allContact.value.reduce((res, c) => {
    const { id, mail } = c;
    if (selectedUsers.value.includes(id)) {
      res.push(mail);
    }
    return res;
  }, [] as string[]);
  updateMembers(chatsStore, props.chat, updatedMembers);
  closeDialog();
}
</script>

<template>
  <div :class="$style.chatInfoDialog">
    <div :class="$style.chatInfoDialogBody">
      <template v-if="editMembersMode">
        <div :class="$style.chatInfoDialogContentTitle">
          <ui3n-icon
            icon="outline-person-add"
            width="24"
            height="24"
            color="var(--color-icon-block-primary-default)"
          />
          {{ $tr('chat.info.dialog.add.members.btn') }}
        </div>

        <ui3n-input
          v-model="userSearch"
          icon="round-search"
          clearable
          :class="$style.chatInfoDialogContentSearch"
          :placeholder="$tr('chat.info.dialog.search.input.placeholder')"
        />

        <div :class="$style.chatInfoDialogUserList">
          <contact-list
            :contact-list="allContact"
            :search-text="userSearch"
            :without-anchor="true"
            :selected-contacts="selectedUsers"
            :non-selectable-contacts="nonSelectableUsers"
            @select="selectUsers"
          />
        </div>
      </template>

      <template v-else>
        <div :class="$style.chatInfoDialogHeader">
          <chat-avatar
            :name="getChatName(props.chat)"
            size="64"
            :shape="isGroupChat ? 'decagon' : 'circle'"
          />

          <div :class="$style.chatInfoDialogHeaderText">
            <span :class="$style.chatInfoDialogHeaderName">
              {{ getChatName(props.chat) }}
            </span>

            <span :class="$style.chatInfoDialogHeaderUser">
              {{ props.chat.members.length }} {{ $tr('chat.info.dialog.users') }}
            </span>
          </div>
        </div>

        <div :class="$style.chatInfoDialogContent">
          <div :class="$style.chatInfoDialogContentTitle">
            <ui3n-icon
              icon="outline-account-circle"
              width="24"
              height="24"
              color="var(--color-icon-block-primary-default)"
            />
            {{ $tr('chat.info.dialog.users') }}

            <ui3n-button
              v-if="isUserAdmin"
              type="secondary"
              size="small"
              :class="$style.chatInfoDialogContentTitleBtn"
              @click="openEditMode"
            >
              {{ $tr('chat.info.dialog.add.members.btn') }}
            </ui3n-button>
          </div>

          <ui3n-input
            v-model="memberSearch"
            icon="round-search"
            clearable
            :class="$style.chatInfoDialogContentSearch"
            :placeholder="$tr('chat.info.dialog.search.input.placeholder')"
          />

          <div :class="$style.chatInfoDialogUserList">
            <contact-list
              :contact-list="filteredMembers"
              :without-anchor="true"
              :readonly="true"
            />
          </div>
        </div>
      </template>
    </div>

    <div :class="$style.chatInfoDialogActions">
      <template v-if="editMembersMode">
        <ui3n-button
          type="secondary"
          @click="back"
        >
          {{ $tr('chat.info.dialog.btn.back.text') }}
        </ui3n-button>

        <ui3n-button
          :disabled="addBtnDisable"
          @click="_updateMembers"
        >
          {{ $tr('chat.info.dialog.btn.update.text') }}
        </ui3n-button>
      </template>

      <template v-else>
        <span />

        <ui3n-button
          type="secondary"
          @click="closeDialog"
        >
          {{ capitalize($tr('chat.info.dialog.btn.close.text')) }}
        </ui3n-button>
      </template>
    </div>
  </div>
</template>

<style lang="scss" module>
.chatInfoDialog {
  --chat-info-dialog-header-height: 128px;
  --chat-info-dialog-actions-height: 64px;

  position: relative;
  width: calc(var(--column-size) * 4);
  height: calc(var(--column-size) * 5);
  background-color: var(--color-bg-block-primary-default);
  border-radius: var(--spacing-s);
}

.chatInfoDialogBody {
  position: relative;
  width: 100%;
  height: calc(100% - var(--chat-info-dialog-actions-height));
  overflow: hidden;
}

.chatInfoDialogActions {
  position: relative;
  width: 100%;
  height: var(--chat-info-dialog-actions-height);
  padding: 0 var(--spacing-m);
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid var(--color-border-block-primary-default);

  button {
    text-transform: capitalize;
  }
}

.chatInfoDialogHeader {
  position: relative;
  width: 100%;
  height: var(--chat-info-dialog-header-height);
  padding: 0 var(--spacing-m);
  display: flex;
  justify-content: flex-start;
  align-items: center;
  column-gap: var(--spacing-s);
  border-bottom: 1px solid var(--color-border-block-primary-default);
}

.chatInfoDialogHeaderText {
  position: relative;
  flex-grow: 1;
}

.chatInfoDialogHeaderName {
  display: block;
  font-size: var(--font-14);
  line-height: var(--font-24);
  font-weight: 500;
  color: var(--color-text-control-primary-default);
}

.chatInfoDialogHeaderUser {
  display: block;
  font-size: var(--font-11);
  line-height: var(--font-16);
  font-weight: 500;
  color: var(--color-text-control-secondary-default);
}

.chatInfoDialogContent {
  position: relative;
  width: 100%;
  height: calc(100% - var(--chat-info-dialog-header-height));
}

.chatInfoDialogContentTitle {
  position: relative;
  width: 100%;
  padding: var(--spacing-m);
  display: flex;
  justify-content: flex-start;
  align-items: center;
  column-gap: var(--spacing-xs);
  font-size: var(--font-16);
  font-weight: 500;
  color: var(--color-text-block-primary-default);
  text-transform: capitalize;
}

.chatInfoDialogContentTitleBtn {
  position: absolute;
  right: var(--spacing-m);
}

.chatInfoDialogContentSearch {
  width: calc(100% - var(--spacing-l));
  margin: 0 auto var(--spacing-m);
}

.chatInfoDialogUserList {
  position: relative;
  width: 100%;
  padding: 0 var(--spacing-m);
  height: calc(100% - 112px);
  overflow-y: auto;
}
</style>
