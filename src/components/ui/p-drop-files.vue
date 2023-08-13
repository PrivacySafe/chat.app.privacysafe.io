<script lang="ts" setup>
  import { computed, inject, ref } from 'vue'

  const props = defineProps<{
    title?: string;
    text?: string;
    additionalText?: string;
  }>()
  const emit = defineEmits<{
    (e: 'select', fileList: FileList): void;
  }>()

  const { $tr } = inject<I18nPlugin>('i18n')!
  const isOverDropPlace = ref(false)
  const isOverDropZone = ref(false)
  const params = computed(() => {
    const {
      title = $tr('dropzone.default.title')
    } = props

    return {
      title,
    }
  })

  const onDragenter = (ev: MouseEvent) => {
    ev.preventDefault()
    isOverDropPlace.value = true
  }
  const onDragleave = (ev: MouseEvent) => {
    ev.preventDefault()
    isOverDropPlace.value = false
  }
  const onDropzoneDragover = (ev: MouseEvent) => {
    ev.preventDefault()
    ev.stopPropagation()
  }
  const onDropzoneDragenter = (ev: MouseEvent) => {
    ev.preventDefault()
    isOverDropZone.value = true
  }
  const onDropzoneDragleave = (ev: MouseEvent) => {
    ev.preventDefault()
    isOverDropZone.value = false
  }
  const onDrop = (ev: DragEvent) => {
    ev.stopPropagation()
    ev.preventDefault()
    console.log('DROP: ',ev, ev.dataTransfer)
    if (ev.dataTransfer!.files) {
      emit('select', ev.dataTransfer!.files)
    }
    isOverDropPlace.value = false
    isOverDropZone.value = false
  }
</script>

<template>
  <!-- eslint-disable max-len -->
  <div
    class="p-drop-files"
    @dragenter="onDragenter"
    @dragleave="onDragleave"
  >
    <slot />

    <div
      v-if="isOverDropPlace || isOverDropZone"
      class="p-drop-files__dropzone"
      @dragenter="onDropzoneDragenter"
      @dragover="onDropzoneDragover"
      @dragleave="onDropzoneDragleave"
      @drop="onDrop"
    >
      <div class="p-drop-files__dropzone-border" />
      <h3 class="p-drop-files__dropzone-title">
        {{ params.title }}
      </h3>
      <div class="p-drop-files__dropzone-icon">
        <svg
          width="192"
          height="192"
          viewBox="0 0 192 192"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M51 152C47.9333 152 45.3333 150.934 43.2 148.8C41.0667 146.667 40 144.067 40 141V119.8H46.2V141C46.2 142.2 46.7 143.3 47.7 144.3C48.7 145.3 49.8 145.8 51 145.8H141C142.2 145.8 143.3 145.3 144.3 144.3C145.3 143.3 145.8 142.2 145.8 141V119.8H152V141C152 144.067 150.933 146.667 148.8 148.8C146.667 150.934 144.067 152 141 152H51ZM93 122.4V49.2002L72.8 69.2002L68.4 65.0002L96 37.2002L123.6 65.0002L119.2 69.2002L99 49.2002V122.4H93Z"
            fill="#212121"
          />
        </svg>
      </div>
      <div
        v-if="props.text"
        class="p-drop-files__dropzone-text"
      >
        {{ props.text }}
      </div>
      <div
        v-if="props.additionalText"
        class="p-drop-files__dropzone-additional"
      >
        {{ props.additionalText }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .p-drop-files {
    position: relative;
    width: 100%;
    height: 100%;

    &__dropzone {
      position: absolute;
      background-color: var(--system-white);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      inset: var(--half-size) var(--base-size);
      border-radius: var(--base-size);
      z-index: 5;

      &-border {
        position: absolute;
        width: calc(100% - calc(var(--base-size) * 2));
        height: calc(100% - calc(var(--base-size) * 2));
        top: var(--base-size);
        left: var(--base-size);
        border-radius: var(--base-size);
        border: 2px dashed var(--gray-50);
        pointer-events: none;
      }

      &-title {
        margin: 0 0 24px;
        font-size: var(--font-24);
        font-weight: 600;
        color: var(--black-30);
        pointer-events: none;
      }

      &-icon {
        position: relative;
        width: 160px;
        height: 160px;
        border-radius: 50%;
        background-color: var(--gray-50);
        display: flex;
        justify-content: center;
        align-items: center;
        pointer-events: none;
      }

      &-text {
        margin-top: calc(var(--base-size) * 3);
        font-size: var(--font-12);
        line-height: var(--font-16);
        font-weight: 400;
        color: var(--black-30);
      }

      &-additional {
        margin-top: var(--half-size);
        font-size: var(--font-12);
        font-weight: 500;
        color: var(--black-90);
      }
    }
  }
</style>
