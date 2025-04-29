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
import { computed, onBeforeUnmount, onMounted, useCssModule } from 'vue';
import { Ui3nButton } from '@v1nt1248/3nclient-lib';
import { useCommonCallElements, useGroupCall, useCall } from './use-in-calls';
import IconButton from "@video/components/icon-button.vue";
import OwnVideo from "@video/components/own-video.vue";
import PeerVideo from "@video/components/peer-video.vue";
import PeerSharing from "@video/components/peer-sharing.vue";
import OwnSharing from "@video/components/own-sharing.vue";

const {
  ownName,
  isFullscreen,
  peerSharedStreams,
  peerVideos,
  streams: {
    isGroupChat, ownScreens, isCamOn, isMicOn, ownVA
  },
  openScreenShareChoice,
  toggleCamStatus,
  toggleFullscreen,
  toggleMicStatus,
  doBeforeUnmount,
  doOnMounted
} = useCommonCallElements();

const {
  endCall
} = (isGroupChat ? useGroupCall() : useCall());

const peersShare = computed(() => (peerSharedStreams.value.length > 0));
const ownSharing = computed(() => !!ownScreens);
const screenShare = computed(() => (
  peersShare.value || ownSharing.value
));

const classes = useCssModule();
const videoWhenNoScreens = computed(() => {
  const num = peerVideos.value.length + 1;
  if (num === 2) {
    return classes.twoParties;
  } else if ((num === 3) || (num === 4)) {
    return classes.threePlus;
  } else if ((num >= 5) && (num < 7)) {
    return classes.fivePlus;
  } else if ((num >= 7) && (num < 10)) {
    return classes.sevenPlus;
  } else {
    return classes.sevenPlus;
  }
});

onMounted(doOnMounted);
onBeforeUnmount(doBeforeUnmount);

</script>

<template>
  <section :class=$style.call>
    <div :class="[ $style.participants, {
      [videoWhenNoScreens]: !screenShare,
      [$style.participantsWithSharing]: screenShare
    }]">
      <peer-video
        :style-class=$style.participant
        v-for="{
          vaStream, audioMuted, peerAddr, peerName, videoMuted
        } in peerVideos"
        :is-video-on="!videoMuted"
        :is-audio-on="!audioMuted"
        :stream=vaStream
        :peerName=peerName
        :peerAddr=peerAddr
      />

      <own-video :class=$style.participant
        :is-cam-on=isCamOn
        :stream="ownVA!.stream"
        :user=ownName
      />
    </div>

    <div :class=$style.sharedScreens
      v-if=screenShare
    >
      <own-sharing
        v-if="!!ownScreens"
      />
      <peer-sharing
        v-for="{ stream, peerAddr, peerName } in peerSharedStreams"
        :key=stream.id
        :stream=stream
        :peerAddr=peerAddr
        :peerName=peerName
      />
    </div>

    <div :class=$style.actions>
      <div :class=$style.actionGroup>
        <icon-button
          :icon="isFullscreen ? 'shrink' : 'expand-screen'"
          @click.stop.prevent="toggleFullscreen"
        />
      </div>

      <div :class=$style.actionGroup>
        <icon-button
          :icon="isMicOn ? 'round-mic-none' : 'round-mic-off'"
          @click.stop.prevent="toggleMicStatus"
        />

        <icon-button
          :icon="isCamOn ? 'outline-videocam' : 'outline-videocam-off'"
          @click.stop.prevent="toggleCamStatus"
        />

        <icon-button
          icon="outline-screen-share"
          @click.stop.prevent="openScreenShareChoice"
        />

        <icon-button
          v-if=isGroupChat
          icon="sharp-people"
          disabled
        />
      </div>

      <div :class=$style.actionGroup>
        <ui3n-button
          type="custom"
          color="var(--error-content-default)"
          icon="round-call-end"
          icon-color="var(--warning-fill-default)"
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
  --sharing-screens-height: 70%;

  position: relative;
  width: 100%;
  height: 100%;
}

.participants {
  position: relative;
  width: 100%;
  height: calc(100% - var(--call-actions-height));
  padding: 0 var(--spacing-m);
  /* display: flex; */
  justify-content: center;
  align-items: center;
  column-gap: var(--spacing-m);
}

.participantsWithSharing {
  height: calc(
    100% - var(--call-actions-height) - var(--sharing-screens-height)
  );
  --participant-max-height: calc(100% - var(--spacing-s));
  --participant-width: calc(25% - var(--spacing-s));
  white-space: nowrap;
  overflow-x: auto;
}

.twoParties {
  --participant-max-height: calc(100% - var(--spacing-l));
  --participant-width: calc(50% - var(--spacing-s));
}

.threePlus {
  --participant-max-height: calc(50% - var(--spacing-s));
  --participant-width: calc(50% - var(--spacing-s));
}

.fivePlus {
  --participant-max-height: calc(50% - var(--spacing-s));
  --participant-width: calc(33% - var(--spacing-s));
}

.sevenPlus {
  --participant-max-height: calc(33% - var(--spacing-s));
  --participant-width: calc(33% - var(--spacing-s));
}

.participant {
  position: relative;
  display: inline-block;
  width: var(--participant-width);
  max-height: var(--participant-max-height);
  margin-bottom: var(--spacing-s);
  margin-right: var(--spacing-s);
}

.sharedScreens {
  position: relative;
  width: 100%;
  height: var(--sharing-screens-height);
  padding: 0 var(--spacing-m);
  overflow-y: auto;
}

.actions {
  position: relative;
  width: 100%;
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
