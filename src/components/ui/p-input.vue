<script lang="ts" setup>
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import { computed, onMounted, ref, watch } from 'vue'
  import { Icon } from '@iconify/vue'

  const props = defineProps<{
    value: string;
    label?: string;
    placeholder?: string;
    clearable?: boolean;
    rules?: Array<(v: string) => any>;
    readonly?: boolean;
    disabled?: boolean;
    icon?: string;
    iconSize?: string | number;
    iconColor?: string;
  }>()
  const emit = defineEmits([
    'input',
    'focus',
    'blur',
    'click',
    'clear',
    'change',
    'update:value',
    'update:valid',
  ])

  const varInputComponent = ref()
  const pInputElement = ref<HTMLDivElement|null>(null)
  const text = ref<string>('')
  const isFocused = ref(false)

  const iconProps = computed(() => {
    const size = props.iconSize && Number(props.iconSize) ? `${Number(props.iconSize)}` : '16'
    const color = props.iconColor || 'var(--black-30)'
    return { size, color }
  })

  const isValid = computed(() => {
    if (!varInputComponent.value) {
      return true
    }

    return !varInputComponent.value.errorMessage
  })

  onMounted(() => {
    if (pInputElement.value) {
      pInputElement.value!.style.setProperty(
        '--input-placeholder-left-padding',
        props.icon ? `${Number(iconProps.value.size) + 12}px` : '8px',
      )
    }
  })

  watch(
    () => props.value,
    val => text.value = val,
    { immediate: true },
  )

  watch(
    () => isValid.value,
    val => emit('update:valid', val),
    { immediate: true },
  )

  const onFocus = (event: Event) => {
    isFocused.value = true
    emit('focus', event)
  }

  const onBlur = (event: Event) => {
    isFocused.value = false
    emit('blur', event)
  }

  const updateValue = (text: string) => {
    emit('update:value', text)
  }
</script>

<template>
  <div
    ref="pInputElement"
    :class="[
      'p-input',
      {
        'p-input--with-icon': props.icon,
        'p-input--clearable': props.clearable,
      },
    ]"
  >
    <label
      v-if="props.label"
      class="p-input__label"
    >
      {{ props.label }}
    </label>

    <var-input
      ref="varInputComponent"
      v-model="text"
      variant="outlined"
      :line="false"
      :clearable="props.clearable"
      :rules="props.rules || []"
      @input="updateValue"
      @focus="onFocus"
      @blur="onBlur"
      @click="emit('click', $event)"
      @clear="emit('clear', $event)"
      @change="emit('change', $event)"
    >
      <template #prepend-icon>
        <icon
          v-if="props.icon"
          :icon="props.icon"
          :width="iconProps.size"
          :height="iconProps.size"
          :color="iconProps.color"
        />
      </template>

      <template #append-icon>
        <var-button
          v-if="clearable && text"
          size="mini"
          round
          text
          class="p-input__clear-btn"
          @click.stop.prevent="updateValue('')"
        >
          <icon
            icon="baseline-close"
            width="12"
            height="12"
            color="#b3b3b3"
          />
        </var-button>
      </template>
    </var-input>
    <div
      v-if="props.placeholder && !text && !isFocused"
      class="p-input__placeholder"
      @click="varInputComponent.focus()"
    >
      <span class="p-input__placeholder-text">{{ placeholder }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import "../../assets/styles/mixins";

  .p-input {
    --field-decorator-placeholder-size: var(--font-13);
    --field-decorator-outlined-normal-padding-top: var(--base-size);
    --field-decorator-outlined-normal-padding-left: var(--base-size);
    --field-decorator-outlined-normal-padding-bottom: var(--base-size);
    --field-decorator-outlined-normal-padding-right: var(--base-size);
    --field-decorator-outlined-normal-icon-padding: var(--base-size) 0;
    --field-decorator-middle-offset-y: 0;
    --field-decorator-icon-size: calc(var(--base-size) * 2);
    --field-decorator-focus-color: var(--blue-main);
    --field-decorator-error-color: var(--pear-100);
    --input-input-height: calc(var(--base-size) * 2);
    --input-placeholder-left-padding: 8px;

    position: relative;
    width: 100%;

    :deep(.var-input) {
      .var-field-decorator {
        .var-field-decorator__controller {
          background-color: var(--gray-50);
          border-radius: var(--half-size);

          .var-field-decorator__middle {
            padding: var(--base-size) 0;

            .var-input__input{
              height: calc(var(--base-size) * 2.5);
              font-size: var(--font-13);
              font-weight: 400;
              line-height: var(--font-20);
            }
          }

          .var-field-decorator__icon {
            .var-icon-close-circle {
              display: none;
            }
          }

          &.var-field-decorator--focus {
            background-color: var(--blue-main-20);
          }

          &.var-field-decorator--error {
            outline: 1px solid var(--pear-100);
          }
        }
      }
    }

    &__label {
      display: block;
      width: 100%;
      font-size: var(--font-12);
      font-weight: 600;
      color: var(--black-90);
      margin-bottom: calc(var(--base-size) / 2);
    }

    &__placeholder {
      position: absolute;
      font-size: var(--font-13);
      font-weight: 300;
      font-style: italic;
      color: var(--gray-90);
      line-height: var(--font-16);
      top: 2px;
      height: calc(var(--base-size) * 4);
      left: var(--input-placeholder-left-padding);
      right: var(--base-size);
      display: flex;
      justify-content: flex-start;
      align-items: center;
      z-index: 1;
      user-select: none;

      &-text {
        display: block;
        @include text-overflow-ellipsis();
      }
    }

    &__clear-btn {
      --button-round-padding: 2px;
    }

    &--with-icon {
      :deep(.var-input) {
        .var-field-decorator {
          .var-field-decorator__controller {
            .var-field-decorator__middle {
              .var-input__input{
                padding-left: var(--half-size);
              }
            }
          }
        }
      }
    }
  }
</style>
