<script lang="ts" setup>
  import { ref, watch } from 'vue'
  import emoticons from '@/data/emoticons.json'
  import { vOnClickOutside } from '@vueuse/components'

  const props = defineProps<{
    open: boolean;
  }>()
  const emit = defineEmits(['close', 'select'])

  const visible = ref(false)

  watch(
    () => props.open,
    val => visible.value = val,
    { immediate: true },
  )

  const closeDialog = () => {
    visible.value = false
    emit('close')
  }

  const selectEmoticon = ({ id, emoticon }: { id: string, emoticon: string }) => {
    emit('select', { id, emoticon })
    closeDialog()
  }
</script>

<template>
  <div
    v-if="visible"
    v-on-click-outside="closeDialog"
    class="emoticons-dialog"
  >
    <div class="emoticons-dialog__body">
      <div
        v-for="(group, name) in emoticons"
        :key="name"
        class="emoticons-dialog__group"
      >
        <h4 class="emoticons-dialog__group-name">
          {{ name }}
        </h4>
        <div class="emoticons-dialog__group-body">
          <div
            v-for="(emoticon, id) in group"
            :key="id"
            class="emoticons-dialog__emoji"
            @click="selectEmoticon({ id, emoticon })"
          >
            {{ emoticon }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import "../../assets/styles/mixins";

  .emoticons-dialog {
    --emoticons-dialog-padding: calc(var(--base-size) * 1.5);

    position: absolute;
    width: 200px;
    height: 200px;
    padding: var(--emoticons-dialog-padding) var(--base-size) var(--emoticons-dialog-padding);
    background-color: var(--system-white);
    border-radius: var(--half-size);
    bottom: 100%;
    left: calc(var(--half-size) * 1.5);
    z-index: 5;
    @include block-shadow;

    &__body {
      position: relative;
      width: 100%;
      height: 100%;
      overflow-x: hidden;
      overflow-y: auto;

      .emoticons-dialog__group:last-child {
        padding-bottom: 0;
      }
    }

    &__group {
      padding-bottom: var(--base-size);

      &-name {
        font-size: var(--font-12);
        margin: 0 0 var(--base-size);
      }

      &-body {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
      }
    }

    &__emoji {
      display: flex;
      justify-content: center;
      align-items: center;
      cursor: pointer;
    }

    &::before,
    &::after {
      content: ' ';
      position: absolute;
      width: 0;
      height: 0;
    }

    &::before {
      left: 8px;
      bottom: -12px;
      border: 6px solid;
      border-color: var(--black-30) transparent transparent transparent;
    }

    &::after {
      left: 9px;
      bottom: -10px;
      border: 5px solid;
      border-color: var(--system-white) transparent transparent transparent;
    }
  }
</style>
