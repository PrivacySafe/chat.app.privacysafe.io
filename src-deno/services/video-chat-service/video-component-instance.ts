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
import type { CallFromVideoGUI, ChatInfoForCall, VideoChatComponent } from '../../../types/services.types.ts';
import type { VideoComponentInstance, WebRTCSignalListener } from '../../types/index.ts';
import { makeServiceCaller } from '../../../shared-libs/ipc/ipc-service-caller.js';

export async function videoComponentInstance(
  chat: ChatInfoForCall,
  obs: web3n.Observer<CallFromVideoGUI>,
): Promise<{ instance: VideoComponentInstance; startProc: Promise<void> }> {
  const srvConn = await w3n.rpc!.thisApp!('VideoChatComponent');
  const guiSrv = makeServiceCaller<VideoChatComponent>(
    srvConn,
    ['startVideoCallComponentForChat', 'focusWindow', 'endCall', 'handleWebRTCSignal'],
    ['watchRequests'],
  ) as VideoChatComponent;

  async function focusWindow(): Promise<void> {
    await guiSrv.focusWindow();
  }

  async function endCall(): Promise<void> {
    await guiSrv.endCall();
  }

  function getListenerForChannelTo(peer: string): WebRTCSignalListener {
    return msg => guiSrv.handleWebRTCSignal(peer, msg);
  }

  const instance: VideoComponentInstance = {
    focusWindow,
    endCall,
    getListenerForChannelTo,
  };

  guiSrv.watchRequests(obs);

  const startProc = guiSrv.startVideoCallComponentForChat(chat);

  return {
    instance,
    startProc,
  };
}
