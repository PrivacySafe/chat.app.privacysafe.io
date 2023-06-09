<script lang="ts" setup>
  import { ref, computed, watch, onBeforeMount } from 'vue'
  import { useRouter } from 'vue-router'
  import { get, keyBy } from 'lodash'
  import { useAppStore } from '@/store/app.store'
  import { useContactsStore } from '@/store/contacts.store'
  import { useChatsStore } from '@/store/chats.store'
  import { Icon } from '@iconify/vue'
  import PField from '@/components/p-field.vue'
  import ContactList from '@/components/contact-list.vue'
  import ContactIcon from '@/components/contact-icon.vue'


  const router = useRouter()

  onBeforeMount(async () => {
    await contactsStore.fetchContactList()
  })

  const props = defineProps<{
    withoutOverlay?: boolean
  }>()
  const emit = defineEmits(['close'])
  const appStore = useAppStore()
  const contactsStore = useContactsStore()
  const chatsStore = useChatsStore()

  const tabs = ref({
    items: [
      { name: 'Chat', id: 'chat' },
      { name: 'Group Chat', id: 'group' },
    ],
    current: 0,
  })
  const searchText = ref<string>('')
  const selectedContacts = ref<string[]>([])
  const multipleModeStep = ref(1)
  const groupChatName = ref('')

  const selectedChatType = computed<string>(() => tabs.value.items[tabs.value.current].id)
  const nonSelectableContacts = computed<string[]>(() => contactsStore.contactList
    .reduce((res, contact) => {
      if (contact.mail === appStore.user) {
        res.push(contact.id)
      }
      return res
    }, [] as string[])
  )
  const contacts = computed<Record<string, PersonView & { displayName: string }>>(() => keyBy(contactsStore.contactList, 'id'))
  const selectedContactList = computed<Array<PersonView & { displayName: string }>>(() => contactsStore.contactList
    .filter(c => selectedContacts.value.includes(c.id)))

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

  const selectContacts = async (contactId: string) => {
    if (selectedChatType.value === 'chat') {
      selectedContacts.value = [contactId]
      const person = get(contacts.value, [contactId, 'mail'])
      const members = [appStore.user, person]
      const chatId = await chatsStore.createChat({ members, name: person })
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

  const getContact = (contactId: string): PersonView & { displayName: string } => {
    return get(contacts.value, contactId)
  }

  const onFirstBtnClick = () => {
    if (
      selectedChatType.value === 'chat'
      || (selectedChatType.value === 'group' && multipleModeStep.value === 1)
    ) {
      emit('close')
    } else {
      multipleModeStep.value = 1
    }
  }

  const onSecondBtnClick = async () => {
    if (multipleModeStep.value === 1) {
      multipleModeStep.value = 2
    } else {
      const members = [
        appStore.user,
        ...selectedContacts.value.map(contactId => get(contacts.value, [contactId, 'mail'])),
      ]
      const chatId = await chatsStore.createChat({ members, name: groupChatName.value.trim() })
      closeDialog(chatId)
    }
  }

  const closeDialog = (chatId?: string) => {
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
        <var-tabs
          v-model:active="tabs.current"
          class="chat-create-dialog__tabs"
        >
          <var-tab
            v-for="item in tabs.items"
            :key="item.id"
          >
            {{ item.name }}
          </var-tab>
        </var-tabs>
      </div>

      <div
        v-if="multipleModeStep === 1"
        class="chat-create-dialog__content"
      >
        <div class="chat-create-dialog__content-header">
          <p-field
            v-if="multipleModeStep === 1"
            v-model:text="searchText"
            clearable
            class="chat-create-dialog__content-search"
          >
            <template #prepend-icon>
              <icon
                icon="round-search"
                width="16"
                height="16"
                color="#b3b3b3"
              />
            </template>
          </p-field>

          <template v-if="selectedChatType === 'group' && multipleModeStep === 1">
            <div class="chat-create-dialog__selected-info">
              {{ $tr('chat.create.dialog.selected.contacts') }}:
              {{ selectedContacts.length }}/{{ Object.values(contactsStore.contactList).length }}
            </div>

            <div
              v-if="selectedContacts.length"
              class="chat-create-dialog__selected-body"
            >
              <var-chip
                v-for="contactId in selectedContacts"
                :key="contactId"
                size="small"
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
              </var-chip>
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
          />
        </div>
      </div>

      <div
        v-else
        class="chat-create-dialog__content"
      >
        <div class="chat-create-dialog__content-header">
          <p-field
            v-model:text="groupChatName"
            label="Group Name"
            clearable
            class="chat-create-dialog__content-search"
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

      <div class="chat-create-dialog__bottom">
        <var-button
          text
          type="primary"
          class="chats__aside-close-btn"
          @click="onFirstBtnClick"
        >
          {{ multipleModeStep === 1 ? 'Close' : 'Back' }}
        </var-button>

        <var-button
          v-if="selectedChatType === 'group'"
          type="primary"
          :disabled="!selectedContacts.length || (multipleModeStep === 2 && !groupChatName)"
          class="chats__aside-next-btn"
          @click="onSecondBtnClick"
        >
          {{ multipleModeStep === 1 ? 'Next' : 'Create' }}
        </var-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
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

        .var-tab {
          font-weight: 500;
        }
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

    &__bottom {
      --button-primary-color: var(--blue-main, #0090ec);
      --button-normal-height: calc(var(--base-size) * 4);

      position: relative;
      width: 100%;
      height: calc(var(--base-size) * 8);
      border-top: 1px solid var(--gray-50, #f2f2f2);
      display: flex;
      justify-content: center;
      align-items: center;

      .var-button {
        margin: 0 var(--half-size);
        font-weight: 500;
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

        .var-chip {
          &__text-small {
            display: inline-block;
            padding-left: var(--half-size);
            width: calc(100% - var(--base-size) * 3);
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
          }
        }
      }

      &-item {
        --font-size-sm: var(--font-10);
        --chip-text-small-margin: 0;
        --chip-small-padding: 0 var(--base-size);

        max-width: calc(var(--base-size) * 13);
        margin: 0 var(--half-size) var(--half-size) 0;
        font-weight: 600;
        padding-left: 0;
      }
    }
  }
</style>
