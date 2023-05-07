<script lang="ts" setup>
  import { computed, watch, withDefaults, useSlots, onMounted, ref } from 'vue'
  import { Icon } from '@iconify/vue'
  import { patchTextareaMaxRowsSupport } from '@/libs/dom/textarea-max-rows'
  import { hasSlotContent } from '@/helpers/common.helper'

  const emit = defineEmits(['input', 'update:text', 'update:valid'])
  const props = withDefaults(defineProps<{
    text: string | undefined;
    type?: 'input'|'textarea';
    rows?: number;
    maxRows?: number;
    label?: string;
    rules?: ((value: string) => boolean|string)[] | null;
    placeholder?: string;
    clearable?: boolean;
    disabled?: boolean;
    valid?: boolean;
  }>(), {
    type: 'input',
    rows: 6,
    maxRows: 6,
    label: '',
    rules: null,
    placeholder: '',
    clearable: false,
    valid: true,
  })
  const slots = useSlots()

  const textareaElement = ref(null)
  const isPrependSlotPresent = computed(() => hasSlotContent(slots['prepend-icon']))

  const validate = (value: string) => {
    if (props.rules && props.rules.length > 0) {
      let isValid = true
      for (const f of props.rules) {
        if (typeof f === 'function') {
          const v = f(value)
          isValid = typeof v === 'boolean' && v
            ? isValid && true
            : isValid && false
        }
      }
      emit('update:valid', isValid)
    }
  }

  onMounted(() => {
    if (props.type === 'textarea' && textareaElement.value) {
      patchTextareaMaxRowsSupport(textareaElement.value!)
    }
  })

  watch(
    () => props.text,
    val => validate(val || ''),
    { immediate: true },
  )

  const onInput = (ev: InputEvent) => {
    const value = (ev.target as HTMLInputElement).value
    validate(value)
    emit('update:text', value)
    emit('input', value)
  }

  const clearText = () => {
    emit('update:text', '')
    emit('input', '')
  }
</script>

<template>
  <div
    :class="[
      'p-field',
      {
        'p-field--disabled': props.disabled,
        'p-field--invalid': !props.valid,
      },
    ]"
  >
    <label v-if="props.label">
      {{ props.label }}
    </label>
    <textarea
      v-if="props.type === 'textarea'"
      ref="textareaElement"
      :value="props.text"
      :placeholder="props.placeholder || ''"
      :readonly="props.disabled"
      :rows="props.rows"
      :max-rows="props.maxRows"
      class="p-field__content"
      v-bind="$attrs"
      @input="onInput"
    />
    <input
      v-else
      :value="props.text"
      :placeholder="props.placeholder || ''"
      :readonly="props.disabled"
      :class="[
        'p-field__content',
        { 'p-field__content--with-prepend': props.type === 'input' && isPrependSlotPresent },
        { 'p-field__content--clearable': props.clearable },
        { 'p-field__content--filled': props.text },
      ]"
      v-bind="$attrs"
      @input="onInput"
    >

    <div
      v-if="props.type === 'input' && isPrependSlotPresent"
      class="p-field__prepend"
    >
      <slot name="prepend-icon" />
    </div>

    <var-button
      v-if="props.clearable && props.text"
      size="mini"
      round
      text
      class="p-field__clear-btn"
      @click.stop.prevent="clearText"
    >
      <icon
        icon="baseline-close"
        width="12"
        height="12"
        color="#b3b3b3"
      />
    </var-button>
  </div>
</template>

<style lang="scss" scoped>
  .p-field {
    position: relative;
    width: 100%;

    label {
      display: block;
      width: 100%;
      font-size: var(--font-12);
      font-weight: 600;
      color: var(--black-90, #212121);
      margin-bottom: calc(var(--base-size) / 2);
    }

    input {
      height: calc(var(--base-size) * 4);
    }

    textarea {
      resize: none;
    }

    &__content {
      display: block;
      box-sizing: border-box;
      position: relative;
      width: 100%;
      margin-left: 0;
      border-radius: 4px;
      background-color: var(--gray-50, #f2f2f2);
      padding: var(--base-size);
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

      &:focus-visible {
        outline-width: 0;
        background-color: var(--blue-main-20, #d8edfd);
      }

      &--with-prepend {
        padding-left: calc(var(--base-size) * 4);
      }

      &--clearable.p-field__content--filled {
        padding-right: calc(var(--base-size) * 3);
      }
    }

    &--disabled {
      pointer-events: none;
      user-select: none;
    }

    &--invalid {
      label {
        color: var(--pear-100, #f75d53);
      }

      input {
        width: calc(100% - 4px);
        margin-left: 2px;
        padding-left: calc(var(--base-size) - 2px);
        padding-right: calc(var(--base-size) - 2px);
        outline: 2px solid var(--pear-100, #f75d53);
      }
    }

    &__prepend {
      position: absolute;
      left: 0;
      bottom: 0;
      width: calc(var(--base-size) * 4);
      height: calc(var(--base-size) * 4);
      display: flex;
      justify-content: center;
      align-items: center;
    }

    &__clear-btn {
      --button-round-padding: 2px;

      position: absolute;
      right: calc(var(--base-size) / 2);
      bottom: var(--base-size);
    }
  }
</style>
