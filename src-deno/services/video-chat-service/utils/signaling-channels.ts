/*
 Copyright (C) 2026 3NSoft Inc.

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
*/
import type { ChatIdObj, WebRTCMsg, WebRTCOffBandMessage } from '../../../../types/asmail-msgs.types.ts';
import type { WebRTCSignalingPeerChannel, WebRTCSignalListener } from '../../../types/index.ts';
import { fstIsPolite } from '../../../utils/for-perfect-negotiation.ts';
import { sendWebRTCMsg, startStageFirst } from './_common.ts';

export function webRTCSignalingPeerChannel({
  ownAddr,
  chatId,
  peerAddr,
}: {
  ownAddr: string;
  chatId: ChatIdObj;
  peerAddr: string;
}): WebRTCSignalingPeerChannel {
  let channelListener: WebRTCSignalListener | undefined = undefined;
  let receivingBuffer: WebRTCMsg[] | undefined = undefined;
  let sendingProc: Promise<void> | undefined = undefined;
  let sendingBuffer: WebRTCMsg[] | undefined = undefined;
  let id = Math.floor(Number.MAX_SAFE_INTEGER * Math.random());
  let state: 'not-started' | 'starting' | 'signalling' | 'disconnected' = 'not-started';

  function addToReceivingBuffer(msg: WebRTCMsg): void {
    if (!receivingBuffer) {
      receivingBuffer = [];
    }
    receivingBuffer.push(msg);
  }

  function addToSendingBuffer(stage: WebRTCMsg['stage'], data: WebRTCOffBandMessage): void {
    if (!sendingBuffer) {
      sendingBuffer = [{ stage, data, id }];
    } else {
      const waitingMsg = sendingBuffer.find(m => m.stage === stage);
      if (waitingMsg) {
        if (Array.isArray(waitingMsg.data)) {
          waitingMsg.data.push(data);
        } else {
          waitingMsg.data = [waitingMsg.data, data];
        }
      } else {
        sendingBuffer.push({ stage, data, id });
      }
    }
  }

  async function sendWebRTCMessage(webrtcMsg: WebRTCMsg): Promise<void> {
    await sendWebRTCMsg(chatId, peerAddr, ownAddr, webrtcMsg);
    if (sendingBuffer) {
      const msg = sendingBuffer.pop();
      if (msg) {
        return sendWebRTCMessage(msg);
      }
    }
    sendingProc = undefined;
  }

  function passMsgToGUI(msg: WebRTCMsg): boolean {
    if (channelListener) {
      channelListener(msg);
      return true;
    }

    addToReceivingBuffer(msg);
    return false;
  }

  function handleStartSignal(msg: WebRTCMsg): boolean {
    switch (state) {
      case 'not-started': {
        state = 'signalling';
        id = msg.id;
        return passMsgToGUI(msg);
      }

      case 'starting': {
        state = 'signalling';
        if (fstIsPolite(ownAddr, peerAddr)) {
          id = msg.id;
        }
        return passMsgToGUI(msg);
      }

      case 'signalling': {
        return id === msg.id ? passMsgToGUI(msg) : false;
      }

      default:
        return false;
    }
  }

  function handleRegularSignal(msg: WebRTCMsg): boolean {
    if (id !== msg.id) {
      return false;
    }

    switch (state) {
      case 'signalling':
        return passMsgToGUI(msg);

      case 'starting': {
        state = 'signalling';
        return passMsgToGUI(msg);
      }

      default:
        return false;
    }
  }

  function handleDisconnectSignal(msg: WebRTCMsg): boolean {
    if (id !== msg.id) {
      return false;
    }

    if (state === 'signalling') {
      passMsgToGUI(msg);
      // TODO maybe
      // return this.passMsgToGUI(msg);
    }

    if (chatId.isGroupChat) {
      id = Math.floor(Number.MAX_SAFE_INTEGER * Math.random());
      state = 'not-started';
    } else {
      state = 'disconnected';
    }

    return true;
  }

  function attachGUI(signalsListener: WebRTCSignalListener): void {
    if (channelListener) {
      throw new Error(`Message listener is already set for peer ${peerAddr} in chat ${chatId}`);
    }

    channelListener = signalsListener;
    if (receivingBuffer) {
      receivingBuffer.sort(startStageFirst);
      for (const msg of receivingBuffer) {
        channelListener!(msg);
      }
      receivingBuffer = undefined;
    }
  }

  function detachGUI(): void {
    channelListener = undefined;
  }

  function handleIncomingSignal(msg: WebRTCMsg): boolean {
    if (state === 'disconnected') {
      return id === msg.id;
    }

    const { stage } = msg;

    switch (stage) {
      case 'start':
        return handleStartSignal(msg);
      case 'signalling':
        return handleRegularSignal(msg);
      case 'disconnect':
        return handleDisconnectSignal(msg);
      default:
        throw `Unrecognized stage ${stage} of WebRTC signalling`;
    }
  }

  async function sendMsgToPeer(stage: 'signalling' | 'disconnect', data: WebRTCOffBandMessage): Promise<void> {
    if (state === 'disconnected') {
      return;
    }

    if (stage === 'signalling' && state === 'not-started') {
      (stage as WebRTCMsg['stage']) = 'start';
      state = 'starting';
    }

    if (sendingProc) {
      addToSendingBuffer(stage, data);
    }

    sendingProc = sendWebRTCMessage({ stage, data, id });

    if (stage === 'disconnect') {
      state = 'disconnected';
    }

    return sendingProc;
  }

  return {
    attachGUI,
    detachGUI,
    handleIncomingSignal,
    sendMsgToPeer,
  };
}
