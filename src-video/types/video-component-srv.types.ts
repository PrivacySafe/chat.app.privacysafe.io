import type { WebRTCOffBandMessage } from '~/index';

export type SignalsListener = (data: WebRTCOffBandMessage) => Promise<void>;
