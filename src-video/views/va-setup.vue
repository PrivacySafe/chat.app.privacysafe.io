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
import { onBeforeMount, onMounted, shallowRef, ref, computed, inject } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { Ui3nButton, Ui3nMenu } from '@v1nt1248/3nclient-lib';
import { useStreamsStore } from '@video/store/streams.store';
import { useAppStore } from '@video/store/app.store';
import VideoPlaceholder from '@video/components/video-placeholder.vue';
import { I18N_KEY, NOTIFICATIONS_KEY } from '@v1nt1248/3nclient-lib/plugins';

const router = useRouter();
const notification = inject(NOTIFICATIONS_KEY)!;
const { $tr } = inject(I18N_KEY)!;

const appStore = useAppStore();
const { user } = storeToRefs(appStore);
const streams = useStreamsStore();
const { ownVA, isMicOn, isCamOn, isAnyOneConnected } = storeToRefs(streams);
const { setOwnVAStream, setMicOn, setCamOn, startCall } = streams;

const choicesWithVideoInput = ref<DeviceOption[]>([]);
const webcamMenuChoices = computed(() => choicesWithVideoInput.value.filter(
  ({ videoDevLabel }) => (videoDevLabel !== ownVA.value?.deviceId)
));
const haveVideo = computed(() => (choicesWithVideoInput.value.length > 0));
const haveCamerasToChoose = computed(() => (
  choicesWithVideoInput.value.length > 1
));

const ownVideo = shallowRef<HTMLVideoElement>();

async function cancel() {
  w3n.closeSelf();
}

interface DeviceOption {
  videoDevLabel: string;
  opt: MediaStreamConstraints;
}

async function setupDeviceChoices(onMount = true): Promise<void> {
  if (onMount) {
    await updateVideoDeviceChoices();
    if (ownVA.value) {
      ownVideo.value!.srcObject = ownVA.value.stream;
    } else if (haveVideo.value) {
      await changeVideoDeviceTo(choicesWithVideoInput.value[0]);
      setCamOn(true);
    } else {
      await setAudioOnlyDevice();
      setCamOn(false);
    }
    setMicOn(true);
  } else {
    await updateVideoDeviceChoices();
    if (choicesWithVideoInput.value.find(
      d => (d.videoDevLabel === ownVA.value?.deviceId)
    )) {
      return;
    }
    if (haveVideo.value) {
      await changeVideoDeviceTo(choicesWithVideoInput.value[0]);
      setCamOn(true);
    } else {
      await setAudioOnlyDevice();
      setCamOn(false);
    }
    setMicOn(true);
  }
}

async function updateVideoDeviceChoices(): Promise<void> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  choicesWithVideoInput.value = devices
  .filter(({ kind }) => (kind === 'videoinput'))
  .map(({ deviceId, label: videoDevLabel }) => ({
    videoDevLabel,
    opt: { audio: true, video: { deviceId } }
  }));
}

async function changeVideoDeviceTo(
  { videoDevLabel, opt }: DeviceOption
): Promise<void>  {
  const ownStream = await navigator.mediaDevices.getUserMedia(opt);
  setOwnVAStream(ownStream, videoDevLabel);
  ownVideo.value!.srcObject = ownVA.value!.stream;
}

async function setAudioOnlyDevice(): Promise<void> {
  const ownStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  setOwnVAStream(ownStream, null);
}

function toggleMicStatus() {
  setMicOn(!isMicOn.value);
}

function toggleCamStatus() {
  if (!isCamOn.value && !haveVideo.value) {
    notification.$createNotice({
      type: 'error',
      content: $tr('va.setup.no-cameras'),
    });
  } else {
    setCamOn(!isCamOn.value);
  }
}

async function startChatCall() {
  startCall();
  await router.push('call');
}

onBeforeMount(async () => {
  try {
    navigator.mediaDevices.ondevicechange = () => setupDeviceChoices(false);
  } catch (e) {
    console.error('ON_BEFORE_MOUNT ERROR: ', e);
    throw e;
  }
});

onMounted(async () => {
  await setupDeviceChoices();
});

</script>

<template>
  <section :class="$style.vaSetup">
    <div :class="$style.header">
      {{ $tr('va.setup.title') }}

      <Ui3nButton
        type="icon"
        color="transparent"
        icon="round-close"
        icon-color="var('color-icon-table-secondary-default')"
        @click="cancel"
      />
    </div>

    <div :class="$style.content">

       <video
        v-show="haveVideo && isCamOn"
        ref="ownVideo"
        :class="$style.video"
        playsinline
        autoplay
      />

      <video-placeholder
        v-show="!haveVideo || !isCamOn"
        :userName="user"
      />

      <div :class="$style.settings">
        <ui3n-button
          type="custom"
          color="var(--color-bg-button-tritery-default)"
          :icon="isMicOn ? 'round-mic-none' : 'round-mic-off'"
          icon-color="var(--color-icon-button-tritery-default)"
          :class="$style.settingsBtn"
          @click="toggleMicStatus"
        />

        <ui3n-button
          type="custom"
          color="var(--color-bg-button-tritery-default)"
          :icon="isCamOn ? 'outline-videocam' : 'outline-videocam-off'"
          icon-color="var(--color-icon-button-tritery-default)"
          :class="$style.settingsBtn"
          @click="toggleCamStatus"
        />

        <ui3n-menu
          v-show="haveCamerasToChoose"
        >
          <div :class=$style.currentWebcam>
            {{ ownVA?.deviceId }}
            <ui3n-icon
              :class="$style.dropDownIcon"
              icon="outline-arrow-drop-down"
              width="24"
              height="24"
            />
          </div>
          <template #menu>
            <div :class=$style.webcamChoice
              v-for="dev in webcamMenuChoices"
              :key="dev.videoDevLabel"
              @click="changeVideoDeviceTo(dev)"
            >
              {{ dev.videoDevLabel }}
            </div>
          </template>
        </ui3n-menu>
      </div>
    </div>

    <div :class="$style.actions">
      <Ui3nButton
        type="secondary"
        @click.stop.prevent="cancel"
      >
        {{ $tr('dialog.cancel.button.default') }}
      </Ui3nButton>

      <Ui3nButton
        @click.stop.prevent="startChatCall"
      >
        {{ isAnyOneConnected ? $tr('va.presettings.btn.join') : $tr('va.presettings.btn.start') }}
      </Ui3nButton>
    </div>
  </section>
</template>

<style lang="scss" module>
.vaSetup {
  position: relative;
  width: 800px;
  border-radius: var(--spacing-m);
  background-color: var(--color-bg-block-primary-default);
}

.header {
  position: relative;
  width: 100%;
  height: var(--spacing-xxl);
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

.content {
  position: relative;
  width: 100%;
  aspect-ratio: 1.72;
  padding: var(--spacing-m);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
}

.video {
  position: relative;
  width: calc(100% - var(--spacing-l));
  aspect-ratio: 2.1;
  border-radius: var(--spacing-m);
  transform: rotateY(180deg);
  background-color: var(--color-bg-control-secondary-default);
  margin-bottom: var(--spacing-ml);
}

.settings {
  display: flex;
  width: 100%;
  justify-content: center;
  align-items: center;
  column-gap: var(--spacing-l);
  margin-bottom: var(--spacing-ml);
}

.settingsBtn {
  padding: 0 var(--spacing-s) !important;
  column-gap: 0 !important;
}

.actions {
  position: relative;
  width: 100%;
  height: 64px;
  padding: 0 var(--spacing-m);
  display: flex;
  justify-content: flex-end;
  align-items: center;
  column-gap: var(--spacing-s);
  border-top: 1px solid var(--color-border-block-primary-default);
}

.dropDownIcon {
  position: absolute;
  right: var(--spacing-xs);
}

.currentWebcam {
  color: var(--color-icon-button-tritery-default);
  background-color: var(--color-bg-button-tritery-default);
  padding: var(--spacing-s);
  align-items: center;
}

.webcamChoice {
  color: var(--color-icon-button-tritery-default);
  background-color: var(--color-bg-button-tritery-default);
  padding: var(--spacing-s);
}

</style>
