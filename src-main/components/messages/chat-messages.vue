<!-- 
 Copyright (C) 2020 - 2024 3NSoft Inc.

 This program is free software: you can redistribute it and/or modify it under
 the terms of the GNU General Public License as published by the Free Software
 Foundation, either version 3 of the License, or (at your option) any later
 version.

 This program is distributed in the hope that it will be useful, but
 WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 See the GNU General Public License for more details.

 You should have received a copy of the GNU General Public License along with
 this program. If not, see <http://www.gnu.org/licenses/>.
-->

<script lang="ts" setup>
  /* eslint-disable @typescript-eslint/no-explicit-any */
  import {
    inject,
    onBeforeMount,
    onBeforeUnmount,
    nextTick,
    ref,
    toRefs,
    watch,
    defineAsyncComponent,
  } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAppStore, useChatsStore } from '../../store'
  import {
    VueBusPlugin,
    VUEBUS_KEY,
    NOTIFICATIONS_KEY,
    NotificationsPlugin,
    I18N_KEY,
    I18nPlugin,
    DialogsPlugin,
    DIALOGS_KEY,
    capitalize,
  } from '@v1nt1248/3nclient-lib'
  import { getMessageActions } from '../../helpers/chats.helper'
  import {
    getMessageFromCurrentChat,
    copyMessageToClipboard,
    downloadFile,
  } from '../../helpers/chat-message-actions.helpers'
  import ChatMessage from './chat-message.vue'
  import ChatMessageActions from './chat-message-actions.vue'

  const router = useRouter()
  const props = defineProps<{
    chat: ChatView & { unread: number } & ChatMessageView<MessageType>;
    messages: ChatMessageView<MessageType>[];
  }>()
  const emit = defineEmits(['reply'])

  const { $tr } = inject<I18nPlugin>(I18N_KEY)!
  const notifications = inject<NotificationsPlugin>(NOTIFICATIONS_KEY)
  const dialog = inject<DialogsPlugin>(DIALOGS_KEY)!

  const bus = inject<VueBusPlugin>(VUEBUS_KEY)!

  const { user } = toRefs(useAppStore())
  const { currentChatId } = toRefs(useChatsStore())
  const { createChat, deleteMessage } = useChatsStore()
  const listElement = ref<HTMLDivElement|null>(null)

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

  const copyMsgText = async (chatMessageId: string) => {
    const msg = getMessageFromCurrentChat({ chatMessageId })
    await copyMessageToClipboard(msg)
    notifications?.$createNotice({
      type: 'success',
      content: $tr('chat.message.clipboard.copy.text'),
    })
  }

  const deleteMsg = (chatMessageId: string) => {
    const messageDeleteDialog = defineAsyncComponent(() => import('../dialogs/message-delete-dialog.vue'))
    dialog.$openDialog({
      component: messageDeleteDialog,
      componentProps: {},
      dialogProps: {
        title: $tr('chat.message.delete.dialog.title'),
        cssClass: 'message-delete-dialog__wrapper',
        confirmButtonText: capitalize($tr('btn.text.delete')),
        confirmButtonColor: 'var(--blue-main)',
        confirmButtonBackground: 'var(--system-white)',
        cancelButtonColor: 'var(--system-white)',
        cancelButtonBackground: 'var(--blue-main)',
        onConfirm: (deleteForEveryone?: boolean) => deleteMessage(chatMessageId, deleteForEveryone),
      },
    })
  }

  const downloadAttachment = async (chatMessageId: string) => {
    const msg = getMessageFromCurrentChat({ chatMessageId })
    const res = await downloadFile(msg)
    if (res === false) {
      notifications?.$createNotice({
        type: 'error',
        content: $tr('chat.message.file.download.error'),
      })
    }
  }

  const replyMsg = (chatMessageId: string) => {
    const msg = getMessageFromCurrentChat({ chatMessageId })
    msg && emit('reply', msg)
  }

  const forwardMsg = (chatMessageId: string) => {
    const messageForwardDialog = defineAsyncComponent(() => import('../dialogs/message-forward-dialog.vue'))
    dialog.$openDialog({
      component: messageForwardDialog,
      componentProps: {},
      dialogProps: {
        cssClass: 'message-forward-dialog__wrapper',
        title: $tr('chat.message.forward.dialog.title'),
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
    })
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
    bus.$emitter.on('send:message', scrollList)
  })

  onBeforeUnmount(() => {
    bus.$emitter.off('send:message', scrollList)
  })

  watch(
    () => props.chat.chatId,
    async (value, oldValue) => {
      if (value !== oldValue) {
        setTimeout(() => {
          listElement.value!.scrollTop = 1e9
        }, 50)
      }
    },
    { immediate: true },
  )
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
