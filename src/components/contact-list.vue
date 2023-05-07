<script lang="ts" setup>
  import { computed, withDefaults } from 'vue'
  import ContactIcon from '@/components/contact-icon.vue'

  const props = withDefaults(defineProps<{
    contactList: Array<PersonView & { displayName: string }>;
    searchText?: string;
    selectedContacts?: string[];
    nonSelectableContacts?: string[];
    withoutAnchor?: boolean;
    readonly?: boolean;
  }>(), {
    contactList: () => [],
    searchText: '',
    selectedContacts: () => [],
    nonSelectableContacts: () => [],
    withoutAnchor: false,
    readonly: false,
  })
  const emit = defineEmits(['select'])

  const contactListByLetters = computed<Record<string, Array<PersonView & { displayName: string }>>>(() => {
    return props.contactList
      .filter(c => c.displayName.toLocaleLowerCase().includes(props.searchText.toLocaleLowerCase()))
      .reduce((res, item) => {
        const letter = props.withoutAnchor ? 'one' : item.displayName[0].toUpperCase()
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

        <div
          v-for="contact in contactListByLetters[letter]"
          :key="contact.id"
          :class="[
            'contact-list__content-item',
            {
              'contact-list__content-item--readonly': props.readonly || nonSelectableContacts.includes(contact.id),
              'contact-list__content-item--without-anchor': props.withoutAnchor,
            },
          ]"
          v-on="readonly || nonSelectableContacts.includes(contact.id)
            ? {}
            : { 'click': () => selectContact(contact.id) }"
        >
          <contact-icon
            :name="contact.displayName"
            :size="36"
            :selected="props.selectedContacts.includes(contact.id)"
            :readonly="true"
          />
          <span
            :class="[
              'contact-list__content-item-name',
              { 'contact-list__content-item-name--selected': props.selectedContacts.includes(contact.id) },
            ]"
          >
            {{ contact.displayName }}
          </span>
        </div>
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

      &-item {
        position: relative;
        height: calc(var(--base-size) * 5.5);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 calc(var(--base-size) * 2);
        font-size: var(--font-14);
        font-weight: 500;
        color: var(--black-90, #212121);
        cursor: pointer;

        &-name {
          display: inline-block;
          margin-left: var(--base-size);
          width: calc(100% - calc(var(--base-size) * 5));
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;

          &--selected {
            color: var(--blue-main, #0090ec);
          }
        }

        &--readonly {
          cursor: default;
        }

        &--without-anchor {
          padding: 0;
        }

        &:not(.contact-list__content-item--readonly):hover {
          background-color: var(--blue-main-30, #b0dafc);
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
