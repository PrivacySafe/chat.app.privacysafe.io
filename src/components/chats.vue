<script lang="ts" setup>
  import { onBeforeMount, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAppStore } from '@/store/app.store'
  import { useContactsStore } from '@/store/contacts.store'
  import { useChatsStore } from '@/store/chats.store'
  import ChatCreateDialog from '@/components/chat-create-dialog.vue'
  import ChatList from '@/components/chat-list.vue'

  const router = useRouter()
  const appStore = useAppStore()
  const contactsStore = useContactsStore()
  const chatsStore = useChatsStore()

  const searchText = ref<string>('')
  const timeFilter = ref<string>('All Chats')
  const isCreateDialogOpen = ref(false)

  const addNewChat = () => {
    isCreateDialogOpen.value = true
  }

  const closeDialog = async (chatId?: string) => {
    isCreateDialogOpen.value = false
    if (chatId) {
      await router.push(`/chats/${chatId}`)
    } else {
      await router.push('/chats')
      chatsStore.getChat(null)
    }
  }

  onBeforeMount(async () => {
    await contactsStore.fetchContactList()
  })
</script>

<template>
  <div class="chats">
    <div class="chats__aside">
      <div class="chats__aside-toolbar">
        <var-button
          type="primary"
          class="chats__aside-add-btn"
          @click="addNewChat"
        >
          New
        </var-button>
      </div>
      <chat-list
        class="chats__aside-list"
      />
    </div>

    <var-snackbar
      v-model:show="appStore.snackbarOptions.show"
      :type="appStore.snackbarOptions.type"
      :content="appStore.snackbarOptions.content"
      teleport="body"
      :duration="1500"
    />

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
        @close="closeDialog"
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
