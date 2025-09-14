<!--
 Copyright (C) 2025 3NSoft Inc.

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
import { computed } from 'vue';
import isEmpty from 'lodash/isEmpty';
import { getFileExtension, isFileImage, isFileVideo, isFileAudio } from '@v1nt1248/3nclient-lib/utils';
import type { ChatMessageAttachmentsInfo, RegularMsgView } from '~/index';
import type { AttachmentViewInfo } from './types';
import ChatMessageAttachment from './chat-message-attachment.vue';

const props = defineProps<{
  message: RegularMsgView;
  disabled: boolean;
}>();
const emits = defineEmits<{
  (event: 'click:right', value: MouseEvent): void;
}>();

const attachments = computed<AttachmentViewInfo[]>(() => {
  if (isEmpty(props.message.attachments)) {
    return [] as AttachmentViewInfo[];
  }

  return props.message.attachments!.map(i => {
    const lastDotPosition = i.name.lastIndexOf('.');
    const ext = getFileExtension(i.name);
    const data: AttachmentViewInfo = {
      ...i,
      filename: i.name.slice(0, lastDotPosition),
      ext,
      id: i.id || i.name,
      isActionAvailable: isActionAvailableForFile(i) || ext === 'pdf',
    };
    return data;
  });
});

function isActionAvailableForFile(item: ChatMessageAttachmentsInfo) {
  const { name } = item;
  return isFileImage({ fullName: name })
    || isFileVideo({ fullName: name })
    || isFileAudio({ fullName: name });
}
</script>

<template>
  <div :class="[$style.chatMessageAttachments, disabled && $style.disabled]">
    <template
      v-for="item in attachments"
      :key="item.id"
    >
      <chat-message-attachment
        :item="item"
        :incoming-msg-id="message.incomingMsgId"
        @click.right="emits('click:right', $event)"
      />
    </template>
  </div>
</template>

<style lang="scss" module>
.chatMessageAttachments {
  position: relative;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  row-gap: var(--spacing-xs);

  &.disabled {
    opacity: 0.5;
  }
}
</style>
