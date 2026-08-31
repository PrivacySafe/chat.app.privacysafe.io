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
import { makeLogger } from '../../../shared-libs/logger.ts';

const log = makeLogger('VideoComponentInstance');

/**
 * Methods of the call window this component calls over IPC.
 *
 * makeServiceCaller builds the RPC wrapper from this list alone, so one left
 * out is silently `undefined` at the call site - and the optional-call `?.` on
 * the other side swallows that without a line in any log. The window's own list
 * of what it answers (VIDEO_WINDOW_IPC_METHODS in
 * src-video/common/services/service-provider.ts) has to hold every one of
 * these; a spec compares the two, because the halves drifting apart already
 * left two notifications dead for four days.
 */
export const VIDEO_WINDOW_METHODS_CALLED_HERE: (keyof VideoChatComponent)[] = [
  'startVideoCallComponentForChat',
  'focusWindow',
  'endCall',
  'handleWebRTCSignal',
  'notifyOfUndeliveredSignal',
  'notifyOfRejoiningPeer',
];

export async function videoComponentInstance(
  chat: ChatInfoForCall,
  obs: web3n.Observer<CallFromVideoGUI>,
): Promise<{ instance: VideoComponentInstance; startProc: Promise<void> }> {
  const srvConn = await w3n.rpc!.thisApp!('VideoChatComponent');
  const guiSrv = makeServiceCaller<VideoChatComponent>(
    srvConn,
    VIDEO_WINDOW_METHODS_CALLED_HERE,
    ['watchRequests'],
  ) as VideoChatComponent;

  async function focusWindow(): Promise<void> {
    await guiSrv.focusWindow();
  }

  async function endCall(): Promise<void> {
    await guiSrv.endCall();
  }

  function getListenerForChannelTo(peer: string): WebRTCSignalListener {
    return msg => {
      guiSrv.handleWebRTCSignal(peer, msg).catch(err => {
        log.warn(`Failed to forward WebRTC signal to GUI for peer ${peer}`, err);
      });
    };
  }

  const instance: VideoComponentInstance = {
    focusWindow,
    endCall,
    getListenerForChannelTo,
    notifyOfUndeliveredSignal: (peer, stage) => guiSrv.notifyOfUndeliveredSignal(peer, stage),
    notifyOfRejoiningPeer: peer => guiSrv.notifyOfRejoiningPeer(peer),
  };

  guiSrv.watchRequests(obs);

  const startProc = guiSrv.startVideoCallComponentForChat(chat);

  return {
    instance,
    startProc,
  };
}
