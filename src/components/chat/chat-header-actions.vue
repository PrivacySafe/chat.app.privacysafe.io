<script lang="ts" setup>
  import { computed, ref, toRefs } from 'vue'
  import { size } from 'lodash'
  import { useChatsStore } from '@/store'
  import { chatMenuItems } from '@/constants'
  import { Icon } from '@iconify/vue'

  const emit = defineEmits(['select:action'])
  const menu = ref()
  const { currentChat } = toRefs(useChatsStore())

  const chatType = computed(() => {
    const currentChatValue = currentChat.value()
    const { members = [] } = currentChatValue || {}
    return size(members) > 2 ? 'group' : 'single'
  })
  const availableMenuItems = computed(() => chatMenuItems.filter(i => i.chatTypes.includes(chatType.value)))

  const selectAction = (compositeAction: string) => {
    emit('select:action', compositeAction)
    menu.value.close()
  }
</script>

<template>
  <div class="chat-header-actions">
    <var-menu
      ref="menu"
      placement="bottom-end"
      offset-y="4px"
    >
      <var-button>
        Actions
        <icon
          icon="baseline-arrow-drop-down"
          width="16"
          height="16"
          color="var(--black-90)"
        />
      </var-button>

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
            <icon
              :icon="item.icon"
              width="12"
              height="12"
            />
            {{ item.text }}
          </div>
        </div>
      </template>
    </var-menu>
  </div>
</template>

<style lang="scss" scoped>
  .chat-header-actions {
    --button-normal-height: calc(var(--base-size) * 4);
    --button-normal-font-size: var(--font-13);
    --button-default-color: var(--gray-50);
    --button-normal-padding: 0 var(--base-size);

    .var-button {
      box-shadow: none;

      :deep(.var-button__content) {
        line-height: var(--font-16);
      }

      .iconify {
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
