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

// @deno-types="../../shared-libs/ipc/ipc-service-caller.d.ts"
import { makeServiceCaller } from '../../shared-libs/ipc/ipc-service-caller.js';
import { WebRTCSignalingPeerChannel, WebRTCSignalListener } from './signalling-channels.ts';
import type {
  ChatInfoForCall,
  CallFromVideoGUI,
  VideoChatComponent,
  ChatIdObj,
} from '../../types/index.ts';

export type MakePeerChannelsInChat = (
  chatId: ChatIdObj, peer: string,
) => WebRTCSignalingPeerChannel;

export class VideoComponentInstance {

  private constructor(
    private readonly chat: ChatInfoForCall,
    private guiSrv: VideoChatComponent
  ) {}

  static async makeAndStart(
    chat: ChatInfoForCall, obs: web3n.Observer<CallFromVideoGUI>
  ): Promise<{ instance: VideoComponentInstance; startProc: Promise<void> }> {
    const srvConn = await w3n.rpc!.thisApp!('VideoChatComponent');
    const guiSrv = makeServiceCaller<VideoChatComponent>(srvConn, [
      'startVideoCallComponentForChat',
      'focusWindow',
      'closeWindow',
      'handleWebRTCSignal',
    ], [
      'watchRequests',
    ]) as VideoChatComponent;
    const instance = new VideoComponentInstance(chat, guiSrv);
    instance.guiSrv.watchRequests(obs);
    const startProc = instance.guiSrv.startVideoCallComponentForChat(instance.chat);
    return { instance, startProc };
  }

  async focusWindow(): Promise<void> {
    await this.guiSrv!.focusWindow();
  }

  getListenerForChannelTo(peer: string): WebRTCSignalListener {
    return msg => this.guiSrv!.handleWebRTCSignal(peer, msg);
  }

}

