<script lang="ts" setup>
  import { computed } from 'vue'
  import { getElementColor } from '@/helpers/forUi'

  const props = defineProps<{
    name: string;
    shape?: 'circle' | 'box' | 'octagon' | 'nonagon' | undefined
  }>()

  const shapes = {
    circle: 'circle(50% at 50% 50%)',
    box: 'polygon(0 0, 100% 0, 100% 100%, 0% 100%)',
    octagon: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
    nonagon: 'polygon(50% 0%, 83% 12%, 100% 43%, 94% 78%, 68% 100%, 32% 100%, 6% 78%, 0% 43%, 17% 12%)',
  }

  const clipPathValue = computed(() => {
    if (!props.shape) {
      return shapes.circle
    }

    const value = shapes[props.shape]
    return value || shapes.circle
  })

  const letters = computed<string>(() => {
    return props.name.length === 1
      ? props.name.toLocaleUpperCase()
      : `${props.name[0].toLocaleUpperCase()}${props.name[1].toLocaleLowerCase()}`
  })

  const mainStyle = computed<Record<string, string>>(() => ({
    '--clip-path-value': clipPathValue.value,
    backgroundColor: getElementColor(letters.value || '?'),
  }))
</script>

<template>
  <div
    class="chat-avatar"
    :style="mainStyle"
  >
    {{ letters }}
  </div>
</template>

<style lang="scss" scoped>
  .chat-avatar {
    -webkit-font-smoothing: antialiased;
    position: relative;
    width: calc(var(--base-size) * 4.5);
    min-width: calc(var(--base-size) * 4.5);
    height: calc(var(--base-size) * 4.5);
    min-height: calc(var(--base-size) * 4.5);
    clip-path: var(--clip-path-value);
    color: var(--system-white, #fff);
    font-size: var(--font-14);
    font-weight: 600;
    line-height: 1;
    z-index: 1;
    pointer-events: none;
    user-select: none;
    text-shadow: 2px 2px 5px var(--gray-90, #444);
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
