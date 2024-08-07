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
  import { computed, inject, onBeforeMount, ref, toRefs } from 'vue'
  import { useRoute, onBeforeRouteUpdate } from 'vue-router'
  import { get, isEmpty, size, without } from 'lodash'
  import {
    I18nPlugin,
    I18N_KEY,
    transformFileToWeb3NFile,
    Ui3nButton,
    Ui3nIcon,
    Ui3nDropFiles,
    Ui3nText,
    Ui3nHtml,
  } from '@v1nt1248/3nclient-lib'
  import { useAppStore, useChatsStore } from '../../store'
  import { getAttachmentFilesInfo, sendChatMessage } from '../../helpers/chats.helper'
  import { getContactName } from '../../helpers/contacts.helper'
  import ChatHeader from './chat-header.vue'
  import ChatMessages from '../messages/chat-messages.vue'
  import ChatAttachment from './chat-attachment.vue'
  import EmoticonsDialog from '../dialogs/emoticons-dialog.vue'

  const vUi3nHtml = Ui3nHtml

  const route = useRoute()
  const { $tr } = inject<I18nPlugin>(I18N_KEY)!
  const { user } = toRefs(useAppStore())
  const { currentChat, currentChatMessages } = toRefs(useChatsStore())
  const { getChat, getChatMessage } = useChatsStore()

  const chatName = computed<string>(() => {
    const value = currentChat.value()
    return get(value, 'name', '')
  })
  const readonly = computed(() => {
    const { members = [] } = currentChat.value() || {}
    return !members.includes(user.value)
  })

  const inputEl = ref<HTMLTextAreaElement | null>(null)
  const msgText = ref<string>('')
  const disabled = ref(false)
  let files: web3n.files.ReadonlyFile[] | undefined
  const attachmentsInfo = ref<ChatMessageAttachmentsInfo[] | null>(null)
  const initialMessage = ref<ChatMessageView<MessageType> | null>(null)
  const initialMessageType = ref<'reply'|'forward'>('reply')
  const isEmoticonsDialogOpen = ref(false)

  const sendBtnDisabled = computed<boolean>(() => {
    return !(msgText.value.trim() || attachmentsInfo.value) || disabled.value
  })
  const textOfInitialMessage = computed(() => {
    if (!initialMessage.value) {
      return ''
    }

    const { body, attachments } = initialMessage.value || {}
    const attachmentsText = (attachments || []).map(a => a.name).join(', ')
    return body || `<i>${$tr('text.receive.file')}: ${attachmentsText}</i>`
  })

  function onEmoticonSelect(emoticon: { id: string, value: string }) {
    msgText.value += emoticon.value
  }

  async function prepareInfoFromForwardingMessage(initialMsgId?: string) {
    if (initialMsgId) {
      const msg = await getChatMessage({ chatMessageId: initialMsgId })
      if (msg) {
        initialMessageType.value = 'forward'
        initialMessage.value = msg
        inputEl.value!.focus()
      }
    }
  }

  async function addFiles(): Promise<void> {
    files = await w3n.shell?.fileDialogs?.openFileDialog!('Select file(s)', '', true)
    if (!isEmpty(files)) {
      attachmentsInfo.value = await getAttachmentFilesInfo({ files })
    }
  }

  const addFilesViaDnD = async (fileList: FileList): Promise<void> => {
    files = []
    // @ts-ignore
    for (const f of [...fileList]) {
      const file = await transformFileToWeb3NFile(f)
      if (file) {
        files.push(file)
      }
      if (!isEmpty(files)) {
        attachmentsInfo.value = await getAttachmentFilesInfo({ files })
      }
    }
  }

  async function deleteAttachment(index: number) {
    files && files.splice(index, 1)
    attachmentsInfo.value = await getAttachmentFilesInfo({ files })
    if (size(attachmentsInfo.value) === 0) {
      attachmentsInfo.value = null
    }
  }

  function clearAttachments() {
    files = undefined
    attachmentsInfo.value = null
  }

  function clearInitialInfo() {
    initialMessage.value = null
  }

  function prepareReplyMessage(msg: ChatMessageView<MessageType>) {
    initialMessageType.value = 'reply'
    initialMessage.value = msg
    inputEl.value!.focus()
  }

  async function sendMessage(ev: Event|KeyboardEvent, force = false) {
    const chatMembers = currentChat.value()?.members || []
    if (disabled.value || readonly.value || !chatMembers.includes(user.value)) {
      return
    }

    const { key, shiftKey } = ev as KeyboardEvent
    ev.preventDefault()
    ev.stopImmediatePropagation()
    if (!force && key === 'Enter' && shiftKey) {
      msgText.value += '\n'
    } else if (force || (!force && key === 'Enter' && !shiftKey)) {
      const { chatId } = route.params as { chatId: string }
      const chatAdmins = currentChat.value()?.admins || []
      const recipients = without(chatMembers, user.value)

      if (recipients.length) {
        disabled.value = true
        sendChatMessage({
          chatId,
          chatName: size(chatMembers) > 2 ? chatName.value : '',
          text: (msgText.value || '').trim(),
          recipients,
          chatMembers,
          chatAdmins,
          ...(initialMessage.value && {
            initialMessageId: initialMessage.value!.chatMessageId,
          }),
          files: files,
        })

        setTimeout(() => {
          msgText.value = ''
          files = undefined
          attachmentsInfo.value = null
          initialMessage.value = null
          disabled.value = false
        }, 400)
      }
    }
  }

  onBeforeMount(async () => {
    const { chatId } = route.params as { chatId: string }
    chatId && await getChat(chatId)
    const { initialMsgId } = route.query as { initialMsgId?: string }
    await prepareInfoFromForwardingMessage(initialMsgId)
  })

  onBeforeRouteUpdate(async (to, from, next) => {
    const chatIdFrom = from.params.chatId as string
    const chatIdTo = to.params.chatId as string
    if (chatIdTo && chatIdTo !== chatIdFrom) {
      await getChat(chatIdTo)
      msgText.value = ''

      const { initialMsgId } = to.query as { initialMsgId?: string }
      await prepareInfoFromForwardingMessage(initialMsgId)
    }
    next()
  })
</script>

<template>
  <div class="chat">
    <chat-header
      v-if="currentChat()"
      :chat="currentChat()!"
      :messages="currentChatMessages"
    />

    <section class="chat__messages">
      <ui3n-drop-files
        @select="addFilesViaDnD"
      >
        <chat-messages
          v-if="currentChatMessages && currentChat()"
          :chat="currentChat()!"
          :messages="currentChatMessages"
          @reply="prepareReplyMessage"
        />
      </ui3n-drop-files>
    </section>

    <div class="chat__input">
      <div style="position: relative">
        <ui3n-button
          round
          color="transparent"
          icon="emoticon"
          icon-size="20"
          icon-color="#b3b3b3"
          class="chat__input-emoji"
          :disabled="disabled || readonly"
          @click.stop.prevent="isEmoticonsDialogOpen = true"
        />

        <emoticons-dialog
          :open="isEmoticonsDialogOpen"
          @close="isEmoticonsDialogOpen = false"
          @select="onEmoticonSelect"
        />
      </div>

      <ui3n-button
        round
        color="transparent"
        icon="attach-file"
        icon-size="20"
        icon-color="#b3b3b3"
        class="chat__input-file"
        :disabled="disabled || readonly"
        @click="addFiles"
      />

      <ui3n-text
        v-model:text="msgText"
        type="textarea"
        :rows="1"
        :max-rows="3"
        :disabled="readonly"
        class="chat__input-field"
        @init="inputEl = $event"
        @keydown.enter="sendMessage"
      />

      <ui3n-button
        round
        color="transparent"
        icon="send"
        icon-size="20"
        :icon-color="!sendBtnDisabled ? '#0090ec' : '#b3b3b3'"
        class="chat__input-send"
        :disabled="sendBtnDisabled"
        @click="sendMessage($event, true)"
      />

      <div class="chat__input-additional">
        <div
          v-if="initialMessage"
          class="chat__input-initial"
        >
          <div class="chat__input-initial-icon">
            <ui3n-icon
              icon="reply"
              width="24"
              height="24"
              :h-flip="initialMessageType === 'forward'"
              color="var(--blue-main)"
            />
          </div>

          <div class="chat__input-initial-data">
            <div class="chat__input-initial-user">
              {{ getContactName(initialMessage.sender) }}
            </div>
            <div
              v-ui3n-html.sanitize="textOfInitialMessage"
              class="chat__input-initial-text"
            />
          </div>

          <ui3n-button
            class="chat__input-initial-clear"
            round
            icon="close"
            icon-size="16"
            icon-color="#828282"
            @click="clearInitialInfo"
          />
        </div>

        <div
          v-if="attachmentsInfo"
          class="chat__input-attachments"
        >
          <chat-attachment
            v-for="(attachmentInfo, index) in attachmentsInfo!"
            :key="index"
            :name="attachmentInfo.name"
            :size="attachmentInfo.size"
            :deletable="true"
            @delete="deleteAttachment(index)"
          />

          <ui3n-button
            class="chat__input-attachments-clear"
            color="transparent"
            round
            icon="close"
            icon-size="16"
            icon-color="#828282"
            @click="clearAttachments"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  @import "../../assets/styles/mixins";

  .chat {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--blue-main-20);

    .chat-header {
      margin-bottom: var(--base-size);
    }

    &__messages {
      position: relative;
      width: 100%;
      flex-basis: calc(100% - var(--base-size) * 6);
      overflow-y: auto;
    }

    &__input {
      --button-default-color: transpatent;
      --button-disabled-color: transpatent;
      --button-normal-height: 32px;

      position: relative;
      width: 100%;
      display: flex;
      padding: var(--base-size) calc(var(--base-size) * 2);
      justify-content: center;
      align-items: center;
      max-height: calc(var(--base-size) * 11);
      flex-grow: 1;
      background-color: var(--system-white);
      margin-top: var(--base-size);

      .var-button {
        box-shadow: none;
        min-height: var(--button-normal-height);
        max-height: var(--button-normal-height);
        min-width: var(--button-normal-height);
        max-width: var(--button-normal-height);
        margin: 0 calc(var(--base-size) / 2);
      }

      &-field {
        max-width: 55%;
        margin: 0 calc(var(--base-size) * 2);
      }

      &-additional {
        position: absolute;
        background-color: var(--system-white);
        left: 0;
        width: 100%;
        bottom: calc(100% + 1px);
      }

      &-attachments {
        --button-normal-height: 24px;
        --button-round-padding: 2px;

        position: relative;
        display: flex;
        justify-content: flex-start;
        align-items: flex-start;
        flex-wrap: wrap;
        padding: var(--base-size) calc(var(--base-size) * 2) var(--half-size);

        &-clear {
          position: absolute;
          top: 2px;
          right: 2px;
        }
      }

      &-initial {
        --button-normal-height: 24px;
        --button-round-padding: 2px;

        display: flex;
        height: calc(var(--base-size) * 5);
        padding: var(--half-size) calc(var(--half-size) / 2) var(--half-size) var(--base-size);
        justify-content: flex-start;
        align-items: center;

        &-icon {
          position: relative;
          min-width: calc(var(--base-size) * 4);
          width: calc(var(--base-size) * 4);
          min-height: calc(var(--base-size) * 4);
          height: calc(var(--base-size) * 4);
          display: flex;
          justify-content: center;
          align-items: center;
          border-right: 3px solid var(--blue-main);
        }

        &-data {
          position: relative;
          width: calc(100% - var(--base-size) * 7);
          padding: 0 var(--half-size);
        }

        &-user {
          position: relative;
          width: 100%;
          font-size: var(--font-12);
          font-weight: 500;
          line-height: var(--font-16);
          color: var(--blue-main);
        }

        &-text {
          position: relative;
          font-size: var(--font-12);
          font-weight: 400;
          line-height: var(--font-16);
          color: var(--black-90);
          @include text-overflow-ellipsis();
        }
      }
    }
  }
</style>
