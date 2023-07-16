<script lang="ts" setup>
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import { get, size } from 'lodash'
  import { computed, ref, toRefs } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAppStore, useChatsStore } from '@/store'
  import { exportChatMessages } from '@/helpers/chats.helper'
  import { getChatName } from '@/helpers/chat-ui.helper'
  import { createSnackbar, prepareDateAsSting } from '@/helpers/forUi'
  import ChatAvatar from '@/components/chat/chat-avatar.vue'
  import ChatHeaderActions from '@/components/chat/chat-header-actions.vue'
  import PDialog from '@/components/ui/p-dialog.vue'

  const props = defineProps<{
    chat: ChatView & { unread: number } & ChatMessageView<MessageType>;
    messages: ChatMessageView<MessageType>[];
  }>()

  const router = useRouter()
  const { user } = toRefs(useAppStore())
  const { currentChatId } = toRefs(useChatsStore())
  const { getChat, deleteChat, leaveChat, clearChat, renameChat, getChatList } = useChatsStore()

  const isOpenDialog = ref(false)
  const component = ref<string>('')
  const componentProps = ref<Record<string, any>>({})
  const dialogProps = ref<PDialogProps>({} as PDialogProps)
  const text = computed<string>(() => {
    if (!props.chat.msgId)
      return ''

    return prepareDateAsSting(props.chat.timestamp)
  })
  const isGroupChat = computed<boolean>(() => size(props.chat.members) > 2)

  const clearDialogProps = () => {
    component.value = ''
    componentProps.value = {}
    dialogProps.value = {} as PDialogProps
  }
  const closeDialog = () => {
    isOpenDialog.value = false
    clearDialogProps()
  }

  const runChatHistoryExporting = async () => {
    const result = await exportChatMessages({
      chatName: props.chat.name,
      members: props.chat.members,
      messages: props.messages,
    })
    if (result !== undefined) {
      createSnackbar({
        content: result ? 'The file is saved.' : 'Error on saving file.',
        type: result ? 'success' : 'error',
      })
    }
  }

  const runChatHistoryCleaning = async () => {
    component.value = '../dialogs/confirmation-dialog.vue'
    dialogProps.value = {
      title: 'chat.history.clean.dialog.title',
      onConfirm: async () => {
        await clearChat(props.chat.chatId)
      },
    }
    isOpenDialog.value = true
  }

  const openChatInfoDialog = () => {
    component.value = '../dialogs/chat-info-dialog.vue'
    componentProps.value = { chat: props.chat }
    dialogProps.value = {
      solo: true,
    }
    isOpenDialog.value = true
  }

  const runChatRenaming = () => {
    component.value = '../dialogs/chat-rename-dialog.vue'
    componentProps.value = { chatName: props.chat.name }
    dialogProps.value = {
      title: 'chat.rename.dialog.title',
      confirmButtonText: 'chat.rename.dialog.button.text',
      onConfirm: async ({ oldName, newName }: { oldName: string, newName: string }) => {
        if (newName !== oldName) {
          await renameChat(props.chat, newName)
        }
        clearDialogProps()
      },
    }
    isOpenDialog.value = true
  }

  const closeChat = async () => {
    await router.push('/chats')
    getChat(null)
  }

  const runChatDeleting = () => {
    component.value = '../dialogs/confirmation-dialog.vue'
    dialogProps.value = {
      title: 'chat.delete.dialog.title',
      confirmButtonColor: 'var(--blue-main)',
      confirmButtonBackground: 'var(--system-white)',
      cancelButtonColor: 'var(--system-white)',
      cancelButtonBackground: 'var(--blue-main)',
      onConfirm: async () => {
        await deleteChat(props.chat.chatId)
        if (props.chat.chatId === currentChatId.value) {
          await router.push('/chats')
          await getChat(null)
        }
        await getChatList()
        clearDialogProps()
      },
    }
    isOpenDialog.value = true
  }

  const runChatLeave = () => {
    component.value = '../dialogs/confirmation-dialog.vue'
    dialogProps.value = {
      title: 'chat.leave.dialog.title',
      confirmButtonText: 'chat.leave.dialog.button',
      confirmButtonColor: 'var(--blue-main)',
      confirmButtonBackground: 'var(--system-white)',
      cancelButtonColor: 'var(--system-white)',
      cancelButtonBackground: 'var(--blue-main)',
      onConfirm: async () => {
        await leaveChat(props.chat, [user.value])
        if (props.chat.chatId === currentChatId.value) {
          await router.push('/chats')
          await getChat(null)
        }
        await getChatList()
        clearDialogProps()
      },
    }
    isOpenDialog.value = true
  }

  const actionsHandlers = {
    history: {
      export: runChatHistoryExporting,
      clean: runChatHistoryCleaning,
    },
    chat: {
      info: openChatInfoDialog,
      rename: runChatRenaming,
      close: closeChat,
      delete: runChatDeleting,
      leave: runChatLeave,
    },
  }

  const selectAction = async (compositeAction: string) => {
    const [entity, action] = compositeAction.split(':')
    const handler = get(actionsHandlers, [entity, action])
    if (handler) {
      await handler()
    }
  }
</script>

<template>
  <div class="chat-header">
    <div class="chat-header__block">
      <chat-avatar
        :name="getChatName(props.chat)"
        :shape="isGroupChat ? 'decagon' : 'circle'"
      />

      <div class="chat-header__content">
        <div class="chat-header__name">
          {{ getChatName(props.chat) }}
        </div>

        <div
          v-phtml.sanitize="props.chat.timestamp ? $tr('chat.header.info', { date: text }) : ''"
          class="chat-header__info"
        />
      </div>
    </div>

    <chat-header-actions @select:action="selectAction" />

    <p-dialog
      v-if="dialogProps && component && isOpenDialog"
      :component="component"
      :component-props="componentProps"
      :dialog-props="dialogProps"
      @closed="closeDialog"
    />
  </div>
</template>

<style lang="scss" scoped>
  @import "../../assets/styles/mixins";

  .chat-header {
    position: relative;
    width: 100%;
    min-height: calc(var(--base-size) * 8);
    height: calc(var(--base-size) * 8);
    background-color: var(--system-white);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 calc(var(--base-size) * 2);

    &__block {
      display: flex;
      justify-content: flex-start;
      align-items: center;
    }

    &__content {
      position: relative;
      width: calc(100% - var(--base-size) * 5.5);
      margin-left: var(--base-size);
    }

    &__name,
    &__info{
      position: relative;
      @include text-overflow-ellipsis();
    }

    &__name {
      font-size: var(--font-16);
      font-weight: 600;
      line-height: 22px;
      color: var(--black-90);
    }

    &__info {
      min-height: 14px;
      font-size: var(--font-12);
      font-weight: 400;
      line-height: 14px;
      color: var(--black-30);
    }
  }
</style>
