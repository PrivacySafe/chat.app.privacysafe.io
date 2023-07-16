<script lang="ts" setup>
  import { computed, inject, ref } from 'vue'
  import { useContactsStore, useChatsStore } from '@/store'
  import { readonlyContactIds } from '@/constants'
  import ChatAvatar from '@/components/chat/chat-avatar.vue'
  import ContactIcon from '@/components/contacts/contact-icon.vue'

  const { $tr } = inject<I18nPlugin>('i18n')!
  const emit = defineEmits(['select', 'confirm'])

  const searchText = ref('')
  const { contactList } = useContactsStore()
  const { namedChatList, currentChatId } = useChatsStore()
  
  const filteredContactList = computed(() => contactList
    .filter(c => ( c.displayName.toLowerCase().includes(searchText.value.toLowerCase())
      && !readonlyContactIds.includes(c.id) )))
  const filteredChatList = computed(() => namedChatList()
    .filter(c => ( c.displayName.toLowerCase().includes(searchText.value.toLowerCase())
      && c.chatId !== currentChatId )))

  const selectItem = ({ type, data }: { type: 'chat' | 'contact', data: string }) => {
    emit('select', { type, data })
    emit('confirm')
  }
</script>

<template>
  <div class="message-forward-dialog">
    <p-input
      v-model:value="searchText"
      icon="round-search"
      clearable
    />
    <div class="message-forward-dialog__body">
      <h4 class="message-forward-dialog__section-title">
        {{ $tr('chat.message.forward.dialog.chats.section.title') }}
      </h4>
      <template v-if="filteredChatList.length">
        <div
          v-for="chat in filteredChatList"
          :key="chat.chatId"
          class="message-forward-dialog__item"
          @click="selectItem({ type: 'chat', data: chat.chatId })"
        >
          <chat-avatar
            :name="chat.displayName"
            :shape="chat.members.length > 2 ? 'decagon' : 'circle'"
            :size="28"
          />
          <div class="message-forward-dialog__item-name">
            {{ chat.displayName }}
          </div>
        </div>
      </template>
      <template v-else>
        <div class="message-forward-dialog__empty">
          {{ $tr('chat.message.forward.dialog.chats.empty') }}
        </div>
      </template>

      <h4 class="message-forward-dialog__section-title">
        {{ $tr('chat.message.forward.dialog.contacts.section.title') }}
      </h4>
      <template v-if="filteredContactList.length">
        <div
          v-for="contact in filteredContactList"
          :key="contact.id"
          class="message-forward-dialog__item"
          @click="selectItem({ type: 'contact', data: contact.mail })"
        >
          <contact-icon
            :name="contact.displayName"
            :size="28"
            :readonly="true"
          />
          <div class="message-forward-dialog__item-name">
            {{ contact.displayName }}
          </div>
        </div>
      </template>
      <template v-else>
        <div class="message-forward-dialog__empty">
          {{ $tr('chat.message.forward.dialog.contacts.empty') }}
        </div>
      </template>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import "../../assets/styles/mixins";

  .message-forward-dialog {
    position: relative;
    max-height: 380px;

    .p-input {
      margin-bottom: calc(var(--base-size) * 2);
    }

    &__body {
      position: relative;
      max-height: calc(100% - calc(var(--base-size) * 7));
      overflow-y: auto;
      overflow-x: hidden;
    }

    &__section-title {
      font-size: var(--font-12);
      font-weight: 500;
      color: var(--system-black);
      margin: 0 0 var(--base-size);
    }

    &__item {
      position: relative;
      width: 100%;
      display: flex;
      justify-content: flex-start;
      align-items: center;
      height: calc(var(--base-size) * 5);
      cursor: pointer;

      &-name {
        position: relative;
        width: calc(100% - calc(var(--base-size) * 3.5));
        margin-left: var(--half-size);
        font-size: var(--font-12);
        font-weight: 500;
        color: var(--black-90);
        @include text-overflow-ellipsis();
      }

      &:hover {
        background-color: var(--blue-main-30, #b0dafc);
      }
    }

    &__empty {
      position: relative;
      width: 100%;
      text-align: center;
      font-size: var(--font-12);
      font-weight: 500;
      font-style: italic;
      color: var(--black-30);
      margin-bottom: var(--base-size);
    }
  }
</style>

<style lang="scss">
  .message-forward-dialog__wrapper {
    .var-dialog__actions {
      --p-dialog-padding: 0;
    }
  }
</style>
