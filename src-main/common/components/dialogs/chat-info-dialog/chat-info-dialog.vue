<!--
 Copyright (C) 2025 3NSoft Inc.

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
import { Ui3nButton, Ui3nChip, Ui3nIcon, Ui3nInput } from '@v1nt1248/3nclient-lib';
import { capitalize } from '@v1nt1248/3nclient-lib/utils';
import { getChatName } from '@main/common/utils/chat-ui.helper';
import type { ChatInfoDialogProps, ChatInfoDialogEmits } from './types';
import { useChatInfo } from './useChatInfo';
import ChatAvatar from '@main/common/components/chat/chat-avatar.vue';
import ContactList from '@main/common/components/contacts/contact-list.vue';
import ListItemMenu from './list-item-menu.vue';

const props = defineProps<ChatInfoDialogProps>();
const emits = defineEmits<ChatInfoDialogEmits>();

const {
  ownAddr,
  nonDeletableUsers,
  dialogWidth,
  userSearch,
  memberSearch,
  editMembersMode,
  listItemMenuProps,
  members,
  filteredMembers,
  allContacts,
  addBtnDisable,
  selectedUsers,
  isUserAdmin,
  isUserPending,
  openEditMode,
  selectUsers,
  openListItemMenu,
  closeListItemMenu,
  back,
  updateMembers,
  handleAction,
  closeDialog,
} = useChatInfo(props, emits);
</script>

<template>
  <div :class="$style.chatInfoDialog">
    <div :class="$style.chatInfoDialogBody">
      <template v-if="editMembersMode">
        <div :class="$style.chatInfoDialogContentTitle">
          <ui3n-icon
            icon="outline-people"
            width="24"
            height="24"
            color="var(--color-icon-block-primary-default)"
          />
          {{ $tr('chat.info.dialog.edit.members.btn') }}
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
            :contact-list="allContacts"
            :non-selectable-contacts="nonDeletableUsers"
            :search-text="userSearch"
            :without-anchor="true"
            :selected-contacts="selectedUsers"
            @select="selectUsers"
          />
        </div>
      </template>

      <template v-else>
        <div :class="$style.chatInfoDialogHeader">
          <chat-avatar
            :name="getChatName(props.chat)"
            size="64"
            :shape="chat.isGroupChat ? 'decagon' : 'circle'"
          />

          <div :class="$style.chatInfoDialogHeaderText">
            <span :class="$style.chatInfoDialogHeaderName">
              {{ getChatName(props.chat) }}
            </span>

            <span
              v-if="chat.isGroupChat"
              :class="$style.chatInfoDialogHeaderUser"
            >
              {{ members.length }} {{ $tr('chat.info.dialog.users') }}
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
              v-if="chat.isGroupChat && isUserAdmin(ownAddr)"
              type="secondary"
              size="small"
              :class="$style.chatInfoDialogContentTitleBtn"
              @click="openEditMode"
            >
              {{ $tr('chat.info.dialog.edit.members.btn') }}
            </ui3n-button>
          </div>

          <ui3n-input
            v-model="memberSearch"
            icon="round-search"
            clearable
            :class="$style.chatInfoDialogContentSearch"
            :placeholder="$tr('chat.info.dialog.search.input.placeholder')"
          />

          <div :class="[$style.chatInfoDialogUserList, isUserAdmin(ownAddr) && $style.pointer]">
            <contact-list
              :contact-list="filteredMembers"
              :without-anchor="true"
              :readonly="true"
              @click:right="openListItemMenu"
            >
              <template #extra="{ mail }">
                <ui3n-chip
                  v-if="chat.isGroupChat ? isUserPending(mail) || isUserAdmin(mail) : isUserPending(mail)"
                  height="20"
                  :round="false"
                  :color="isUserPending(mail) ? 'var(--warning-fill-default)' : 'var(--info-fill-default)'"
                  :text-color="isUserPending(mail) ? 'var(--warning-content-default)' : 'var(--info-content-default)'"
                  text-size="12"
                >
                  <template v-if="chat.isGroupChat">
                    {{ $tr(isUserPending(mail) ? 'chat.info.user.pending' : 'chat.info.user.admin') }}
                  </template>

                  <template v-else>
                    {{ $tr('chat.info.user.pending') }}
                  </template>
                </ui3n-chip>
              </template>
            </contact-list>

            <teleport
              v-if="listItemMenuProps.listItem"
              :to="`#${listItemMenuProps.listItemElId}`"
            >
              <list-item-menu
                :is-open="listItemMenuProps.open"
                :list-item="listItemMenuProps.listItem"
                @do="handleAction"
                @close="closeListItemMenu"
              />
            </teleport>
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
          @click="updateMembers"
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
  width: v-bind(dialogWidth);
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

.pointer {
  div[id] {
    cursor: pointer !important;
  }
}
</style>
