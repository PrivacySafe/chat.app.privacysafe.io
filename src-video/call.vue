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
import { onMounted, ref, watch, computed, Ref } from 'vue';
import { useStreamsStore } from './store/streams';
import { storeToRefs } from 'pinia';

const ownVideo = ref<HTMLVideoElement>();
const peerVideo = ref<HTMLVideoElement>();

const streams = useStreamsStore();

onMounted(() => {
  ownVideo.value!.srcObject = streams.ownVAStream;
});


// XXX hidding construction of relationships into function suggests peer-video
//     component as the next step for composability and reusability for many
//     peers.
function peerUI(
  peerStateProxy: typeof streams.fstPeer,
  videoElemRef: Ref<HTMLVideoElement|undefined>
) {
  const ui = {
    name: peerStateProxy.peerName,
    vaStream: computed(() => peerStateProxy.vaStream),
    audio: {
      mutedHere: computed(() => videoElemRef.value?.muted),
      toggle: () => {
        videoElemRef.value!.muted = !videoElemRef.value!.muted;
        console.log(`Peer audio output mute flag is`, videoElemRef.value!.muted);
      },
    },
  };
  watch(
    [ videoElemRef, ui.vaStream ],
    ([ videoElem, vaStream ]) => {
      if (vaStream && videoElem) {
        videoElem.srcObject = vaStream;
      }
    },
    { immediate: true }
  );
  return ui;
}

const fstPeer = peerUI(streams.fstPeer, peerVideo);

</script>

<template>

  <section>

    <h1>Call with {{ streams.fstPeer.peerName }}</h1>

    <div class="peer-video">
      <video
        ref="peerVideo"
        class="peer-video"
        playsinline
        autoplay
      />
    </div>

    <img
      class="ring-graphics"
      src="./assets/images/outgoing-ring.gif"
    >
  
    <video
      ref="ownVideo"
      class="own-video mirror-flip"
      playsinline
      autoplay
      muted
    />

  </section>

</template>

<style lang="scss" scoped>
  .mirror-flip {
    transform: rotateY(180deg);
  }

  .grayscale-filter {
    filter: grayscale(100%);
  }

  .own-video {
    position: absolute;
    width: 20%;
    min-width: 150px;
    bottom: 10%;
    right: 10%;
    z-index: 10;
  }

  div.peer-video {
    width: 100%;
    height: 100%;
    align-content: center;
  }
  video.peer-video {
    display: block;
    width: max-content;
  }

  .ring-graphics {
    position: absolute;
    max-width: 20%;
    bottom: 10%;
    left: 10%;
    z-index: -1;
  }

</style>