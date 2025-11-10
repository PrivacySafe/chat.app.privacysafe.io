import { computed, inject, onBeforeMount, onMounted, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { I18N_KEY, I18nPlugin, NOTIFICATIONS_KEY, NotificationsPlugin } from '@v1nt1248/3nclient-lib/plugins';
import type { DeviceOption } from '@video/common/types';
import { useAppStore } from '@video/common/store/app.store';
import { useStreamsStore } from '@video/common/store/streams.store';

export function useVaSetup() {
  const router = useRouter();

  const { $tr } = inject<I18nPlugin>(I18N_KEY)!;
  const notification = inject<NotificationsPlugin>(NOTIFICATIONS_KEY)!;

  const appStore = useAppStore();
  const { user } = storeToRefs(appStore);

  const streams = useStreamsStore();
  const { ownVA, isMicOn, isCamOn, isAnyOneConnected } = storeToRefs(streams);
  const { setOwnVAStream, setMicOn, setCamOn, startCall } = streams;

  const choicesWithVideoInput = ref<DeviceOption[]>([]);
  const webcamMenuChoices = computed(() => choicesWithVideoInput.value.filter(
    ({ videoDevLabel }) => (videoDevLabel !== ownVA.value?.deviceId),
  ));
  const haveVideo = computed(() => (choicesWithVideoInput.value.length > 0));
  const haveCamerasToChoose = computed(() => choicesWithVideoInput.value.length > 1);

  const ownVideo = useTemplateRef<HTMLVideoElement>('own-video');

  async function cancel() {
    w3n.closeSelf();
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
      return;
    }


    await updateVideoDeviceChoices();
    if (choicesWithVideoInput.value.find(d => (d.videoDevLabel === ownVA.value?.deviceId))) {
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

  async function updateVideoDeviceChoices(): Promise<void> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    choicesWithVideoInput.value = devices
      .filter(({ kind }) => (kind === 'videoinput'))
      .map(({ deviceId, label: videoDevLabel }) => ({
        videoDevLabel,
        opt: { audio: true, video: { deviceId } },
      }));
  }

  async function changeVideoDeviceTo({ videoDevLabel, opt }: DeviceOption): Promise<void> {
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
    await router.push({ name: 'call' });
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

  return {
    $tr,
    user,
    isAnyOneConnected,
    choicesWithVideoInput,
    webcamMenuChoices,
    haveVideo,
    haveCamerasToChoose,
    ownVideo,
    isCamOn,
    isMicOn,
    ownVA,
    startChatCall,
    cancel,
    changeVideoDeviceTo,
    toggleMicStatus,
    toggleCamStatus,
  };
}
