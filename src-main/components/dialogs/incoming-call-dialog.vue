<!--
 Copyright (C) 2024 3NSoft Inc.

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
import { computed, inject, onBeforeUnmount, onMounted } from 'vue';
import { I18N_KEY, I18nPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { Ui3nButton } from '@v1nt1248/3nclient-lib';
import { videoOpenerSrv } from '@main/services/services-provider';
import { getContactName } from '@main/utils/contacts.helper';
import ChatAvatar from '../chat/chat-avatar.vue';
import { Sound } from '@shared/sounds';

interface IncomingCallDialogProps {
  chatId: string;
  peerAddress: string;
}

interface IncomingCallDialogEmits {
  (ev: 'close'): void;
}

const props = defineProps<IncomingCallDialogProps>();

const emits = defineEmits<IncomingCallDialogEmits>();

const { $tr } = inject<I18nPlugin>(I18N_KEY)!;

const user = computed(() => getContactName(props.peerAddress));

async function joinCall() {
  await videoOpenerSrv.joinCallInRoom({ chatId: props.chatId, peerAddress: props.peerAddress });
  emits('close');
}

let ring: Sound|undefined = undefined;
const ringFileUrl = `/sounds/ring_tone.mp3`;

onMounted(async () => {
  ring = await Sound.from(ringFileUrl);
  ring.playInLoop();
});

onBeforeUnmount(() => {
  ring?.stop();
})

</script>

<template>
  <div :class="$style.incomingCallDialog">
    <div :class="$style.user">
      <chat-avatar
        :size="180"
        :name="user"
      />

      {{ user }}
    </div>

    <div :class="$style.text">
      {{ $tr('chat.incoming.dialog.title') }} ...
    </div>

    <div :class="$style.actions">
      <ui3n-button
        type="icon"
        color="var(--error-content-default)"
        icon="round-call-end"
        @click="emits('close')"
      />

      <ui3n-button
        type="icon"
        color="var(--success-content-default)"
        icon="round-phone"
        @click="joinCall"
      />
    </div>
  </div>
</template>

<style lang="scss" module>
.incomingCallDialog {
  position: relative;
  height: 480px;
  padding: var(--spacing-m) var(--spacing-s) var(--spacing-l);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
}

.user {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
  gap: var(--spacing-m);
  padding-top: var(--spacing-m);
  font-size: var(--font-16);
  font-style: italic;
  font-weight: 600;
  color: var(--color-text-control-primary-default);
}

.text {
  text-align: center;
  font-size: var(--font-16);
  font-weight: 500;
  color: var(--color-text-control-primary-default);
}

.actions {
  display: flex;
  justify-content: center;
  align-items: center;
  column-gap: var(--spacing-xxl);

  button {
    min-width: var(--spacing-xxl) !important;
    width: var(--spacing-xxl) !important;
    height: var(--spacing-xxl);
  }
}
</style>
