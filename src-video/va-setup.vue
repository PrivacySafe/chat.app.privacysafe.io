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
  import { onMounted, shallowRef } from "vue";
  import { useStreamsStore } from "./stores"
  import { useRouter } from "vue-router";
  import { videoChatSrv } from "./video-component-srv";

  const streams = useStreamsStore()

  const ownVideo = shallowRef<HTMLVideoElement>()

  async function setOwnVideo() {
    if (streams.ownStream) {
      ownVideo.value!.srcObject = streams.ownStream
    } else {
      const ownStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      })
      streams.setOwnStream(ownStream)
      ownVideo.value!.srcObject = streams.ownStream
    }
  }

  onMounted(async () => {
    await setOwnVideo()
    await videoChatSrv.setVAChannelsForAllPeers()
  })

  const router = useRouter()

  async function startChatCall() {
    videoChatSrv.notifyOnCallStart()
    if (streams.isGroupChat()) {
      await router.push('group-call')
    } else {
      await router.push('call')
    }
  }

  async function joinChatCall() {
    
  }

  const { isAnyOneConnected } = streams

</script>

<!-- 
  Let's watch for presence of peers' stream's flipping to join from start
-->

<template>

  <h1>Checking video</h1>
  <video ref="ownVideo" playsinline autoplay muted></video>
  <br>

  <button v-if="!isAnyOneConnected" @click="startChatCall()">Start</button>
  <button v-else @click="joinChatCall()">Join</button>

</template>