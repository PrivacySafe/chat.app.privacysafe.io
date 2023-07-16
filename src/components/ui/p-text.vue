<script lang="ts" setup>
  import { computed, onMounted, ref } from 'vue'
  import { patchTextareaMaxRowsSupport } from '@/libs/dom/textarea-max-rows'

  const emit = defineEmits(['input', 'focus', 'blur', 'update:text', 'update:valid'])
  const props = defineProps<{
    text: string | undefined;
    rows?: number;
    maxRows?: number;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
  }>()

  const textareaElement = ref(null)
  const isFocused = ref(false)

  const componentProps = computed(() => {
    const { rows = 6, maxRows = 6, label = '', placeholder = '', disabled = false } = props
    return { rows, maxRows, label, placeholder, disabled }
  })

  onMounted(() => {
    if (textareaElement.value) {
      patchTextareaMaxRowsSupport(textareaElement.value!)
    }
  })

  const onFocus = (event: Event) => {
    isFocused.value = true
    emit('focus', event)
  }

  const onBlur = (event: Event) => {
    isFocused.value = false
    emit('blur', event)
  }

  const onInput = (ev: InputEvent) => {
    const value = (ev.target as HTMLInputElement).value
    emit('update:text', value)
    emit('input', value)
  }
</script>

<template>
  <div
    :class="[
      'p-text',
      { 'p-text--disabled': props.disabled, 'p-text--focused': isFocused },
    ]"
  >
    <label
      v-if="componentProps.label"
      class="p-text__label"
    >
      {{ componentProps.label }}
    </label>
    <div class="p-text__body">
      <textarea
        ref="textareaElement"
        :value="props.text"
        :placeholder="componentProps.placeholder"
        :readonly="componentProps.disabled"
        :rows="componentProps.rows"
        :max-rows="componentProps.maxRows"
        :disabled="componentProps.disabled"
        class="p-text__content"
        v-bind="$attrs"
        @input="onInput"
        @focusin="onFocus"
        @focusout="onBlur"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .p-text {
    position: relative;
    width: 100%;

    &__label {
      display: block;
      width: 100%;
      font-size: var(--font-12);
      font-weight: 600;
      color: var(--black-90, #212121);
      margin-bottom: calc(var(--base-size) / 2);
    }

    &__body {
      position: relative;
      width: 100%;
      padding: var(--base-size) 0;
      background-color: var(--gray-50, #f2f2f2);
      border-radius: 4px;
    }

    &__content {
      resize: none;
      display: block;
      box-sizing: border-box;
      position: relative;
      width: 100%;
      border-radius: 4px;
      background-color: var(--gray-50, #f2f2f2);
      padding: 0 var(--base-size);
      font-family: OpenSans, sans-serif;
      font-size: var(--font-13);
      font-weight: 400;
      line-height: var(--font-16);
      color: var(--black-90, #212121);
      border: none;

      &::placeholder {
        font-size: var(--font-13);
        font-weight: 300;
        font-style: italic;
        color: var(--gray-90, #444);
      }
    }

    &--disabled {
      pointer-events: none;
      user-select: none;
      opacity: 0.5;
    }

    &--focused {
      .p-text {
        &__body, &__content {
          background-color: var(--blue-main-20, #d8edfd);
          outline: none;
          border: none;
        }
      }
    }
  }
</style>
