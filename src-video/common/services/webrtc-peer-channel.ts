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

import { SingleProc, makeSyncedFunc, defer, Deferred } from '@v1nt1248/3nclient-lib/utils';
import type { OffBandSignalingChannel, OffBandMessage } from '@video/common/types';

// TODO
//  we may add a concept of callId in a chat room, to allow background
//  process to note signalling that may be reconnecting what has been closed
//  explicitly, and may tell peer to take it easy.

const CONNECTION_ACK_STR = 'connection-acknowledgement';

function assert(ok: boolean): void {
  if (!ok) {
    throw new Error(`assertion in code state fails`);
  }
}

export abstract class WebRTCPeerChannel {
  protected syncProc = new SingleProc();
  private makingOffer = false;
  private ignoreOffer = false;
  protected readonly conn: RTCPeerConnection;
  private iceCandidatesBuffer: RTCIceCandidateInit[] | undefined = [];

  /**
   * "chat" data channel.
   */
  protected dataChannel: RTCDataChannel | undefined;

  private deferredStart: Deferred<void> | undefined = defer();

  protected constructor(
    rtcConfig: RTCConfiguration,
    private readonly offBandComm: OffBandSignalingChannel,
    private readonly isPolite: boolean,
  ) {
    this.conn = new RTCPeerConnection(rtcConfig);
    this.conn.onnegotiationneeded = makeSyncedFunc(this.syncProc, this, this.handleNegotiationNeeded);
    this.conn.onicecandidate = ({ candidate }) => {
      if (candidate) {
        console.log(`📤 sending out ICE candidate:`, candidate.toJSON());
        this.offBandComm.send({ candidate });
      } else {
        console.log(`Falsy ice candidate:`, candidate);
      }
    };
    this.conn.oniceconnectionstatechange = () => {
      const { iceConnectionState } = this.conn;
      if (iceConnectionState === 'failed') {
        this.conn.restartIce();
      }
    };
    this.conn.onconnectionstatechange = () => {
      const { connectionState } = this.conn;
      if (connectionState === 'disconnected') {
        this.onWebRTCConnectionDisconnected();
      } else if (connectionState === 'connected') {
        this.onWebRTCConnected();
      }
    };
    this.conn.ontrack = this.onConnectionTrack.bind(this);
    this.offBandComm.observeIncoming(makeSyncedFunc(
      this.syncProc, this, this.handleOffBandSignal,
    ));
    this.conn.ondatachannel = ({ channel }) => {
      if (this.connectionWasAcknowledged) {
        return;
      }
      if (!this.dataChannel || this.isPolite) {
        this.dataChannel = channel;
        this.setupDataChannel(true);
      }
    };
  }

  private async handleNegotiationNeeded(): Promise<void> {
    try {
      this.makingOffer = true;
      await this.conn.setLocalDescription();
      this.offBandComm.send({
        description: this.conn.localDescription!,
      });
    } catch (err) {
      console.error(err);
    } finally {
      this.makingOffer = false;
    }
  }

  private async handleOffBandSignal({ description, candidate }: OffBandMessage): Promise<void> {
    try {
      console.log(`📩 received description`, description, `candidate`, candidate);
      if (description) {
        const offerCollision =
          (description.type === 'offer') &&
          (this.makingOffer || (this.conn.signalingState !== 'stable'));

        this.ignoreOffer = !this.isPolite && offerCollision;
        if (this.ignoreOffer) {
          return;
        }

        await this.conn.setRemoteDescription(description);
        await this.drainCandidatesBufferIfPresent();
        if (description.type === 'offer') {
          await this.conn.setLocalDescription();
          this.offBandComm.send({
            description: this.conn.localDescription!,
          });
        }
      } else if (candidate) {
        try {
          if (this.iceCandidatesBuffer) {
            this.iceCandidatesBuffer.push(candidate);
          } else {
            await this.conn.addIceCandidate(candidate);
          }
        } catch (err) {
          if (!this.ignoreOffer) {
            throw err;
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  private async drainCandidatesBufferIfPresent(): Promise<void> {
    if (this.iceCandidatesBuffer) {
      try {
        for (const iceCandidate of this.iceCandidatesBuffer) {
          await this.conn.addIceCandidate(iceCandidate);
        }
      } finally {
        this.iceCandidatesBuffer = undefined;
      }
    }
  }

  /**
   * This is called on connection's track event.
   * @param ev
   */
  protected abstract onConnectionTrack(ev: RTCTrackEvent): void;

  /**
   * This is called on connectionstatechange event, when connection state
   * is disconnected.
   */
  protected abstract onWebRTCConnectionDisconnected(): void;

  /**
   * This is called on connectionstatechange event, when connection state
   * is connected.
   */
  protected abstract onWebRTCConnected(): void;

  async close(): Promise<void> {
    try {
      this.conn.close();
      this.offBandComm.close();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) { /* empty */
    }
  }

  /**
   * This is called on message event on "chat" data channel.
   * @param ev
   */
  protected abstract onDataChannelMessage(ev: { data: string }): void;

  private setupDataChannel(sendConnectionAcknowledge: boolean): void {
    if (!this.dataChannel) {
      this.dataChannel = this.conn.createDataChannel('chat');
    }
    if (sendConnectionAcknowledge) {
      this.dataChannel.onopen = async () => {
        this.dataChannel!.send(CONNECTION_ACK_STR);
        this.deferredStart!.resolve();
        this.deferredStart = undefined;
      };
    }
    this.dataChannel.onmessage = ev => {
      if (this.connectionWasAcknowledged) {
        this.onDataChannelMessage(ev);
      } else if (ev.data === CONNECTION_ACK_STR) {
        this.deferredStart?.resolve();
        this.deferredStart = undefined;
      } else {
        this.deferredStart?.reject(new Error(
          `Unexpected connection acknowledgement msg: ${ev.data}`,
        ));
      }
    };
    this.dataChannel.onerror = ev => {
      this.deferredStart?.reject(ev);
    };
  }

  get connectionWasAcknowledged(): boolean {
    return !this.deferredStart;
  }

  /**
   * Connect opens chat data channel, triggering WebRTC negotiations.
   */
  async connect(): Promise<void> {
    if (this.connectionWasAcknowledged) {
      return;
    }
    assert(!this.dataChannel);
    this.setupDataChannel(false);
    return this.deferredStart!.promise;
  }

  get isConnected(): boolean {
    return (this.conn.connectionState === 'connected');
  }

  get connectionState(): RTCPeerConnection['connectionState'] {
    return this.conn.connectionState;
  }
}
