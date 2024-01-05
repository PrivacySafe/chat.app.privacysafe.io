<script lang="ts" setup>
  import { computed, toRefs } from 'vue'
  import { size } from 'lodash'
  import { useChatsStore } from '@/store'
  import { chatMenuItems } from '@/constants'
  import { Ui3nButton, Ui3nMenu, Ui3nIcon } from '@v1nt1248/3nclient-lib'

  const emit = defineEmits(['select:action'])
  const { currentChat } = toRefs(useChatsStore())

  const chatType = computed(() => {
    const currentChatValue = currentChat.value()
    const { members = [] } = currentChatValue || {}
    return size(members) > 2 ? 'group' : 'single'
  })
  const availableMenuItems = computed(() => chatMenuItems.filter(i => i.chatTypes.includes(chatType.value)))

  const selectAction = (compositeAction: string) => {
    emit('select:action', compositeAction)
  }
</script>

<template>
  <div class="chat-header-actions">
    <ui3n-menu
      :offset-y="4"
      :offset-x="-40"
    >
      <ui3n-button
        color="var(--gray-50)"
        text-color="var(--black-90)"
        class="chat-header-actions-btn"
      >
        Actions
        <ui3n-icon
          icon="arrow-drop-down"
          width="16"
          height="16"
          color="var(--black-90)"
        />
      </ui3n-button>

      <template #menu>
        <div class="chat-header-actions__menu">
          <div
            v-for="item in availableMenuItems"
            :key="item.icon"
            :class="[
              'chat-header-actions__menu-item',
              {
                'chat-header-actions__menu-item--margin': item.margin,
                'chat-header-actions__menu-item--accent': item.isAccent,
                'chat-header-actions__menu-item--disabled': item.disabled,
              },
            ]"
            v-on="item.disabled ? {} : { click: () => selectAction(item.action) }"
          >
            <ui3n-icon
              :icon="item.icon"
              width="12"
              height="12"
            />
            {{ item.text }}
          </div>
        </div>
      </template>
    </ui3n-menu>
  </div>
</template>

<style lang="scss" scoped>
  .chat-header-actions {
    --button-normal-height: calc(var(--base-size) * 4);
    --button-normal-font-size: var(--font-13);
    --button-default-color: var(--gray-50);
    --button-normal-padding: 0 var(--base-size);

    .ui3n-button {
      box-shadow: none;

      .iconify {
        position: relative;
        top: 2px;
        margin-left: var(--base-size);
      }
    }
  }
</style>

<style lang="scss">
  .chat-header-actions__menu {
    background-color: var(--gray-50);
    border-radius: var(--half-size);
    padding: var(--half-size);
    width: 145px;

    &-item {
      position: relative;
      display: flex;
      justify-content: flex-start;
      align-items: center;
      padding: 0 var(--half-size);
      height: calc(var(--base-size) * 3);
      font-size: 13px;
      font-weight: 400;
      color: var(--black-90);
      border-radius: 2px;
      cursor: pointer;

      .iconify {
        margin-right: var(--half-size);
      }

      &:hover {
        color: var(--blue-main-120);
        background-color: var(--blue-main-30);
      }

      &--accent {
        color: var(--pear-100);

        &:hover {
          color: var(--pear-100);
          background-color: var(--pear-30);
        }
      }

      &--margin {
        margin-top: var(--half-size);
      }

      &--disabled {
        pointer-events: none;
        opacity: 0.5;
        cursor: default;
      }
    }
  }
</style>
