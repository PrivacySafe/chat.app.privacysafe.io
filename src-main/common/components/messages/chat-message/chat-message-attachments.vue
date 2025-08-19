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
import type { ChatMessageAttachmentsInfo } from '~/index.ts';
import { Ui3nIcon } from '@v1nt1248/3nclient-lib';

const props = defineProps<{
  attachments?: ChatMessageAttachmentsInfo[];
  disabled: boolean;
}>();

const items = computed(() => {
  if (isEmpty(props.attachments)) {
    return [];
  }

  return props.attachments!.map(i => {
    const lastDotPosition = i.name.lastIndexOf('.');
    return {
      filename: i.name.slice(0, lastDotPosition),
      ext: i.name.slice(lastDotPosition + 1),
    };
  });
});
</script>

<template>
  <div :class="[$style.chatMessageAttachments, disabled && $style.disabled]">
    <div
      v-for="(item, index) in items"
      :key="index"
      :class="$style.chatMessageAttachment"
    >
      <ui3n-icon
        :class="$style.icon"
        icon="round-attach-file"
        width="16"
        height="16"
      />
      <div :class="$style.chatMessageAttachmentName">
        {{ item.filename }}
      </div>
      <div :class="$style.chatMessageAttachmentExt">
        .{{ item.ext }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
@use '@main/common/assets/styles/mixins' as mixins;

.chatMessageAttachments {
  --attachments-item-height: calc(var(--spacing-s) * 2.5);

  position: relative;
  max-width: 100%;

  &.disabled {
    opacity: 0.5;
  }
}

.chatMessageAttachment {
  position: relative;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  height: var(--attachments-item-height);
  font-size: var(--font-14);
  font-weight: 400;
  color: var(--color-text-chat-bubble-user-default);
}

.icon {
  position: relative;
  left: -4px;
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
