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
import { computed, inject, ref } from 'vue';
import { isFileAudio, isFileImage, isFileVideo } from '@v1nt1248/3nclient-lib/utils';
import { Ui3nIcon, Ui3nProgressCircular, type Nullable } from '@v1nt1248/3nclient-lib';
import type { Task } from '~/index';
import { createPdfThumbnail } from '@main/common/utils/create-thumbnail/create-pdf-thumbnail';
import { createImageThumbnail } from '@main/common/utils/create-thumbnail/create-image-thumbnail';
import { createVideoThumbnail } from '@main/common/utils/create-thumbnail/create-video-thumbnail';
import { useOpenAttachment } from './useOpenAttachment';
import type { AttachmentViewInfo } from './types';
import ChatMessageAttachmentView from './chat-message-attachment-view.vue';

const props = defineProps<{
  item: AttachmentViewInfo;
  incomingMsgId?: string;
}>();

const { addTask } = inject('task-runner') as { addTask: (task: Task) => void };

const { openEntity } = useOpenAttachment(props);

const thumbnail = ref<Nullable<string>>(null);
const isThumbnailCreationProcessGoingOn = ref(false);
const isViewOpen = ref(false);

const attachmentsItemPreviewSize = 96;
const attachmentsItemPreviewSizeCss = computed(() => `${attachmentsItemPreviewSize}px`);

const isThumbnailAvailable = computed(() => isFileImage({ fullName: props.item.name })
  || isFileVideo({ fullName: props.item.name })
  || props.item.ext === 'pdf'
);
const previewStyle = computed(() => {
  if (!isThumbnailAvailable.value || !thumbnail.value) {
    return {};
  }

  return {
    backgroundImage: `url('${thumbnail.value}')`,
  }
});

async function onAttachmentElementClick() {
  if (props.item.isActionAvailable) {
    isViewOpen.value = true;
    return;
  }

  if (!props.incomingMsgId) {
    await openEntity();
  }
}

async function makeThumbnailTask() {
  const { ext } = props.item;

  try {
    if (isFileImage({ fullName: props.item.name })) {
      thumbnail.value = await createImageThumbnail({
        fileId: props.item.id!,
        incomingMsgId: props.incomingMsgId,
      });
    } else if (isFileVideo({ fullName: props.item.name })) {
      thumbnail.value = await createVideoThumbnail({
        fileId: props.item.id!,
        incomingMsgId: props.incomingMsgId,
      });
    } else if (ext === 'pdf') {
      thumbnail.value = await createPdfThumbnail({
        fileId: props.item.id!,
        incomingMsgId: props.incomingMsgId,
      });
    }
  } catch (e) {
    w3n.log('error', `The thumbnail making error for the file ${props.item.name}.`, e)
  } finally {
    isThumbnailCreationProcessGoingOn.value = false;
  }
}

async function makeThumbnail() {
  if (!isThumbnailAvailable.value) {
    return;
  }

  isThumbnailCreationProcessGoingOn.value = true;
  addTask(makeThumbnailTask);
}

makeThumbnail();
</script>

<template>
  <div
    :class="[$style.chatMessageAttachment, item.isActionAvailable && $style.chatMessageAttachmentClickable]"
    @click.stop.prevent="onAttachmentElementClick"
  >
    <div
      v-if="isThumbnailAvailable"
      :class="$style.previewWrap"
    >
      <div
        :class="$style.preview"
        :style="previewStyle"
      >
        <ui3n-progress-circular
          v-if="isThumbnailCreationProcessGoingOn"
          indeterminate
          :size="attachmentsItemPreviewSize / 4 * 3"
        />

        <ui3n-icon
          v-if="!isThumbnailCreationProcessGoingOn && !thumbnail"
          icon="file-remove-outline"
          :size="attachmentsItemPreviewSize / 5 * 4"
        />
      </div>
    </div>

    <div
      v-else
      :class="$style.icon"
    >
      <ui3n-icon
        v-if="isFileAudio({ fullName: item.name })"
        icon="sound-wave-circle"
        size="24"
      />

      <ui3n-icon
        v-else-if="item.isFolder"
        icon="round-folder"
        size="24"
      />

      <ui3n-icon
        v-else-if="item.ext === 'zip'"
        icon="file-zip"
        size="24"
      />

      <ui3n-icon
        v-else
        :class="$style.icon"
        icon="round-attach-file"
        size="24"
      />
    </div>

    <div :class="$style.chatMessageAttachmentName">
      {{ item.isFolder ? item.name : item.filename }}
    </div>

    <div
      v-if="!item.isFolder"
      :class="$style.chatMessageAttachmentExt"
    >
      .{{ item.ext }}
    </div>

    <teleport to="body">
      <chat-message-attachment-view
        v-if="isViewOpen"
        :item="item"
        :incoming-msg-id="incomingMsgId"
        @close="isViewOpen = false"
      />
    </teleport>
  </div>
</template>

<style lang="scss" module>
@use '@main/common/assets/styles/mixins' as mixins;

.chatMessageAttachment {
  --attachments-item-min-height: 20px;
  --attachments-item-preview-size: v-bind(attachmentsItemPreviewSizeCss);

  position: relative;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  min-height: var(--attachments-item-min-height);
  font-size: var(--font-14);
  font-weight: 400;
  color: var(--color-text-chat-bubble-user-default);

  //&.chatMessageAttachmentClickable {
    pointer-events: all;

    &:hover {
      color: var(--color-text-chat-bubble-user-sub);

      :global(.ui3n-icon) {
        --ui3n-icon-color: var(--color-icon-chat-bubble-user-quote);
      }
    }
  //}
}

.previewWrap {
  position: relative;
  padding-right: var(--spacing-s);
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.preview {
  position: relative;
  min-width: var(--attachments-item-preview-size);
  width: var(--attachments-item-preview-size);
  height: var(--attachments-item-preview-size);
  border-radius: var(--spacing-xs);
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  display: flex;
  justify-content: center;
  align-items: center;
}

.icon {
  position: relative;
  padding-right: var(--spacing-xs);
}

.chatMessageAttachmentName {
  position: relative;
  height: var(--attachments-item-height);
  text-align: left;
  flex-shrink: 1;
  line-height: var(--font-20);
  @include mixins.text-overflow-ellipsis();
}

.chatMessageAttachmentExt {
  flex-shrink: 0;
  line-height: var(--font-20);
}
</style>
