import { PeerChannelWithStreams } from '@video/common/services/streaming-channel.ts';
import type { PeerState } from '@video/common/types';

export function toggleAudioIn(stream: MediaStream, enable: boolean): void {
  stream.getAudioTracks().forEach(audioTrack => {
    audioTrack.enabled = enable;
  });
}

export function toggleVideoIn(stream: MediaStream, enable: boolean): void {
  stream.getVideoTracks().forEach(videoTrack => {
    videoTrack.enabled = enable;
  });
}

export function makePeerState(
  peerAddr: string,
  peerName: string,
  channel: PeerChannelWithStreams,
): PeerState {
  return {
    peerAddr,
    peerName,
    isCamOn: false,
    isMicOn: false,
    streams: [],
    webRTCConnected: false,
    channel,
  };
}
