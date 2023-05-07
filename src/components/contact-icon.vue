<script lang="ts" setup>
  import { computed } from 'vue'
  import { Icon } from '@iconify/vue'
  import { getElementColor } from '@/helpers/forUi'

  const props = defineProps<{
    size?: number;
    name?: string;
    photo?: string;
    isGroup?: boolean;
    selected?: boolean;
    readonly?: boolean;
  }>()
  const emit = defineEmits(['click'])

  const letters = computed<string>(() => {
    if (props.name && !props.photo) {
      return props.name.length === 1
        ? props.name.toLocaleUpperCase()
        : `${props.name[0].toLocaleUpperCase()}${props.name[1].toLocaleLowerCase()}`
    }
    return ''
  })

  const innerSize = computed<number>(() => props.size || 24)
  const mainStyle = computed<Record<string, string>>(() => {
    const styles: Record<string, string> = {
      minWidth: `${innerSize.value}px`,
      width: `${innerSize.value}px`,
      minHeight: `${innerSize.value}px`,
      height: `${innerSize.value}px`,
      backgroundColor: getElementColor(letters.value || '?'),
    }
    return props.photo
      ? {
        ...styles,
        backgroundImage: `url(${props.photo})`,
      }
      : styles
  })
  const nameStyle = computed<Record<string, string>>(() => ({fontSize: `${Math.floor(innerSize.value * 0.5) - 6}px`}))

  const onClick = (ev: MouseEvent): void => {
    emit('click', ev)
  }
</script>

<template>
  <div
    :class="[
      'contact-icon',
      { 'contact-icon--selected': props.selected },
    ]"
    :style="mainStyle"
    v-on="readonly ? {} : { 'click': onClick }"
  >
    <div
      v-if="!props.photo"
      class="contact-icon__letter"
      :style="nameStyle"
    >
      {{ letters }}
    </div>

    <div
      v-if="props.selected"
      class="contact-icon__icon"
    >
      <icon
        icon="round-check"
        :width="innerSize / 3 - 2"
        :height="innerSize / 3 - 2"
        color="var(--system-white, #fff)"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .contact-icon {
    position: relative;
    box-sizing: border-box;
    border-radius: 50%;
    display: flex;
    justify-content: center;
    align-items: center;
    background-repeat: no-repeat;
    background-position: 50% 50%;
    background-size: cover;

    &__letter {
      -webkit-font-smoothing: antialiased;
      color: var(--system-white, #fff);
      font-weight: 600;
      line-height: 1;
      z-index: 1;
      pointer-events: none;
      user-select: none;
      text-shadow: 2px 2px 5px var(--gray-90, #444);
    }

    &--selected {
      &::before {
        content: "";
        position: absolute;
        width: 100%;
        height: 100%;
        background-color: transparent;
        box-sizing: border-box;
        border-radius: 50%;
        border: 4px solid var(--system-white, #fff);
      }

      &::after {
        content: "";
        position: absolute;
        width: 100%;
        height: 100%;
        background-color: transparent;
        box-sizing: border-box;
        border-radius: 50%;
        border: 2px solid var(--blue-main, #0090ec);
      }
    }

    &__icon {
      position: absolute;
      width: calc(100% / 3);
      height: calc(100% / 3);
      border-radius: 50%;
      background-color: var(--blue-main, #0090ec);
      bottom: 0;
      right: 0;
      display: flex;
      justify-content: center;
      align-items: center;

      svg {
        z-index: 1;
      }
    }
  }
</style>
