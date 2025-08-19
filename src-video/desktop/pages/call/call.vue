<!--
 Copyright (C) 2024 - 2025 3NSoft Inc.

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
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { Ui3nButton } from '@v1nt1248/3nclient-lib';
import size from 'lodash/size';
import { useInCalls } from '@video/common/composables/use-in-calls';
import IconButton from '@video/desktop/components/icon-button.vue';
import OwnVideo from '@video/common/components/own-video.vue';
import PeerVideo from '@video/common/components/peer-video.vue';
import ViewSharedThings from '@video/desktop/components/view-shared-things.vue';

const {
  ownName,
  isFullscreen,
  peerSharedStreams,
  peerVideos,
  streams,
  openScreenShareChoice,
  toggleCamStatus,
  toggleFullscreen,
  toggleMicStatus,
  endCall,
  doBeforeUnmount,
  doOnMounted,
} = useInCalls();

const peersNumber = computed(() => size(peerVideos.value) + 1);
const peersShare = computed(() => (peerSharedStreams.value.length > 0));
const sharingOwnScreen = computed(() => !!streams.ownScreens);
const screenShare = computed(() => peersShare.value || sharingOwnScreen.value);
const sharedThings = computed(() => [...(streams.ownScreens || []), ...peerSharedStreams.value]);

const participantColumnsNumber = computed(() => {
  if (peersNumber.value <= 4) {
    return 2;
  }

  if (peersNumber.value <= 6) {
    return 3;
  }

  return 4;
});
const participantRowsNumber = computed(() => Math.ceil(peersNumber.value / participantColumnsNumber.value));

const gapInUiBetweenParticipants = 16;
const cssGapInUiBetweenParticipants = computed(() => `${gapInUiBetweenParticipants}px`);

const participantBlockWidth = computed(() => `calc((100% - ${participantColumnsNumber.value - 1} * ${gapInUiBetweenParticipants}px) / ${participantColumnsNumber.value})`);
const participantBlockHeight = computed(() => `calc((100% - ${participantRowsNumber.value - 1} * ${gapInUiBetweenParticipants}px) / ${participantRowsNumber.value})`);

onMounted(doOnMounted);
onBeforeUnmount(doBeforeUnmount);
</script>

<template>
  <section :class="$style.call">
    <template v-if="!screenShare">
      <div :class="$style.participant">
        <own-video
          :is-cam-on="streams.isCamOn"
          :stream="streams.ownVA!.stream"
          :user="ownName"
        />
      </div>

      <div
        v-for="peer in peerVideos"
        :key="peer.peerAddr"
        :class="$style.participant"
      >
        <peer-video
          :is-video-on="!peer.videoMuted"
          :is-audio-on="!peer.audioMuted"
          :stream="peer.vaStream"
          :peer-name="peer.peerName"
          :peer-addr="peer.peerAddr"
        />
      </div>
    </template>

    <div
      v-if="screenShare"
      :class="$style.body"
    >
      <div :class="$style.sharedScreens">
        <view-shared-things :things="sharedThings" />
      </div>

      <div :class="$style.list">
        <div :class="$style.participants">
          <div :class="$style.participantsItem">
            <own-video
              :is-cam-on="streams.isCamOn"
              :stream="streams.ownVA!.stream"
              :user="ownName"
              size="small"
            />
          </div>

          <div
            v-for="peer in peerVideos"
            :key="peer.peerAddr"
            :class="$style.participantsItem"
          >
            <peer-video
              :is-video-on="!peer.videoMuted"
              :is-audio-on="!peer.audioMuted"
              :stream="peer.vaStream"
              :peer-name="peer.peerName"
              :peer-addr="peer.peerAddr"
              size="small"
            />
          </div>
        </div>
      </div>
    </div>

    <div :class="$style.actions">
      <div :class="$style.actionGroup">
        <icon-button
          :icon="isFullscreen ? 'shrink' : 'expand-screen'"
          @click.stop.prevent="toggleFullscreen"
        />
      </div>

      <div :class="$style.actionGroup">
        <icon-button
          :icon="streams.isMicOn ? 'round-mic-none' : 'round-mic-off'"
          @click.stop.prevent="toggleMicStatus"
        />

        <icon-button
          :icon="streams.isCamOn ? 'outline-videocam' : 'outline-videocam-off'"
          @click.stop.prevent="toggleCamStatus"
        />

        <icon-button
          icon="outline-screen-share"
          @click.stop.prevent="openScreenShareChoice"
        />

        <icon-button
          v-if="streams.isGroupChat"
          icon="sharp-people"
          disabled
        />
      </div>

      <div :class="$style.actionGroup">
        <ui3n-button
          type="custom"
          color="var(--error-content-default)"
          text-color="var(--error-fill-default)"
          icon="round-phone-disabled"
          icon-color="var(--error-fill-default)"
          icon-position="left"
          @click.stop.prevent="endCall"
        >
          {{ $tr('va.end.call') }}
        </ui3n-button>
      </div>
    </div>
  </section>
</template>

<style lang="scss" module>
.call {
  --call-actions-height: 64px;
  --gap-in-ui-between-participants: v-bind(cssGapInUiBetweenParticipants);
  --participant-block-width: v-bind(participantBlockWidth);
  --participant-block-height: v-bind(participantBlockHeight);
  --participant-list-width: 192px;

  position: relative;
  width: 100%;
  height: 100%;
  padding: var(--spacing-m) var(--spacing-m) var(--call-actions-height) var(--spacing-m);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--gap-in-ui-between-participants);
}

.participant {
  position: relative;
  width: var(--participant-block-width);
  height: var(--participant-block-height);
}

.body {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  border-bottom: 1px solid var(--color-border-block-primary-default);
}

.sharedScreens {
  position: relative;
  width: calc(100% - var(--participant-list-width) - var(--spacing-s));
  height: 100%;
  border-right: 1px solid var(--color-border-block-primary-default);
}

.list {
  position: relative;
  width: var(--participant-list-width);
  height: 100%;
  padding: var(--spacing-s);
  overflow-y: auto;
}

.participants {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;
  row-gap: var(--spacing-s);
}

.participantsItem {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
}

.actions {
  position: absolute;
  left: 0;
  width: 100%;
  bottom: 0;
  height: var(--call-actions-height);
  padding: 0 var(--spacing-m);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.actionGroup {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  column-gap: var(--spacing-l);
}
</style>
