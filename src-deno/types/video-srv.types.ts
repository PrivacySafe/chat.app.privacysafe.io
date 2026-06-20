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
import type {
  ChatIdObj,
  ChatIncomingMessage,
  WebRTCMsg,
  WebRTCMsgBodySysMsgData,
  WebRTCOffBandMessage,
} from '../../types/asmail-msgs.types.ts';
import type { CallFromVideoGUI, VideoChatEvent } from '../../types/services.types.ts';
import type { ChatDbEntry } from '../types/index.ts';

export type WebRTCSignalHandler = (msg: ChatIncomingMessage) => Promise<void>;

export type IncomingCallHandler = (
  chat: ChatDbEntry,
  chatId: ChatIdObj,
  peer: string,
  msg: WebRTCMsg,
) => Promise<void>;

export type WebRTCSignalListener = (signal: WebRTCMsg) => void;

export interface WebRTCSignalingPeerChannel {
  attachGUI(signalsListener: WebRTCSignalListener): void;
  detachGUI(): void;
  handleIncomingSignal(msg: WebRTCMsg): boolean;
  sendMsgToPeer(stage: 'signalling' | 'disconnect', data: WebRTCOffBandMessage): Promise<void>;
}

export interface Peer {
  peerName: string;
  peerAddr: string;
  channel: WebRTCSignalingPeerChannel;
}

export type MakePeerChannelsInChat = (chatId: ChatIdObj, peer: string) => WebRTCSignalingPeerChannel;

export interface VideoComponentInstance {
  focusWindow(): Promise<void>;
  endCall(): Promise<void>;
  getListenerForChannelTo(peer: string): WebRTCSignalListener;
}

export interface CallInChat {
  startCall(): Promise<void>;
  end(): Promise<void>;
  endCallInGUI(): Promise<void>;
  hasPeer(addr: string): boolean;
  handleWebRTCSignalFrom(peer: string, webrtcMsg: WebRTCMsg): boolean;
}

export interface VideoChatSrv {
  webrtcMsgsHandler(msg: ChatIncomingMessage): Promise<void>;
  startVideoCallForChatRoom(chatId: ChatIdObj): Promise<void>;
  joinOrDismissCallInRoom(chatId: ChatIdObj, join: boolean, sender?: string): Promise<void>;
  endVideoCallInChatRoom(chatId: ChatIdObj): Promise<void>;
  watchVideoChats(obs: web3n.Observer<VideoChatEvent>): () => void;
}
