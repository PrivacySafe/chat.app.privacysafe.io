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
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ChatIdObj,
  ChatIncomingMessage,
  ChatOutgoingMessage,
  ChatWebRTCMsgV1,
  WebRTCMsg,
  WebRTCMsgBodySysMsgData,
  WebRTCOffBandMessage,
} from '../../../../types/asmail-msgs.types.ts';
import { toCanonicalAddress } from '../../../../shared-libs/address-utils.ts';
import { generateChatMessageId } from '../../../../shared-libs/chat-ids.ts';
import { sendSystemDeletableMessage } from '../../../utils/send-chat-msg.ts';

function checkData(data: WebRTCOffBandMessage | WebRTCOffBandMessage[]): boolean {
  // TODO add sanity checks here, and for outgoing thing we may add filtering
  return true;
}

export function checkChatMessageJSONforWebRTC(msg: ChatIncomingMessage):
  | {
      webrtcMsg: ChatWebRTCMsgV1['webrtcMsg'];
      chatId: ChatIdObj;
    }
  | undefined {
  const { sender, jsonBody } = msg;
  if (msg.jsonBody.v !== 1) {
    return;
  }

  const { chatMessageType, groupChatId, webrtcMsg } = jsonBody as ChatWebRTCMsgV1;

  if (chatMessageType !== 'webrtc-call' || !webrtcMsg) {
    return;
  }

  const { id, stage, data } = webrtcMsg;

  if (typeof stage !== 'string' || typeof id !== 'number' || !checkData(data)) {
    return;
  }

  const chatId: ChatIdObj =
    typeof groupChatId === 'string' && groupChatId
      ? { isGroupChat: true, chatId: groupChatId }
      : { isGroupChat: false, chatId: toCanonicalAddress(sender) };

  if (chatId.isGroupChat && chatId.chatId.includes('@')) {
    return;
  }

  return { chatId, webrtcMsg };
}

export function startStageFirst(a: WebRTCMsg, b: WebRTCMsg): -1 | 0 | 1 {
  if (a.stage === 'start') {
    return -1;
  }

  if (b.stage === 'start') {
    return 1;
  }

  return 0;
}

export async function sendSystemMgsAboutDisconnectWebRTC({
  ownAddr,
  chatId,
  recipients,
}: {
  ownAddr: string;
  chatId: ChatIdObj;
  recipients: string[];
}) {
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
    groupChatId: chatId.isGroupChat ? chatId.chatId : undefined,
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
    w3n.mail!.delivery.rmMsg(deliveryId).catch(err => w3n.log('error', JSON.stringify(err), err));
  }
}
