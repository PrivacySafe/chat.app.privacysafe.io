<script lang="ts" setup>
  import { computed } from 'vue'
  import { mailReg } from '@v1nt1248/3nclient-lib'
  import ContactListItem from '@/components/contacts/contact-list-item.vue'

  const props = defineProps<{
    contactList: Array<PersonView & { displayName: string }>;
    searchText?: string;
    selectedContacts?: string[];
    nonSelectableContacts?: string[];
    withoutAnchor?: boolean;
    readonly?: boolean;
  }>()
  const emit = defineEmits(['select', 'add:new'])

  const contactListProps = computed(() => {
    const {
      contactList = [],
      searchText = '',
      selectedContacts = [],
      nonSelectableContacts = [],
      withoutAnchor = false,
      readonly = false,
    } = props
    return { contactList, searchText, selectedContacts, nonSelectableContacts, withoutAnchor, readonly }
  })

  const contactListByLetters = computed<Record<string, Array<PersonView & { displayName: string }>>>(() => {
    return contactListProps.value.contactList
      .filter(c => c.displayName.toLocaleLowerCase().includes(contactListProps.value.searchText.toLocaleLowerCase()))
      .reduce((res, item) => {
        const letter = contactListProps.value.withoutAnchor ? 'one' : item.displayName[0].toUpperCase()
        if (!res[letter]) {
          res[letter] = []
        }

        res[letter].push(item)
        return res
      }, {} as Record<string, Array<PersonView & { displayName: string }>>)
  })

  const isMailValid = computed<boolean>(() => mailReg.test(props.searchText || ''))

  const selectContact = (contactId: string) => {
    emit('select', contactId)
  }

  const addNewContact = (ev: Event) => {
    ev.stopPropagation()
    ev.preventDefault()
    if (isMailValid.value) {
      emit('add:new', props.searchText as string)
    }
  }
</script>

<template>
  <div class="contact-list">
    <div
      v-if="Object.keys(contactListByLetters).length"
      class="contact-list__content"
    >
      <div
        v-for="(letter, index) in Object.keys(contactListByLetters)"
        :key="letter"
        class="contact-list__content-sublist"
        :class="{ 'contact-list__content-sublist--last': index === Object.keys(contactListByLetters).length -1 }"
      >
        <div
          v-if="letter !== 'one'"
          class="contact-list__content-sublist-title"
        >
          {{ letter }}
        </div>

        <contact-list-item
          v-for="contact in contactListByLetters[letter]"
          :key="contact.id"
          :contact="contact"
          :selected="contactListProps.selectedContacts.includes(contact.id)"
          :without-anchor="contactListProps.withoutAnchor"
          :readonly="contactListProps.readonly || (nonSelectableContacts || []).includes(contact.id)"
          @click="selectContact"
        />
      </div>
    </div>

    <div
      v-else
      class="contact-list__content-info"
    >
      <h4
        class="contact-list__add-btn"
        v-on="!isMailValid ? {} : { click: (ev: Event) => addNewContact(ev) }"
      >
        Add {{ props.searchText }}
      </h4>
    </div>
  </div>
</template>

<style lang="scss">
  .contact-list {
    position: relative;
    width: 100%;

    &__content {
      &-sublist {
        padding: calc(var(--base-size) / 2) 0;

        &-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--blue-main, #0090ec);
          line-height: 1;
          margin-bottom: calc(var(--base-size) / 2);
        }
      }

      &-info {
        text-align: center;
        font-size: var(--font-14);
        line-height: var(--font-24);
        color: var(--gray-90, #444);
      }
    }

    &__add-btn {
      --link-primary-color: var(--blue-main);

      text-decoration: none;
      font-size: var(--font-12);
      font-weight: 500;
    }
  }
</style>
