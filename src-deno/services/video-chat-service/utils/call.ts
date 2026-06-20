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
import type { WebRTCMsg } from '../../../../types/asmail-msgs.types.ts';
import type { CallFromVideoGUI, ChatInfoForCall, VideoChatEvent } from '../../../../types/services.types.ts';
import {
  CallInChat,
  ChatSrv,
  Peer,
  VideoComponentInstance,
  WebRTCSignalingPeerChannel,
} from '../../../types/index.ts';
import { toCanonicalAddress } from '../../../../shared-libs/address-utils.ts';
import { videoComponentInstance } from '../video-component-instance.ts';
import { webRTCSignalingPeerChannel } from './signaling-channels.ts';

export function callInChat({
  info,
  sinkGUIEvents,
  detachFromParent,
  postProcessingForVideoChat,
}: {
  info: ChatInfoForCall;
  sinkGUIEvents: (event: VideoChatEvent) => void;
  detachFromParent: () => void;
  postProcessingForVideoChat: ChatSrv['postProcessingForVideoChat'];
}): CallInChat {
  const peers = new Map<string, Peer>();
  let guiInstance: VideoComponentInstance | undefined = undefined;
  let callStage: 'not-started' | 'calling' | 'done' = 'not-started';

  for (const { name: peerName, addr: peerAddr } of info.peers) {
    const channel = webRTCSignalingPeerChannel({ ownAddr: info.ownAddr, chatId: info.chatId, peerAddr });
    peers.set(toCanonicalAddress(peerAddr), { peerName, peerAddr, channel });
  }

  function channelTo(peerAddr: string): WebRTCSignalingPeerChannel {
    return peers.get(toCanonicalAddress(peerAddr))!.channel;
  }

  async function onRequestCallFromVideoGUI(request: CallFromVideoGUI): Promise<void> {
    if (callStage !== 'calling') {
      return;
    }

    const { type } = request;
    try {
      switch (type) {
        case 'send-webrtc-signal': {
          const { peerAddr, data } = request;
          channelTo(peerAddr).sendMsgToPeer('signalling', data);
          break;
        }

        case 'start-channel': {
          const { peerAddr } = request;
          const listener = guiInstance!.getListenerForChannelTo(peerAddr);
          channelTo(peerAddr).attachGUI(listener);
          break;
        }

        case 'close-channel': {
          const { peerAddr } = request;
          channelTo(peerAddr).detachGUI();
          sinkGUIEvents({
            type: 'close-channel',
            chatId: info.chatId,
            peerAddr,
          });
          break;
        }

        case 'call-started-event': {
          sinkGUIEvents({
            type: 'call-started',
            chatId: info.chatId,
          });
          break;
        }

        default:
          throw `unknown event from video component`;
      }
    } catch (err) {
      await w3n.log('error', `Error in handling ${type} request from video component`, err);
    }
  }

  function onGUIComplete(): void {
    sinkGUIEvents({
      type: 'call-ended',
      chatId: info.chatId,
    });
    end();
    const { doAfterEndCall } = postProcessingForVideoChat();
    doAfterEndCall(info.chatId);
  }

  function onGUIError(err: web3n.rpc.RPCException): void {
    if (!err.connectionClosed) {
      w3n.log('error', `IPC to video call window threw an error`, err);
    }
    onGUIComplete();
  }

  async function startCall(): Promise<void> {
    if (callStage === 'done') {
      return;
    }

    if (callStage === 'not-started') {
      callStage = 'calling';
    }

    if (guiInstance) {
      await guiInstance.focusWindow();
    } else {
      const { instance, startProc } = await videoComponentInstance(info, {
        next: onRequestCallFromVideoGUI,
        complete: onGUIComplete,
        error: onGUIError,
      });
      guiInstance = instance;

      await startProc;
    }
  }

  async function end(): Promise<void> {
    if (callStage === 'done') {
      return;
    }

    if (callStage === 'calling') {
      for (const { channel } of peers.values()) {
        channel.sendMsgToPeer('disconnect', {});
        channel.detachGUI();
      }
    }

    callStage = 'done';
    detachFromParent();
  }

  async function endCallInGUI(): Promise<void> {
    guiInstance?.endCall();
  }

  function hasPeer(addr: string): boolean {
    return peers.has(toCanonicalAddress(addr));
  }

  function handleWebRTCSignalFrom(peer: string, webrtcMsg: WebRTCMsg): boolean {
    return channelTo(peer).handleIncomingSignal(webrtcMsg);
  }

  return {
    startCall,
    end,
    endCallInGUI,
    hasPeer,
    handleWebRTCSignalFrom,
  };
}
