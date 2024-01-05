<script lang="ts" setup>
  import ContactIcon from '@/components/contacts/contact-icon.vue'

  defineProps<{
    contact: PersonView & { displayName: string };
    selected: boolean;
    withoutAnchor: boolean;
    readonly: boolean;
  }>()

  const emit = defineEmits(['click'])
</script>

<template>
  <div
    :class="[
      'contact-list-item',
      {
        'contact-list-item--selected': selected,
        'contact-list-item--without-anchor': withoutAnchor,
        'contact-list-item--readonly': readonly,
      },
    ]"
    v-on="readonly ? {} : { click: () => emit('click', contact.id) }"
  >
    <contact-icon
      :name="contact.displayName"
      :size="36"
      :selected="selected"
      :readonly="true"
    />
    <span
      :class="[
        'contact-list-item__name',
        { 'contact-list-item__name--selected': selected },
      ]"
    >
      {{ contact.displayName }}
    </span>
  </div>
</template>

<style lang="scss" scoped>
  @import "../../assets/styles/mixins";

  .contact-list-item {
    position: relative;
    width: 100%;
    height: calc(var(--base-size) * 5.5);
    display: flex;
    justify-content: flex-start;
    align-items: center;
    padding: 0 calc(var(--base-size) * 2);
    font-size: var(--font-14);
    font-weight: 500;
    color: var(--black-90, #212121);

    &--without-anchor {
      padding: 0;
    }

    &:not(.contact-list-item--readonly) {
      cursor: pointer;

      &:hover {
        background-color: var(--blue-main-30, #b0dafc);
      }
    }

    &__name {
      display: inline-block;
      margin-left: var(--base-size);
      @include text-overflow-ellipsis(calc(100% - calc(var(--base-size) * 5)));

      &--selected {
        color: var(--blue-main, #0090ec);
      }
    }
  }
</style>
