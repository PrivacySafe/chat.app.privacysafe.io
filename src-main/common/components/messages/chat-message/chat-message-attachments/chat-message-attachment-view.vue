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
<script setup lang="ts">
import { inject } from 'vue';
import { storeToRefs } from 'pinia';
import { I18N_KEY, NOTIFICATIONS_KEY } from '@v1nt1248/3nclient-lib/plugins';
import { isFileImage, isFileVideo, isFileAudio } from '@v1nt1248/3nclient-lib/utils';
import { useAppStore } from '@main/common/store/app.store';
import type { AttachmentViewInfo } from '@main/common/components/messages/chat-message/chat-message-attachments/types';
import { saveFileFromMsg } from '@main/common/utils/files.helper';
import { Ui3nButton, Ui3nTooltip } from '@v1nt1248/3nclient-lib';
import ImageView from './attachment-image-view.vue';
import PdfView from './attachment-pdf-view.vue';
import VideoView from './attachment-video-view/attachment-video-view.vue';
import AudioView from './attachment-audio-view/attachment-audio-view.vue';

const props = defineProps<{
  item: AttachmentViewInfo;
  incomingMsgId?: string;
}>();
const emits = defineEmits<{
  (event: 'close'): void;
}>();

const { $tr } = inject(I18N_KEY)!;
const { $createNotice } = inject(NOTIFICATIONS_KEY)!;

const { isMobileMode } = storeToRefs(useAppStore());

async function downloadFile() {
  const res = await saveFileFromMsg(props.item.id!, $tr, props.incomingMsgId);
  $createNotice({
    type: res ? 'success' : 'error',
    content: res ? $tr('chat.message.file.download.success') : $tr('chat.message.file.download.error'),
    duration: 3000,
  });
}

function showError() {
  $createNotice({
    type: 'error',
    content: $tr('The file may have been deleted or moved'),
    duration: 3000,
  });

  emits('close');
}
</script>

<template>
  <div :class="[$style.chatMessageAttachmentView, isMobileMode && $style.mobile]">
    <div :class="$style.actions">
      <ui3n-tooltip
        :content="$tr('chat.view.btn.download')"
        position-strategy="fixed"
        placement="bottom-end"
      >
        <ui3n-button
          type="icon"
          color="var(--color-bg-block-primary-default)"
          icon="outline-file-download"
          icon-size="24"
          icon-color="var(--color-icon-table-primary-default)"
          @click.stop.prevent="downloadFile"
        />
      </ui3n-tooltip>

      <ui3n-tooltip
        :content="$tr('chat.view.btn.exit')"
        position-strategy="fixed"
        placement="bottom-end"
      >
        <ui3n-button
          type="icon"
          color="var(--color-bg-block-primary-default)"
          icon="round-close"
          icon-size="24"
          icon-color="var(--color-icon-table-primary-default)"
          @click.stop.prevent="emits('close')"
        />
      </ui3n-tooltip>
    </div>

    <image-view
      v-if="isFileImage({ fullName: item.name })"
      :item="item"
      :incoming-msg-id="incomingMsgId"
      :is-mobile-mode="isMobileMode"
      @error="showError"
    />

    <pdf-view
      v-else-if="item.ext === 'pdf'"
      :item="item"
      :incoming-msg-id="incomingMsgId"
      :is-mobile-mode="isMobileMode"
      @error="showError"
    />

    <video-view
      v-else-if="isFileVideo({ fullName: item.name })"
      :item="item"
      :incoming-msg-id="incomingMsgId"
      :is-mobile-mode="isMobileMode"
      @error="showError"
    />

    <audio-view
      v-else-if="isFileAudio({ fullName: item.name })"
      :item="item"
      :incoming-msg-id="incomingMsgId"
      :is-mobile-mode="isMobileMode"
      @error="showError"
    />
  </div>
</template>

<style lang="scss" module>
.chatMessageAttachmentView {
  position: fixed;
  inset: 0;
  z-index: 5000;
  background-color: var(--color-bg-block-primary-default);

  &.mobile {
    .actions {
      top: var(--spacing-xs);
    }
  }
}

.actions {
  position: fixed;
  top: var(--spacing-s);
  right: var(--spacing-s);
  z-index: 5100;
  display: flex;
  justify-content: center;
  align-items: center;
  column-gap: var(--spacing-s);
}
</style>
