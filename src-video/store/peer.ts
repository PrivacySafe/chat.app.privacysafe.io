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

import { PeerChannelWithStreams } from "@video/services/streaming-channel";

export type VideoShareStreamType = 'window' | 'screen';
export type SoundShareStreamType = 'desk-sound';
export type StreamType = 'camera+mic' |
VideoShareStreamType | SoundShareStreamType;

export function makePeerState(
  peerAddr: string, peerName: string,
  channel: PeerChannelWithStreams
): PeerState {
  return {
    peerAddr,
    peerName,
    isCamOn: false,
    isMicOn: false,
    streams: [],
    webRTCConnected: false,
    channel
  };
}

export interface PeerState {
  peerAddr: string;
  peerName: string;
  isMicOn: boolean;
  isCamOn: boolean;
  streams: StreamWithInfo[];
  webRTCConnected: boolean;
  channel: PeerChannelWithStreams;
}

export interface StreamWithInfo {
  type: StreamType;
  stream: MediaStream;
  tracks: string[];
}

export function usePeerFuncs(getPeer: (peerAddr: string) => PeerState) {

  function addPeerStreamTrack(
    peerAddr: string, type: StreamType, stream: MediaStream, trackId: string
  ) {
    const { streams } = getPeer(peerAddr);
    const streamWithInfo = streams.find(
      ({ stream: { id } }) => (id === stream.id)
    );
    if (streamWithInfo) {
      streamWithInfo.tracks.push(trackId);
    } else {
      streams.push({
      type, stream, tracks: [ trackId ]
      });
    }
  }
  
  function removePeerStreamTrack(
    peerAddr: string, streamId: string, trackId: string
  ) {
    const { streams } = getPeer(peerAddr);
    const indOfStream = streams.findIndex(
      ({ stream: { id } }) => (id === streamId)
    );
    if (indOfStream < 0) {
      return;
    }
    const { tracks } = streams[indOfStream];
    const indOfTrack = tracks.indexOf(trackId);
    if (indOfTrack >= 0) {
      if (tracks.length > 1) {
      tracks.splice(indOfTrack, 1);
      } else {
      streams.splice(indOfStream, 1);
      }
    }
  }
  
  function removePeerStream(peerAddr: string, streamId: string) {
    const { streams } = getPeer(peerAddr);
    const indOfStream = streams.findIndex(
      ({ stream: { id } }) => (id === streamId)
    );
    if (indOfStream < 0) {
      return;
    }
    streams.splice(indOfStream, 1);
  }
  
  function getPeerStream(peerAddr: string, streamId: string) {
    const { streams } = getPeer(peerAddr);
    return streams.find(({ stream: { id } }) => (id === streamId));
  }
  
  function getPeerStreams(peerAddr: string, type: StreamType) {
    const { streams } = getPeer(peerAddr);
    return streams.filter(s => (s.type === type))
    .map(({ stream }) => stream);
  }
  
  function hasTrackON(
    peerAddr: string, streamType: StreamType, trackType: 'audio'|'video'
  ): boolean {
    const { streams } = getPeer(peerAddr);
    for (const { stream, type } of streams) {
      if (type !== streamType) {
      continue;
      }
      if (trackType === 'audio') {
      if (stream.getAudioTracks().find(t => t.enabled)) {
        return true;
      }
      } else if (trackType === 'video') {
      if (stream.getVideoTracks().find(t => t.enabled)) {
        return true;
      }
      }
    }
    return false;
  }
  
  function syncUIWithPeerTracksState(peerAddr: string): void {
    const peer = getPeer(peerAddr);
    peer.isMicOn = hasTrackON(peerAddr, 'camera+mic', 'audio');
    peer.isCamOn = hasTrackON(peerAddr, 'camera+mic', 'video');
  }
  

  return {
    addPeerStreamTrack,
    removePeerStreamTrack,
    removePeerStream,
    getPeerStream,
    getPeerStreams,
    hasTrackON,
    syncUIWithPeerTracksState
  };
  }