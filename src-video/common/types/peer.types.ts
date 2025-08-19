import { PeerChannelWithStreams } from '@video/common/services/streaming-channel.ts';

export type VideoShareStreamType = 'window' | 'screen';
export type SoundShareStreamType = 'desk-sound';
export type StreamType = 'camera+mic' | VideoShareStreamType | SoundShareStreamType;

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
