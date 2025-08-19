export interface DeviceOption {
  videoDevLabel: string;
  opt: MediaStreamConstraints;
}

export interface ShareOption {
  srcId: string;
  name: string;
  thumbnailURL: string;
  stream: Promise<MediaStream>;
  initiallySelected: boolean;
}

export interface ScreenShareOption extends ShareOption {
  display_id: string;
}

export interface WindowShareOption extends ShareOption {
  appIconURL?: string;
}

export interface SharedStream {
  srcId: string;
  stream: MediaStream;
  type: 'window' | 'screen';
  name: string;
}
