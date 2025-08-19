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
import { onBeforeMount, onBeforeUnmount } from 'vue';
import { onBeforeRouteUpdate } from 'vue-router';
import {
  Ui3nButton,
  Ui3nIcon,
  Ui3nDropFiles,
  Ui3nText,
  Ui3nHtml,
} from '@v1nt1248/3nclient-lib';
import { useChatView } from '@main/common/composables/useChatView';
import { useContactsStore } from '@main/common/store/contacts.store';
import { useRouting } from '@main/desktop/composables/useRouting';
import ChatHeader from '@main/desktop/components/chat/chat-header.vue';
import ChatMessages from '@main/common/components/messages/chat-messages/chat-messages.vue';
import ChatAttachment from '@main/common/components/chat/chat-attachment.vue';
import EmoticonsDialog from '@main/common/components/dialogs/emoticons-dialog.vue';

const vUi3nHtml = Ui3nHtml;

const { getContactName } = useContactsStore();

const {
  currentChat,
  currentChatMessages,
  disabled,
  readonly,
  isEmoticonsDialogOpen,
  msgText,
  inputEl,
  initialMessage,
  initialMessageType,
  textOfInitialMessage,
  attachmentsInfo,
  sendBtnDisabled,

  addFilesViaDnD,
  addFiles,
  prepareReplyMessage,
  onEmoticonSelect,
  clearInitialInfo,
  clearAttachments,
  deleteAttachment,
  sendMessage,
  doBeforeMount,
  doBeforeRouteUpdate,
  doBeforeUnMount,
  // @ts-ignore
} = useChatView(useRouting);

onBeforeMount(doBeforeMount);
onBeforeRouteUpdate(doBeforeRouteUpdate);
onBeforeUnmount(doBeforeUnMount);
</script>

<template>
  <section :class="$style.chat">
    <chat-header
      v-if="currentChat"
      :class="$style.chatHeader"
      :chat="currentChat!"
      :messages="currentChatMessages"
    />

    <div :class="$style.bodyWrapper">
      <ui3n-drop-files @select="addFilesViaDnD">
        <div :class="$style.body">
          <div :class="$style.messages">
            <chat-messages
              v-if="currentChatMessages && currentChat"
              :chat="currentChat!"
              :messages="currentChatMessages"
              @reply="prepareReplyMessage"
            />
          </div>

          <div :class="$style.input">
            <div :class="$style.emoticonsBtnWrapper">
              <ui3n-button
                type="icon"
                color="transparent"
                icon="outline-insert-emoticon"
                icon-size="20"
                icon-color="var(--color-icon-block-secondary-default)"
                :disabled="disabled || readonly"
                @click.stop.prevent="isEmoticonsDialogOpen = !isEmoticonsDialogOpen"
              />

              <emoticons-dialog
                :open="isEmoticonsDialogOpen"
                @close="isEmoticonsDialogOpen = false"
                @select="onEmoticonSelect"
              />
            </div>

            <ui3n-button
              type="icon"
              color="transparent"
              icon="round-attach-file"
              icon-size="20"
              icon-color="var(--color-icon-block-secondary-default)"
              :disabled="disabled || readonly"
              @click="addFiles"
            />

            <div :class="$style.inputField">
              <ui3n-text
                v-model:text="msgText"
                :rows="1"
                :max-rows="3"
                :disabled="readonly"
                @init="inputEl = $event"
                @enter="sendMessage"
              />
            </div>

            <ui3n-button
              type="icon"
              color="transparent"
              icon="round-send "
              icon-size="20"
              :icon-color="!sendBtnDisabled ? 'var(--color-icon-block-accent-default)' : 'var(--color-icon-block-secondary-default)'"
              :disabled="sendBtnDisabled"
              @click="sendMessage(undefined, true)"
            />

            <div :class="$style.inputAdditional">
              <div
                v-if="initialMessage"
                :class="$style.inputInitial"
              >
                <div :class="$style.inputInitialIcon">
                  <ui3n-icon
                    icon="outline-reply"
                    width="24"
                    height="24"
                    :h-flip="initialMessageType === 'forward'"
                    color="var(--color-icon-block-accent-default)"
                  />
                </div>

                <div :class="$style.inputInitialData">
                  <div :class="$style.inputInitialUser">
                    {{ getContactName(initialMessage.sender) }}
                  </div>
                  <div
                    v-ui3n-html.sanitize="textOfInitialMessage"
                    :class="$style.inputInitialText"
                  />
                </div>

                <ui3n-button
                  :class="$style.attachmentsClear"
                  type="icon"
                  color="transparent"
                  size="small"
                  icon="round-close "
                  icon-size="16"
                  icon-color="var(--color-icon-control-secondary-default)"
                  @click="clearInitialInfo"
                />
              </div>

              <div
                v-if="attachmentsInfo"
                :class="$style.attachments"
              >
                <chat-attachment
                  v-for="(attachmentInfo, index) in attachmentsInfo!"
                  :key="`${attachmentInfo.name}-${attachmentInfo.id || ''}`"
                  :name="attachmentInfo.name"
                  :size="attachmentInfo.size"
                  :deletable="true"
                  @delete="deleteAttachment(index)"
                />

                <ui3n-button
                  :class="$style.attachmentsClear"
                  type="icon"
                  color="transparent"
                  icon="round-close "
                  icon-size="16"
                  icon-color="#828282"
                  @click="clearAttachments"
                />
              </div>
            </div>
          </div>
        </div>
      </ui3n-drop-files>
    </div>
  </section>
</template>

<style lang="scss" module>
@use '../../../common/assets/styles/mixins' as mixins;

.chat {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-chat-bubble-general-bg);
}

.chatHeader {
  margin-bottom: var(--space-s);
}

.bodyWrapper {
  position: relative;
  width: 100%;
  height: calc(100% - 64px);
}

.body {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: stretch;
  row-gap: var(--spacing-xs);
}

.messages {
  position: relative;
  width: 100%;
  flex-basis: calc(100% - 68px);
  overflow-y: auto;
}

.input {
  position: relative;
  width: 100%;
  display: flex;
  padding: var(--spacing-m);
  justify-content: center;
  align-items: center;
  max-height: calc(var(--spacing-s) * 11);
  flex-grow: 1;
  background-color: var(--color-bg-block-primary-default);
}

.emoticonsBtnWrapper {
  position: relative;
}

.inputField {
  position: relative;
  width: 55%;
  margin: 0 var(--spacing-m);
}

.inputAdditional {
  position: absolute;
  background-color: var(--color-bg-block-primary-default);
  left: 0;
  width: 100%;
  bottom: calc(100% + 1px);
}

.attachments {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  flex-wrap: wrap;
  padding: var(--spacing-s) var(--spacing-m) var(--spacing-xs);
}

.attachmentsClear {
  position: absolute !important;
  top: 2px;
  right: 2px;
}

.inputInitial {
  display: flex;
  height: var(--spacing-xl);
  padding: var(--spacing-xs) 2px var(--spacing-xs) var(--spacing-s);
  justify-content: flex-start;
  align-items: center;
}

.inputInitialIcon {
  position: relative;
  min-width: var(--spacing-l);
  width: var(--spacing-l);
  min-height: var(--spacing-l);
  height: var(--spacing-l);
  display: flex;
  justify-content: center;
  align-items: center;
  border-right: 3px solid var(--color-icon-block-accent-default);
}

.inputInitialData {
  position: relative;
  width: calc(100% - var(--spacing-s) * 7);
  padding: 0 var(--spacing-xs);
}

.inputInitialUser {
  position: relative;
  width: 100%;
  font-size: var(--font-12);
  font-weight: 500;
  line-height: var(--font-16);
  color: var(--color-icon-block-accent-default);
}

.inputInitialText {
  position: relative;
  font-size: var(--font-12);
  font-weight: 400;
  line-height: var(--font-16);
  color: var(--color-text-chat-bubble-other-quote);
  @include mixins.text-overflow-ellipsis();
}
</style>
