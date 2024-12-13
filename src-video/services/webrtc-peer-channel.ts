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

import { SingleProc, makeSyncedFunc } from "@v1nt1248/3nclient-lib/utils";

export abstract class WebRTCPeerChannel {
  protected syncProc = new SingleProc();
  protected isDataChannelAvailable = false;
	private makingOffer = false;
	private ignoreOffer = false;
  protected readonly conn: RTCPeerConnection;
  private iceCandidatesBuffer: RTCIceCandidateInit[]|undefined = [];
  protected dataChannel: RTCDataChannel | undefined;

	protected constructor(
    rtcConfig: RTCConfiguration,
		private readonly offBandComm: OffBandSignalingChannel,
		private readonly isPolite: boolean
	) {
    this.conn = new RTCPeerConnection(rtcConfig);

    this.conn.onnegotiationneeded = makeSyncedFunc(
      this.syncProc, this, this.handleNegotiationNeeded
    );
    this.conn.onicecandidate = ({ candidate }) => {
      if (candidate) {
        console.log(`📤 sending out ICE candidate:`, candidate.toJSON());
        this.offBandComm.send({ candidate });
      } else {
        console.log(`Falsy ice candidate:`, candidate);
      }
    };
    this.conn.oniceconnectionstatechange = () => {
      if (this.conn.iceConnectionState === 'failed') {
        this.conn.restartIce();
      }
    };
    this.conn.addEventListener('connectionstatechange', () => {
      const connState = this.conn.connectionState;
      if (connState === 'disconnected') {
      this.onDisconnected();
      }
    });
    this.conn.addEventListener('track', this.onConnTrack.bind(this));
    this.offBandComm.observeIncoming(makeSyncedFunc(
      this.syncProc, this, this.handleOffBandSignal
    ));
  }

  private async handleNegotiationNeeded(): Promise<void> {
    try {
      this.makingOffer = true;
      await this.conn.setLocalDescription();
      this.offBandComm.send({
        description: this.conn.localDescription!
      });
    } catch (err) {
      console.error(err);
    } finally {
      this.makingOffer = false;
    }
  }

  private async handleOffBandSignal(
    { description, candidate }: OffBandMessage
  ): Promise<void> {
    try {
      console.log(`📩 received description`, description, `candidate`, candidate)
      if (description) {
        const offerCollision =
          (description.type === "offer") &&
          (this.makingOffer || (this.conn.signalingState !== "stable"));

        this.ignoreOffer = !this.isPolite && offerCollision;
        if (this.ignoreOffer) {
          return;
        }

        await this.conn.setRemoteDescription(description);
        await this.drainCandidatesBufferIfPresent();
        if (description.type === "offer") {
          await this.conn.setLocalDescription();
          this.offBandComm.send({
            description: this.conn.localDescription!
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

  protected abstract onConnTrack(ev: RTCTrackEvent): void;

  protected onDisconnected(): void {
    setTimeout(() => this.close());
  }

  async close(): Promise<void> {
    try {
      this.conn.close();
      this.offBandComm.close();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) { /* empty */ }
  }

  protected abstract onDataChannelMessage(ev: { data: string }): void;

  protected setDataChannel(initialMessage?: string): void {
    this.dataChannel = this.conn.createDataChannel('chat', { negotiated: true, id: 0 });

    this.dataChannel.addEventListener('open', async () => {
      this.isDataChannelAvailable = true;
      initialMessage && this.dataChannel?.send(initialMessage);
    });

    this.dataChannel.addEventListener('message', this.onDataChannelMessage.bind(this));

    this.conn.addEventListener('track', this.onConnTrack.bind(this));
  }
}


export interface OffBandMessage {
  description?: RTCSessionDescription;
  candidate?: RTCIceCandidateInit;
}

export interface OffBandSignalingChannel {

  observeIncoming(listener: (msg: OffBandMessage) => Promise<void>): void;

  send(msg: OffBandMessage): void;

  close(): void;

}
