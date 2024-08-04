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
  import { videoOpenerProxy } from '../../services/services-provider';
  import { useSharedRef } from '../../router';

  const props = defineProps<{
    withoutOverlay?: boolean
  }>()
  const emit = defineEmits(['close'])

  const incomingCalls = useSharedRef('incomingCalls')

  function dismissAllIncomingCalls() {
    incomingCalls.value = []
  }

  async function joinCall() {
    const callDetails = incomingCalls.value[0]
    await videoOpenerProxy.joinCallInRoom(callDetails)
    dismissAllIncomingCalls()
  }

</script>

<template>
  <div
    :class="[
      'chat-create-dialog__wrapper',
      { 'chat-create-dialog__wrapper--without-overlay': withoutOverlay }
    ]"
    @click.prevent.self="dismissAllIncomingCalls"
  >
    <div class="chat-create-dialog__body">
      <div class="chat-create-dialog__top">
        <h3>incoming call</h3>
      </div>

      <img src="../../assets/images/incoming-ring.gif">
      <p>Call from {{ incomingCalls[0].peerAddress }}</p>
      <button @click="joinCall">☏ Join</button>
      <span>&nbsp; &nbsp; &nbsp;</span>
      <button @click="dismissAllIncomingCalls">Dismiss ✖️</button>

    </div>
  </div>
</template>

<style lang="scss">
  @import "../../assets/styles/mixins";

  .chat-create-dialog__wrapper {
    position: fixed;
    z-index: 1000;
    inset: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: rgba(0, 0, 0, 0.5);

    .chat-create-dialog__body {
      position: relative;
      width: 380px;
      height: 90%;
      border-radius: var(--base-size);
      background-color: var(--system-white, #fff);
      text-align: center;
    }

    &--without-overlay {
      top: 5%;
      bottom: 5%;
      left: calc(50% - 190px);
      width: 380px;
      background-color: transparent;
      border-radius: var(--base-size);
      box-shadow: 0 2px 8px var(--black-30);

      .chat-create-dialog__body {
        width: 100%;
        height: 100%;
      }
    }
  }

  .chat-create-dialog {
    &__top {
      position: relative;
      width: 100%;
      height: calc(var(--base-size) * 6);
      border-bottom: 1px solid var(--gray-50, #f2f2f2);
      align-items: center;
    }
  }
</style>
