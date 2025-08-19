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
import { computed, onBeforeUnmount, onMounted } from 'vue';
import size from 'lodash/size';
import { useInCalls } from '@video/common/composables/use-in-calls';
import { Ui3nButton } from '@v1nt1248/3nclient-lib';
import OwnVideo from '@video/common/components/own-video.vue';
import PeerVideo from '@video/common/components/peer-video.vue';

const { ownName, isGroupChat, peerVideos, doOnMounted, doBeforeUnmount, streams, toggleMicStatus, toggleCamStatus,
  endCall } =
  useInCalls();

const peersNumber = computed(() => size(peerVideos.value) + 1);

const participantColumnsNumber = computed(() => {
  if (peersNumber.value <= 3) {
    return 1;
  }

  return 2;
});
const participantRowsNumber = computed(() => Math.ceil(peersNumber.value / participantColumnsNumber.value));

const gapInUiBetweenParticipants = 8;
const cssGapInUiBetweenParticipants = computed(() => `${gapInUiBetweenParticipants}px`);

const participantBlockWidth = computed(() => `calc((100% - ${participantColumnsNumber.value - 1} * ${gapInUiBetweenParticipants}px) / ${participantColumnsNumber.value})`);
const participantBlockHeight = computed(() => `calc((100% - ${participantRowsNumber.value - 1} * ${gapInUiBetweenParticipants}px) / ${participantRowsNumber.value})`);

onMounted(doOnMounted);
onBeforeUnmount(doBeforeUnmount);
</script>

<template>
  <div :class="[$style.call, !isGroupChat && $style.callOneToOne]">
    <div :class="[$style.participant, $style.participantOwn]">
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
      :class="[$style.participant, $style.participantOther]"
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

    <div :class="$style.actions">
      <div :class="$style.actionGroup">
        <div :class="$style.empty" />
      </div>

      <div :class="$style.actionGroup">
        <ui3n-button
          type="icon"
          color="var(--color-bg-block-primary-default)"
          :icon="streams.isMicOn ? 'round-mic-none' : 'round-mic-off'"
          icon-color="var(--color-icon-button-tritery-default)"
          @click.stop.prevent="toggleMicStatus"
        />

        <ui3n-button
          type="icon"
          color="var(--color-bg-block-primary-default)"
          :icon="streams.isCamOn ? 'outline-videocam' : 'outline-videocam-off'"
          icon-color="var(--color-icon-button-tritery-default)"
          @click.stop.prevent="toggleCamStatus"
        />
      </div>

      <div :class="$style.actionGroup">
        <ui3n-button
          type="icon"
          color="var(--error-content-default)"
          icon="round-phone-disabled"
          icon-color="var(--error-fill-default)"
          icon-position="left"
          @click.stop.prevent="endCall"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" module>
.call {
  --call-actions-height: 64px;
  --gap-in-ui-between-participants: v-bind(cssGapInUiBetweenParticipants);
  --participant-block-width: v-bind(participantBlockWidth);
  --participant-block-height: v-bind(participantBlockHeight);

  position: fixed;
  inset: 0;
  padding-bottom: var(--call-actions-height);
  background-color: var(--color-bg-control-secondary-default);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--gap-in-ui-between-participants);

  &.callOneToOne {
    padding-bottom: 0;

    .participantOther {
      display: flex;
      width: 100%;
      height: 100%;
      justify-content: center;
      align-items: stretch;

      video {
        display: block;
        object-fit: cover;
        object-position: center;
        width: 100%;
      }
    }

    .participantOwn {
      position: absolute;
      width: 120px;
      height: 180px;
      right: var(--spacing-s);
      bottom: 96px;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: stretch;
      z-index: 1;
      background-color: var(--color-bg-control-secondary-default);
      border: 1px solid var(--color-border-control-secondary-disabled);
      border-radius: var(--spacing-s);

      video {
        display: block;
        object-fit: cover;
        object-position: center;
        width: 100%;
      }
    }

    .actions {
      bottom: var(--spacing-m);
      background-color: transparent;
      justify-content: center;
      column-gap: var(--spacing-ml);

      .actionGroup {
        column-gap: var(--spacing-ml);
      }
    }

    .empty {
      display: none;
    }
  }
}

.participant {
  position: relative;
  width: var(--participant-block-width);
  height: var(--participant-block-height);
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
  background-color: var(--color-bg-block-primary-default);
}

.actionGroup {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  column-gap: var(--spacing-s);
}

.empty {
  position: relative;
  width: var(--spacing-l);
  min-width: var(--spacing-l);
  height: var(--spacing-l);
  min-height: var(--spacing-l);
}
</style>
