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
import { useStreamsStore } from '@video/store/streams.store';
import IconButton from "@video/components/icon-button.vue";
import VideoStream from "@video/components/video-stream.vue";

const streams = useStreamsStore();

const deskSoundShared = computed(() => streams.isSharingOwnDeskSound);
function stopDeskSoundSharing() {
  streams.setOwnDeskSoundSharing(false);
}

const sharedScreens = computed(() => streams.ownScreens!.filter(
  ({ type }) => (type === 'screen')
));
const sharedWindows = computed(() => streams.ownScreens!.filter(
  ({ type }) => (type === 'window')
));
function stopSharingOf(srcId: string) {
  streams.removeOwnScreen(srcId);
}

</script>

<template>
  <div :class=$style.ownSharedItems>
    <div
      v-if=deskSoundShared
    >
      🔊  Desktop sound
      <icon-button
        icon="round-close"
        :styleClass=$style.inline
        @click.stop.prevent=stopDeskSoundSharing
      />
    </div>

    <div
      v-for="screen in sharedScreens"
    >
      <video-stream
        :stream="screen.stream"
        :styleClass=$style.videoPreview
      />
      {{ screen.name }}
      <icon-button
        icon="round-close"
        :styleClass=$style.inline
        @click.stop.prevent="stopSharingOf(screen.srcId)"
      />
    </div>

    <div
      v-for="frame in sharedWindows"
    >
      <video-stream
        :stream="frame.stream"
        :styleClass=$style.videoPreview
      />
      {{ frame.name }}
      <icon-button
        icon="round-close"
        :styleClass=$style.inline
        @click.stop.prevent="stopSharingOf(frame.srcId)"
      />
    </div>
  </div>
</template>

<style lang="scss" module>

.ownSharedItems {
  color: var(--color-text-block-primary-default);
}

.videoPreview {
  width: 100px;
  height: 50px;
}

.inline {
  display: inline-block;
}

</style>