import { computed, inject, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { VUEBUS_KEY, VueBusPlugin, type VueEventBus } from '@v1nt1248/3nclient-lib/plugins';
import { useAppStore } from '@video/store/app';
import { Peer, useStreamsStore } from '@video/store/streams';
import type { VideoAudioEvents } from '@video/services/events';

export default function useCall() {
  const appStore = useAppStore();
  const { user } = storeToRefs(appStore);
  const streams = useStreamsStore();
  const $emitter = inject<VueBusPlugin<VideoAudioEvents>>(VUEBUS_KEY)!.$emitter as VueEventBus<VideoAudioEvents>;

  const ownVideoTag = ref<HTMLVideoElement>();
  const peerVideoTag = ref<HTMLVideoElement>();

  const peerVideoMuted = computed(() => {
    const peerAddr = streams.fstPeer.peerAddr;
    return !streams.peersUiState[peerAddr]?.isCamOn;
  });
  const peerAudioMuted = computed(() => {
    const peerAddr = streams.fstPeer.peerAddr;
    return !streams.peersUiState[peerAddr]?.isMicOn;
  });
  const peerVideoAvailable = computed(() => !!streams.fstPeer.vaStream && !peerVideoMuted.value);

  function setupPeerVideo(peer: Peer) {
    if (peer.vaStream) {
      peerVideoTag.value!.srcObject = peer.vaStream;
    } else {
      $emitter.on('va:stream-connected', ({ peerAddr }) => {
        if (peer.peerAddr === peerAddr) {
          peerVideoTag.value!.srcObject = peer.vaStream;
        }
      });
    }
  }

  function toggleMicStatus() {
    streams.setMicOn(!streams.isMicOn);
    sendMessageViaDataChannel({ mic: streams.isMicOn ? 'on' : 'off' });
  }

  function toggleCamStatus() {
    streams.setCamOn(!streams.isCamOn);
    sendMessageViaDataChannel({ camera: streams.isCamOn ? 'on' : 'off' });
  }

  function endCall() {
    peerVideoTag.value && peerVideoTag.value?.srcObject && (peerVideoTag.value!.srcObject = null);
    sendMessageViaDataChannel({ state: 'disconnected' });
    w3n.closeSelf();
  }

  function sendMessageViaDataChannel(data: { mic?: 'on' | 'off'; camera?: 'on' | 'off'; state?: 'disconnected' }) {
    const message = {
      user: user.value,
      ...data,
    };
    streams.fstPeer.vaChannel.sendMessageViaDataChannel(JSON.stringify(message));
  }

  $emitter.on('va:disconnected', ({ peerAddr }) => {
    const peer = streams.fstPeer;
    if (peer.peerAddr === peerAddr) {
      peerVideoTag.value!.srcObject = null;
    }
  });

  $emitter.on('va:peer-ui-state', data => {
    const {
      user: peerAddr,
      mic,
      camera,
      isInitial,
      state,
    } = data;

    if (streams.fstPeer?.peerAddr !== peerAddr) {
      return;
    }

    if (state === 'disconnected') {
      endCall();
      return;
    }

    if (isInitial === 'on') {
      const message: { mic: 'on' | 'off'; camera: 'on' | 'off' } = {
        mic: streams.isMicOn ? 'on' : 'off',
        camera: streams.isCamOn ? 'on' : 'off',
      };
      sendMessageViaDataChannel(message);
    }

    mic && streams.setPeerUiState({ user: peerAddr, mic });
    camera && streams.setPeerUiState({ user: peerAddr, cam: camera });
  });

  onMounted(() => {
    ownVideoTag.value!.srcObject = streams.ownVAStream;
    setupPeerVideo(streams.fstPeer);
  });

  return {
    user,
    ownVideoTag,
    peerVideoTag,
    streams,
    peerVideoAvailable,
    peerVideoMuted,
    peerAudioMuted,
    toggleMicStatus,
    toggleCamStatus,
    endCall,
  };
}
