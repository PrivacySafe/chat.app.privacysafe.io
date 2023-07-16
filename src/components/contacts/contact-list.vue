<script lang="ts" setup>
  import { computed } from 'vue'
  import ContactListItem from '@/components/contacts/contact-list-item.vue'

  const props = defineProps<{
    contactList: Array<PersonView & { displayName: string }>;
    searchText?: string;
    selectedContacts?: string[];
    nonSelectableContacts?: string[];
    withoutAnchor?: boolean;
    readonly?: boolean;
  }>()
  const emit = defineEmits(['select'])

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

  const selectContact = (contactId: string) => {
    emit('select', contactId)
  }
</script>

<template>
  <div class="contact-list">
    <var-index-bar
      v-if="Object.keys(contactListByLetters).length"
      class="contact-list__content"
      duration="200"
      hide-list
      css-mode
    >
      <div
        v-for="(letter, index) in Object.keys(contactListByLetters)"
        :key="letter"
        class="contact-list__content-sublist"
        :class="{ 'contact-list__content-sublist--last': index === Object.keys(contactListByLetters).length -1 }"
      >
        <var-index-anchor
          v-if="letter !== 'one'"
          :index="letter"
        >
          {{ letter }}
        </var-index-anchor>

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
    </var-index-bar>

    <div
      v-else
      class="contact-list__content-info"
    >
      {{ $tr('contacts.list.empty') }}
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

        .var-sticky {
          padding-left: 2px;
          width: calc(var(--base-size) * 2.5);
          text-align: center;
          margin-bottom: calc(var(--base-size) / 2);
        }

        .var-index-anchor {
          font-size: 14px;
          font-weight: 600;
          color: var(--blue-main, #0090ec);
          line-height: 1;
        }
      }

      &-info {
        text-align: center;
        font-size: var(--font-14);
        line-height: var(--font-24);
        color: var(--gray-90, #444);
      }
    }
  }
</style>
