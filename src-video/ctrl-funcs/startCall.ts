/*
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
*/

import { videoChatSrv } from '../services/video-component-srv';
import { useStreamsStore } from '../store/streams';
import { useAppStore } from '../store/app';

export async function startCall() {
  const streams = useStreamsStore();
  const appStore = useAppStore();

  if (!streams.ownVAStream) {
    throw new Error(`Own stream is not set`);
  }
  for (const peer of streams.peers) {
    const isMicOn = streams.isMicOn;
    const isCamOn = streams.isCamOn;
    const user = appStore.user;
    const message = {
      user,
      mic: isMicOn ? 'on' : 'off',
      camera: isCamOn ? 'on' : 'off',
      isInitial: 'on',
    };
    peer.vaChannel.sendMediaStream(streams.ownVAStream, JSON.stringify(message));
  }

  videoChatSrv.notifyBkgrndInstanceOnCallStart();
}
