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
import { Ui3nButton, Ui3nIcon } from '@v1nt1248/3nclient-lib';
import useCall from './useCall';
import VideoPlaceholder from '@video/components/video-placeholder.vue';

const {
  user,
  ownVideoTag,
  peerVideoTag,
  streams,
  peerVideoAvailable,
  peerAudioMuted,
  toggleMicStatus,
  toggleCamStatus,
  endCall,
} = useCall();
</script>

<template>
  <section :class="$style.call">
    <div :class="$style.body">
      <div :class="$style.person">
        <video
          v-show="peerVideoAvailable"
          ref="peerVideoTag"
          :class="$style.video"
          playsinline
          autoplay
        />

        <video-placeholder
          v-show="!peerVideoAvailable"
          :user="streams.fstPeer.peerName"
        />

        <ui3n-icon
          v-if="peerAudioMuted"
          icon="round-mic-off"
          icon-color="var(--color-icon-button-tritery-default)"
          width="24"
          height="24"
          :class="$style.muted"
        />
      </div>

      <div :class="$style.person">
        <video
          v-show="streams.isCamOn"
          ref="ownVideoTag"
          :class="[$style.video, $style.mirrorFlip]"
          playsinline
          autoplay
          muted
        />

        <video-placeholder
          v-show="!streams.isCamOn"
          :user="user"
        />
      </div>
    </div>

    <div :class="$style.actions">
      <div :class="$style.actionGroup">
        <ui3n-button
          type="custom"
          color="var(--color-bg-button-tritery-default)"
          icon="expand-screen"
          icon-color="var(--color-icon-button-tritery-default)"
          :class="$style.btn"
          @click="() => console.log('CLICK ON EXPAND SCREEN BUTTON!')"
        />
      </div>

      <div :class="$style.actionGroup">
        <ui3n-button
          type="custom"
          color="var(--color-bg-button-tritery-default)"
          :icon="streams.isMicOn ? 'round-mic-none' : 'round-mic-off'"
          icon-color="var(--color-icon-button-tritery-default)"
          :class="$style.btn"
          @click.stop.prevent="toggleMicStatus"
        />

        <ui3n-button
          type="custom"
          color="var(--color-bg-button-tritery-default)"
          :icon="streams.isCamOn ? 'outline-videocam' : 'outline-videocam-off'"
          icon-color="var(--color-icon-button-tritery-default)"
          :class="$style.btn"
          @click.stop.prevent="toggleCamStatus"
        />

        <ui3n-button
          type="custom"
          color="var(--color-bg-button-tritery-default)"
          icon="outline-screen-share"
          icon-color="var(--color-icon-button-tritery-default)"
          :class="$style.btn"
          disabled
        />

        <ui3n-button
          type="custom"
          color="var(--color-bg-button-tritery-default)"
          icon="sharp-people"
          icon-color="var(--color-icon-button-tritery-default)"
          :class="$style.btn"
          disabled
        />
      </div>

      <div :class="$style.actionGroup">
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

  position: relative;
  width: 100%;
  height: 100%;
}

.body {
  position: relative;
  width: 100%;
  height: calc(100% - var(--call-actions-height));
  padding: 0 var(--spacing-m);
  display: flex;
  justify-content: center;
  align-items: center;
  column-gap: var(--spacing-m);
}

.person {
  position: relative;
  width: calc(100% - var(--spacing-l));
  height: calc(100% - var(--spacing-l));
  display: flex;
  justify-content: center;
  align-items: center;
}

.muted {
  position: absolute;
  left: calc(50% - 12px);
  top: var(--spacing-s);
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

.btn {
  padding: 0 var(--spacing-s) !important;
  column-gap: 0 !important;
}

.video {
  width: 100%;
  background-color: var(--color-bg-control-secondary-default);
  border-radius: var(--spacing-m);
}

.mirrorFlip {
  transform: rotateY(180deg);
}
</style>
