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
import { onMounted, shallowRef, onBeforeMount } from "vue";
import { useStreamsStore } from "./store/streams"
import { useRouter } from "vue-router";
import { videoChatSrv } from "./video-component-srv";
import { storeToRefs } from "pinia";

const streams = useStreamsStore();

const ownVideo = shallowRef<HTMLVideoElement>();

async function setOwnVideo() {
  if (streams.ownVAStream) {
    ownVideo.value!.srcObject = streams.ownVAStream;
  } else {
    const ownStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true
    });
    streams.ownVAStream = ownStream;
    ownVideo.value!.srcObject = streams.ownVAStream;
  }
}

onMounted(async () => {

  // XXX
  console.log(`TODO: need a choice of media`);

  await setOwnVideo();
});

const router = useRouter();

async function startChatCall() {
  streams.sendOwnStreamToPeers();
  videoChatSrv.notifyOnCallStart();
  if (streams.isGroupChat) {
    await router.push('group-call');
  } else {
    await router.push('call');
  }
}

const { isAnyOneConnected } = storeToRefs(streams);

</script>

<!-- 
  Let's watch for presence of peers' stream's flipping to join from start
-->

<template>
  <section>

    <h1>Checking video</h1>

    <video
      ref="ownVideo"
      class="mirror-flip"
      playsinline
      autoplay
      muted
    />

    <br>

    <button
      @click="startChatCall()"
    >
      {{ isAnyOneConnected ? 'Join' : 'Start' }}
    </button>

  </section>
</template>

<style lang="scss" scoped>

  .mirror-flip {
    transform: rotateY(180deg);
  }

  .grayscale-filter {
    filter: grayscale(100%);
  }

</style>