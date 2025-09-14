/*
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
*/

import { fstIsPolite } from '../utils/for-perfect-negotiation.ts';
import { sendSystemDeletableMessage } from '../utils/send-chat-msg.ts'
import {
  ChatIdObj,
  ChatOutgoingMessage,
  ChatWebRTCMsgV1,
  WebRTCMsg,
  WebRTCMsgBodySysMsgData,
  WebRTCOffBandMessage,
} from '../../types/index.ts';
import { generateChatMessageId } from '../../shared-libs/chat-ids.ts';

export type WebRTCSignalListener = (signal: WebRTCMsg) => void;

export class WebRTCSignalingPeerChannel {

  private channelListener: WebRTCSignalListener | undefined = undefined;
  private receivingBuffer: WebRTCMsg[] | undefined = undefined;
  private sendingProc: Promise<void> | undefined = undefined;
  private sendingBuffer: WebRTCMsg[] | undefined = undefined;
  private id = Math.floor(Number.MAX_SAFE_INTEGER * Math.random());
  private state: 'not-started' | 'starting' | 'signalling' | 'disconnected' = 'not-started';

  constructor(
    public readonly ownAddr: string,
    public readonly chatId: ChatIdObj,
    public readonly peerAddr: string,
  ) {
  }

  attachGUI(signalsListener: WebRTCSignalListener): void {
    if (this.channelListener) {
      throw new Error(`Message listener is already set for peer ${this.peerAddr} in chat ${this.chatId}`);
    }

    this.channelListener = signalsListener;
    if (this.receivingBuffer) {
      this.receivingBuffer.sort(startStageFirst);
      for (const msg of this.receivingBuffer) {
        this.channelListener!(msg);
      }
      this.receivingBuffer = undefined;
    }
  }

  private addToReceivingBuffer(msg: WebRTCMsg): void {
    if (!this.receivingBuffer) {
      this.receivingBuffer = [];
    }
    this.receivingBuffer.push(msg);
  }

  handleIncomingSignal(msg: WebRTCMsg): boolean {
    if (this.state === 'disconnected') {
      return (this.id === msg.id);
    }

    const { stage } = msg;

    switch (stage) {
      case 'start':
        return this.handleStartSignal(msg);
      case 'signalling':
        return this.handleRegularSignal(msg);
      case 'disconnect':
        return this.handleDisconnectSignal(msg);
      default:
        throw `Unrecognized stage ${stage} of WebRTC signalling`;
    }
  }

  private passMsgToGUI(msg: WebRTCMsg): boolean {
    if (this.channelListener) {
      this.channelListener(msg);
      return true;
    }

    this.addToReceivingBuffer(msg);
    return false;
  }

  private handleStartSignal(msg: WebRTCMsg): boolean {
    switch (this.state) {
      case 'not-started': {
        this.state = 'signalling';
        this.id = msg.id;
        return this.passMsgToGUI(msg);
      }
      case 'starting': {
        this.state = 'signalling';
        if (fstIsPolite(this.ownAddr, this.peerAddr)) {
          this.id = msg.id;
        }
        return this.passMsgToGUI(msg);
      }
      case 'signalling': {
        return this.id === msg.id
          ? this.passMsgToGUI(msg)
          : false;
      }
      default:
        return false;
    }
  }

  private handleRegularSignal(msg: WebRTCMsg): boolean {
    if (this.id !== msg.id) {
      return false;
    }

    switch (this.state) {
      case 'signalling':
        return this.passMsgToGUI(msg);
      case 'starting': {
        this.state = 'signalling';
        return this.passMsgToGUI(msg);
      }
      default:
        return false;
    }
  }

  private handleDisconnectSignal(msg: WebRTCMsg): boolean {
    if (this.id !== msg.id) {
      return false;
    }

    if (this.state === 'signalling') {
      this.passMsgToGUI(msg);
      // TODO maybe
      // return this.passMsgToGUI(msg);
    }

    if (this.chatId.isGroupChat) {
      this.id = Math.floor(Number.MAX_SAFE_INTEGER * Math.random());
      this.state = 'not-started';
    } else {
      this.state = 'disconnected';
    }
    return true;
  }

  async sendMsgToPeer(
    stage: 'signalling' | 'disconnect',
    data: WebRTCOffBandMessage,
  ): Promise<void> {
    if (this.state === 'disconnected') {
      return;
    }

    if (stage === 'signalling' && this.state === 'not-started') {
      (stage as WebRTCMsg['stage']) = 'start';
      this.state = 'starting';
    }

    if (this.sendingProc) {
      this.addToSendingBuffer(stage, data);
    }

    this.sendingProc = this.sendWebRTCMessage({ stage, data, id: this.id });

    if (stage === 'disconnect') {
      this.state = 'disconnected';
    }

    return this.sendingProc;
  }

  private addToSendingBuffer(
    stage: WebRTCMsg['stage'],
    data: WebRTCOffBandMessage,
  ): void {
    if (!this.sendingBuffer) {
      this.sendingBuffer = [{ stage, data, id: this.id }];
    } else {
      const waitingMsg = this.sendingBuffer.find(m => (m.stage === stage));
      if (waitingMsg) {
        if (Array.isArray(waitingMsg.data)) {
          waitingMsg.data.push(data);
        } else {
          waitingMsg.data = [waitingMsg.data, data];
        }
      } else {
        this.sendingBuffer.push({ stage, data, id: this.id });
      }
    }
  }

  private async sendWebRTCMessage(webrtcMsg: WebRTCMsg): Promise<void> {
    await sendWebRTCMsg(this.chatId, this.peerAddr, this.ownAddr, webrtcMsg);
    if (this.sendingBuffer) {
      const msg = this.sendingBuffer.pop();
      if (msg) {
        return this.sendWebRTCMessage(msg);
      }
    }
    this.sendingProc = undefined;
  }

  detachGUI(): void {
    this.channelListener = undefined;
  }

}

function startStageFirst(a: WebRTCMsg, b: WebRTCMsg): -1 | 0 | 1 {
  if (a.stage === 'start') {
    return -1;
  } else if (b.stage === 'start') {
    return 1;
  } else {
    return 0;
  }
}

async function sendSystemMgsAboutDisconnectWebRTC(
  { ownAddr, chatId, recipients }:
  { ownAddr: string; chatId: ChatIdObj; recipients: string[] }
) {
  const chatSystemData: WebRTCMsgBodySysMsgData = {
    event: 'webrtc-call',
    value: {
      sender: ownAddr,
      subType: 'outgoing-call-cancelled',
      chatId,
    },
  };

  const { chatMessageId } = generateChatMessageId();
  return sendSystemDeletableMessage({
    chatId,
    recipients,
    chatMessageId,
    chatSystemData,
  });
}

export async function sendWebRTCMsg(
  chatId: ChatIdObj,
  peerAddr: string,
  ownAddr: string,
  webrtcMsg: WebRTCMsg,
): Promise<void> {
  const jsonBody: ChatWebRTCMsgV1 = {
    v: 1,
    chatMessageType: 'webrtc-call',
    groupChatId: (chatId.isGroupChat ? chatId.chatId : undefined),
    webrtcMsg,
  };
  const msg: ChatOutgoingMessage = {
    msgType: 'chat',
    jsonBody,
  };

  const deliveryId = `chat-webrtc-${Date.now()}-${Math.floor(10000 * Math.random())}`;

  try {
    await w3n.mail!.delivery.addMsg([peerAddr], msg, deliveryId);
    if (webrtcMsg.stage === 'disconnect') {
      await sendSystemMgsAboutDisconnectWebRTC({ ownAddr, chatId, recipients: [peerAddr] });
    }
  } catch (err) {
    await w3n.log('error', `Fail to add webrtc signalling message to delivery`, err);
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      let isDone = false;
      w3n.mail!.delivery.observeDelivery(deliveryId, {
        next: p => {
          if (isDone) {
            return;
          }

          if (p.allDone) {
            isDone = true;
            if (p.allDone === 'all-ok') {
              resolve();
            } else if (p.allDone === 'with-errors') {
              reject(p.recipients[peerAddr].err);
            }
          }
        },
        complete: () => {
          if (!isDone) {
            isDone = true;
            resolve();
          }
        },
        error: err => {
          if (!isDone) {
            isDone = true;
            reject(err);
          }
        },
      });
    });
  } finally {
    w3n.mail!.delivery.rmMsg(deliveryId).catch(err => console.error(err));
  }
}
