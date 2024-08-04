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
  import { computed, onBeforeMount } from 'vue'
  import { useRouter } from 'vue-router'
  import { Ui3nButton } from '@v1nt1248/3nclient-lib'
  import { useContactsStore, useChatsStore } from '../../store'
  import ChatCreateDialog from '../dialogs/chat-create-dialog.vue'
  import ChatList from './chat-list.vue'
  import { useSharedRef } from '../../router'

  const router = useRouter()
  const contactsStore = useContactsStore()
  const chatsStore = useChatsStore()

  const isCreateDialogOpen = useSharedRef('newChatDialogFlag')
  const incomingCalls = useSharedRef('incomingCalls')
  const haveIncomingCalls = computed(() => (incomingCalls.value.length > 0))

  function addNewChat() {
    isCreateDialogOpen.value = true
  }

  async function closeNewChatDialog(chatId?: string) {
    isCreateDialogOpen.value = false
    if (chatId) {
      await contactsStore.fetchContactList()
      await router.push(`/chats/${chatId}`)
    } else {
      await router.push('/chats')
      chatsStore.getChat(null)
    }
  }

  function dismissAllIncomingCalls() {
    incomingCalls.value = []
  }

  onBeforeMount(async () => {
    await contactsStore.fetchContactList()
  })
</script>

<template>
  <div class="chats">
    <div class="chats__aside">
      <div class="chats__aside-toolbar">
        <ui3n-button
          class="chats__aside-add-btn"
          @click="addNewChat"
        >
          {{ $tr('btn.text.new') }}
        </ui3n-button>
      </div>
      <chat-list
        class="chats__aside-list"
      />
    </div>

    <div class="chats__content">
      <router-view v-slot="{ Component }">
        <transition>
          <component
            :is="Component"
            v-if="Component"
          />

          <div
            v-else
            class="chats__content--empty"
          >
            {{ $tr('chat.content.empty') }}
          </div>
        </transition>
      </router-view>
    </div>

    <teleport to="#main">
      <chat-create-dialog
        v-if="isCreateDialogOpen"
        @close="closeNewChatDialog"
      />
    </teleport>
    <teleport to="#main">
      <incoming-call-dialog
        v-if="haveIncomingCalls"
        @close="dismissAllIncomingCalls"
      />
    </teleport>
  </div>
</template>

<style lang="scss">
  .chats__aside-filter-item {
    font-size: 13px;
  }
</style>

<style lang="scss" scoped>
  .chats {
    --chats-aside-width: calc(var(--column-size) * 4);

    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: space-between;
    align-items: stretch;

    &__aside {
      position: relative;
      width: var(--chats-aside-width);
      border-right: 1px solid var(--gray-50, #f2f2f2);

      &-toolbar {
        --button-normal-height: calc(var(--base-size) * 4);
        --button-primary-color: var(--blue-main, #0090ec);
        --font-size-md: 12px;

        position: relative;
        width: 100%;
        height: calc(var(--base-size) * 8);
        display: flex;
        justify-content: flex-start;
        align-items: center;
        padding: 0 calc(var(--base-size) * 2);
      }

      &-add-btn {
        width: calc(var(--base-size) * 7.5);
        font-weight: 600;
        margin-right: var(--base-size);
        text-transform: capitalize;
      }

      &-filter {
        --select-select-padding: 5px 0 5px 5px;

        width: 120px;
        font-size: var(--font-13);
        line-height: var(--font-16);
        background-color: var(--gray-50, #f2f2f2);
        border-radius: 4px;

        :deep(.var-select__line) {
          display: none;
        }
      }

      &-list {
        position: relative;
        height: calc(100% - var(--base-size) * 8);
      }
    }

    &__content {
      position: relative;
      width: calc(100% - var(--chats-aside-width));
      height: 100%;

      &--empty {
        display: flex;
        width: 100%;
        height: 100%;
        justify-content: center;
        align-items: center;
        background-color: var(--blue-main-20);
        font-size: var(--font-14);
        font-style: italic;
        font-weight: 400;
        color: var(--black-90);
      }
    }
  }
</style>
