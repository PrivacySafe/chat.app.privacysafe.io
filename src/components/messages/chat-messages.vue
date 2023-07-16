<script lang="ts" setup>
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import {
    inject,
    onBeforeMount,
    onBeforeUnmount,
    nextTick,
    ref,
    toRefs,
  } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAppStore, useChatsStore } from '@/store'
  import { createSnackbar } from '@/helpers/forUi'
  import { getMessageActions } from '@/helpers/chats.helper'
  import {
    getMessageFromCurrentChat,
    copyMessageToClipboard,
    downloadFile,
  } from '@/helpers/chat-message-actions.helpers'
  import ChatMessage from './chat-message.vue'
  import ChatMessageActions from '@/components/messages/chat-message-actions.vue'
  import PDialog from '@/components/ui/p-dialog.vue'

  const router = useRouter()
  const props = defineProps<{
    messages: ChatMessageView<MessageType>[],
  }>()
  const emit = defineEmits(['reply'])

  const $emitter = inject<EventBus>('event-bus')!

  const { user } = toRefs(useAppStore())
  const { currentChatId } = toRefs(useChatsStore())
  const { createChat, deleteMessage } = useChatsStore()
  const listElement = ref<HTMLDivElement|null>(null)
  const dialogParams = ref<{
    isOpen: boolean;
    props: PDialogProps|null;
    component: string;
    componentProps?: Record<string, any>;
  }>({
    isOpen: false,
    props: null,
    component: '',
    componentProps: {},
  })

  const msgActionsMenuProps = ref<{
    open: boolean;
    actions: Omit<ChatMessageAction, 'conditions'>[];
    msg: ChatMessageView<MessageType> | null;
  }>({
    open: false,
    actions: [],
    msg: null,
  })

  const scrollList = async ({ chatId}: { chatId: string }) => {
    if (listElement.value && currentChatId.value === chatId) {
      await nextTick(() => {
        listElement.value!.scrollTop = 1e9
      })
    }
  }

  const handleClick = (ev: MouseEvent): ChatMessageView<MessageType> | undefined => {
    ev.preventDefault()
    const { target } = ev
    const { id, classList } = target as Element
    return classList.contains('chat-message__content') && id
      ? getMessageFromCurrentChat({ chatMessageId: id })
      : undefined
  }

  const goToMessage = (ev: MouseEvent) => {
    const msg = handleClick(ev)
    if (msg && msg.initialMessageId) {
      const initialMessageElement = document.getElementById(`msg-${msg.initialMessageId}`)
      initialMessageElement && initialMessageElement.scrollIntoView(false)
    }
  }

  const openMessageMenu = (ev: MouseEvent) => {
    const msg = handleClick(ev)
    if (msg && msg.chatMessageType !== 'system') {
      // const messageElement = document.getElementById(`msg-${msg.chatMessageId}`)
      // messageElement && messageElement.scrollIntoView();

      msgActionsMenuProps.value = {
        open: true,
        actions: getMessageActions(msg!),
        msg,
      }
    }
  }

  const clearMessageMenu = () => {
    msgActionsMenuProps.value = {
      open: false,
      actions: [] as Omit<ChatMessageAction, 'conditions'>[],
      msg: null,
    }
  }

  const closeDialog = () => {
    dialogParams.value = {
      isOpen: false,
      props: null,
      component: '',
      componentProps: {},
    }
  }


  const copyMsgText = async (chatMessageId: string) => {
    const msg = getMessageFromCurrentChat({ chatMessageId })
    await copyMessageToClipboard(msg)
    createSnackbar({ content: 'The message content was copied to clipboard' })
  }

  const deleteMsg = (chatMessageId: string) => {
    dialogParams.value = {
      isOpen: true,
      props: {
        wrapperCssClass: 'message-delete-dialog__wrapper',
        title: 'chat.message.delete.dialog.title',
        confirmButtonText: 'btn.text.delete',
        confirmButtonColor: 'var(--blue-main)',
        confirmButtonBackground: 'var(--system-white)',
        cancelButtonColor: 'var(--system-white)',
        cancelButtonBackground: 'var(--blue-main)',
        onConfirm: (deleteForEveryone?: boolean) => deleteMessage(chatMessageId, deleteForEveryone),
      },
      component: '../dialogs/message-delete-dialog.vue',
      componentProps: {},
    }
  }

  const downloadAttachment = async (chatMessageId: string) => {
    const msg = getMessageFromCurrentChat({ chatMessageId })
    const res = await downloadFile(msg)
    if (res === false) {
      createSnackbar({
        type: 'error',
        content: 'The downloaded file may have been deleted or moved',
      })
    }
  }

  const replyMsg = (chatMessageId: string) => {
    const msg = getMessageFromCurrentChat({ chatMessageId })
    msg && emit('reply', msg)
  }

  const forwardMsg = (chatMessageId: string) => {
    dialogParams.value = {
      isOpen: true,
      props: {
        wrapperCssClass: 'message-forward-dialog__wrapper',
        title: 'chat.message.forward.dialog.title',
        confirmButton: false,
        cancelButton: false,
        onConfirm: async ({ type, data }: { type: 'chat' | 'contact', data: string }) => {
          let chatId = type === 'chat' ? data : undefined
          if (type === 'contact') {
            chatId = await createChat({ members: [user.value, data], admins: [user.value] })
          }

          router.push(`/chats/${chatId}?initialMsgId=${chatMessageId}`)
        },
      },
      component: '../dialogs/message-forward-dialog.vue',
      componentProps: {},
    }
  }

  const messageActions: Partial<Record<ChatMessageActionType, Function>> = {
    copy: copyMsgText,
    'delete_message': deleteMsg,
    download: downloadAttachment,
    reply: replyMsg,
    forward: forwardMsg,
  }

  const handleAction = ({ action, chatMessageId }: { action: ChatMessageActionType, chatMessageId: string }) => {
    messageActions[action] && messageActions[action]!(chatMessageId)
  }

  onBeforeMount(() => {
    $emitter.on('send:message', scrollList)
  })

  onBeforeUnmount(() => {
    $emitter.off('send:message', scrollList)
  })
</script>

<template>
  <div
    id="chat-messages"
    ref="listElement"
    class="chat-messages"
    @click.right="openMessageMenu"
    @click="goToMessage"
  >
    <chat-message
      v-for="(item, index) in props.messages"
      :key="item.chatMessageId"
      :msg="item"
      :prev-msg-sender="index === 0 ? '' : props.messages[index - 1].sender"
    />

    <teleport
      v-if="msgActionsMenuProps.msg"
      :disabled="!msgActionsMenuProps.open"
      :to="`#msg-${msgActionsMenuProps.msg.chatMessageId}`"
    >
      <chat-message-actions
        :open="msgActionsMenuProps.open"
        :actions="msgActionsMenuProps.actions"
        :msg="msgActionsMenuProps.msg"
        @close="clearMessageMenu"
        @select:action="handleAction"
      />
    </teleport>

    <p-dialog
      v-if="dialogParams.props && dialogParams.component && dialogParams.isOpen"
      :component="dialogParams.component"
      :component-props="dialogParams.componentProps!"
      :dialog-props="dialogParams.props"
      @closed="closeDialog"
    />
  </div>
</template>

<style lang="scss" scoped>
  .chat-messages {
    position: relative;
    width: 100%;
    height: 100%;
    background-color: var(--blue-main-20);
    padding-bottom: var(--base-size);
    overflow-y: auto;

    .scroller {
      height: 100%;
    }
  }
</style>
