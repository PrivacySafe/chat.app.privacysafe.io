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
  import { onMounted, shallowRef } from 'vue';
  import { useStreamsStore } from './stores';

  const ownVideo = shallowRef<HTMLVideoElement>()
  const streams = useStreamsStore()

  onMounted(() => {
    ownVideo.value!.srcObject = streams.ownStream!
  })

</script>

<template>

  <h1>Group Call</h1>
 
  <video ref="ownVideo" playsinline autoplay muted></video>

</template>