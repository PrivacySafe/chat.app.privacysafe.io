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
  import { onMounted, shallowRef, watch } from 'vue';
  import { useStreamsStore } from './stores';
  import { WebRTCPeer } from './webrtc-peer';

  const ownVideo = shallowRef<HTMLVideoElement>()
  const peerVideo = shallowRef<HTMLVideoElement>()

  const streams = useStreamsStore()
  const peer = streams.usePeerStore(streams.chat.peers[0].addr)

  function connectPeerToVideoElems(webrtc: WebRTCPeer|undefined) {
    if (!webrtc) {
      return
    }
    webrtc.sendMediaStream(streams.ownStream)
    watch(
      () => peer.vaStream!,
      stream => {
        peerVideo.value!.srcObject = stream
      },
      { immediate: true }
    )
  }

  onMounted(() => {
    ownVideo.value!.srcObject = streams.ownStream!

    watch(
      () => peer.webrtc!,
      connectPeerToVideoElems,
      { immediate: true }
    )
  })

</script>

<template>

  <h1>Call with {{ peer.name }}</h1>

  <div class="peer-video">
    <video class="peer-video" ref="peerVideo" playsinline autoplay></video>
  </div>

  <img class="ring-graphics" src="./assets/images/outgoing-ring.gif">
 
  <video class="own-video" ref="ownVideo" playsinline autoplay muted></video>

</template>

<style lang="scss" scoped>
  .own-video {
    position: absolute;
    width: 20%;
    min-width: 150px;
    bottom: 10%;
    right: 20%;
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