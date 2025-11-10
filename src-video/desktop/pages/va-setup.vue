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
import { Ui3nButton, Ui3nIcon, Ui3nMenu, Ui3nTooltip } from '@v1nt1248/3nclient-lib';
import { useVaSetup } from '@video/common/composables/use-va-setup';
import VideoPlaceholder from '@video/common/components/video-placeholder.vue';

const {
  user,
  isAnyOneConnected,
  isMicOn,
  isCamOn,
  haveVideo,
  haveCamerasToChoose,
  webcamMenuChoices,
  ownVA,
  startChatCall,
  cancel,
  changeVideoDeviceTo,
  toggleMicStatus,
  toggleCamStatus,
} = useVaSetup();
</script>

<template>
  <section :class="$style.vaSetup">
    <div :class="$style.header">
      {{ $tr('va.setup.title') }}

      <ui3n-button
        type="icon"
        color="transparent"
        icon="round-close"
        icon-color="var('color-icon-table-secondary-default')"
        @click="cancel"
      />
    </div>

    <div :class="$style.body">
      <video
        v-show="haveVideo && isCamOn"
        ref="own-video"
        :class="$style.video"
        playsinline
        autoplay
      />

      <video-placeholder
        v-show="!haveVideo || !isCamOn"
        :user-name="user"
      />

      <div :class="$style.settings">
        <ui3n-tooltip
          :content="isMicOn ? $tr('va.setup.mute.tooltip') : $tr('va.setup.unmute.tooltip')"
          position-strategy="absolute"
          placement="top"
        >
          <ui3n-button
            type="custom"
            color="var(--color-bg-button-tritery-default)"
            :icon="isMicOn ? 'round-mic-none' : 'round-mic-off'"
            icon-color="var(--color-icon-button-tritery-default)"
            :class="$style.settingsBtn"
            @click.stop.prevent="toggleMicStatus"
          />
        </ui3n-tooltip>

        <ui3n-tooltip
          :content="isCamOn ? $tr('va.setup.camera-off.tooltip') : $tr('va.setup.camera-on.tooltip')"
          position-strategy="absolute"
          placement="top"
        >
          <ui3n-button
            type="custom"
            color="var(--color-bg-button-tritery-default)"
            :icon="isCamOn ? 'outline-videocam' : 'outline-videocam-off'"
            icon-color="var(--color-icon-button-tritery-default)"
            :class="$style.settingsBtn"
            @click.stop.prevent="toggleCamStatus"
          />
        </ui3n-tooltip>

        <ui3n-menu
          v-show="haveCamerasToChoose"
          :offset-y="4"
        >
          <ui3n-tooltip
            :content="$tr('va.setup.camera.select.tooltip')"
            position-strategy="fixed"
            placement="top"
          >
            <div :class="$style.currentWebcam">
              {{ ownVA?.deviceId }}

              <ui3n-icon
                icon="outline-arrow-drop-down"
                size="24"
              />
            </div>
          </ui3n-tooltip>

          <template #menu>
            <div
              v-for="dev in webcamMenuChoices"
              :key="dev.videoDevLabel"
              :class="$style.webcamChoice"
              @click="changeVideoDeviceTo(dev)"
            >
              {{ dev.videoDevLabel }}
            </div>
          </template>
        </ui3n-menu>
      </div>

      <div :class="$style.actions">
        <ui3n-button
          type="secondary"
          @click.stop.prevent="cancel"
        >
          {{ $tr('dialog.cancel.button.default') }}
        </ui3n-button>

        <ui3n-button @click.stop.prevent="startChatCall">
          {{ isAnyOneConnected ? $tr('va.presettings.btn.join') : $tr('va.presettings.btn.start') }}
        </ui3n-button>
      </div>
    </div>
  </section>
</template>

<style lang="scss" module>
.vaSetup {
  --va-setup-header-height: 48px;
  --va-setup-settings-height: 48px;
  --va-setup-actions-height: 64px;

  position: relative;
  width: 100%;
  height: 100%;
  border-radius: var(--spacing-m);
  background-color: var(--color-bg-block-primary-default);
}

.header {
  position: relative;
  width: 100%;
  height: var(--va-setup-header-height);
  padding: 0 var(--spacing-m);
  border-top-left-radius: var(--spacing-m);
  border-top-right-radius: var(--spacing-m);
  border-bottom: 1px solid var(--color-border-block-primary-default);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-12);
  font-weight: 500;
  color: var(--color-text-block-primary-default);
}

.body {
  position: relative;
  width: 100%;
  height: calc(100% - var(--va-setup-header-height));
  padding: var(--spacing-m) var(--spacing-m) calc(var(--va-setup-settings-height) + var(--va-setup-actions-height)) var(--spacing-m);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.video {
  position: relative;
  width: calc(100% - var(--spacing-ml));
  height: calc(100% - var(--spacing-ml));
  border-radius: var(--spacing-m);
  transform: rotateY(180deg);
  background-color: var(--color-bg-control-secondary-default);
}

.settings {
  position: absolute;
  left: 0;
  width: 100%;
  bottom: var(--va-setup-actions-height);
  height: var(--va-setup-settings-height);
  display: flex;
  justify-content: center;
  align-items: center;
  column-gap: var(--spacing-l);
}

.settingsBtn {
  padding: 0 var(--spacing-s) !important;
  column-gap: 0 !important;
}

.actions {
  position: absolute;
  left: 0;
  width: 100%;
  bottom: 0;
  height: var(--va-setup-actions-height);
  padding: 0 var(--spacing-m);
  display: flex;
  justify-content: flex-end;
  align-items: center;
  column-gap: var(--spacing-s);
  border-top: 1px solid var(--color-border-block-primary-default);
}

.currentWebcam {
  display: flex;
  justify-content: center;
  align-items: center;
  column-gap: var(--spacing-xs);
  color: var(--color-icon-button-tritery-default);
  background-color: var(--color-bg-button-tritery-default);
  padding: var(--spacing-s);
  cursor: pointer;
}

.webcamChoice {
  color: var(--color-icon-button-tritery-default);
  background-color: var(--color-bg-button-tritery-default);
  padding: var(--spacing-s);
  cursor: pointer;

  &:hover {
    background-color: var(--color-bg-control-primary-hover);
  }
}
</style>
