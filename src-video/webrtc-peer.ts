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


export class WebRTCPeer {

	private makingOffer = false;
	private ignoreOffer = false;

	private constructor(
		private readonly offBandComm: OffBandSignalingChannel,
		private readonly conn: RTCPeerConnection,
		private readonly isPolite: boolean
	) {
		this.conn.onnegotiationneeded = this.handleNegotiationNeeded.bind(this);
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
				setTimeout(() => this.close());
			}
		});
		this.offBandComm.observeIncoming(this.handleOffBandSignal.bind(this));
		Object.seal(this);
	}

	public static makeWith(
		rtcConfig: RTCConfiguration, offBandComm: OffBandSignalingChannel,
		isPolite: boolean
	): WebRTCPeer {
		const peer = new WebRTCPeer(
			offBandComm, new RTCPeerConnection(rtcConfig), isPolite
		);
		return peer;
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
				if (description.type === "offer") {
					await this.conn.setLocalDescription();
					this.offBandComm.send({
						description: this.conn.localDescription!
					});
				}
			} else if (candidate) {
				try {
					await this.conn.addIceCandidate(candidate);
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

	sendMediaStream(stream: MediaStream): void {
		for (const track of stream.getTracks()) {
			this.conn.addTrack(track, stream);
		}
	}

	set ontrack(cb: NonNullable<RTCPeerConnection['ontrack']>) {
		this.conn.addEventListener('track', cb);
	}

	set ondisconnected(cb: () => void) {
		this.conn.addEventListener('connectionstatechange', () => {
			const connState = this.conn.connectionState;
			if (connState === 'disconnected') {
				cb();
			}
		});
	}

	async close(): Promise<void> {
		try {
			this.conn.close();
			this.offBandComm.close();
		} catch (err) {}
	}

}


export interface OffBandMessageJSON {
	description?: RTCSessionDescriptionInit;
	candidate?: RTCIceCandidateInit;
}

export function msgToJSON(msg: OffBandMessage): OffBandMessageJSON {
	const { candidate, description } = msg;
	if (candidate) {
		return { candidate: candidate.toJSON() };
	} else if (description) {
		return { description: description.toJSON() };
	} else {
		throw new Error(`Message has no relevant fields.`);
	}
}

export function msgFromJSON(
	{ candidate, description }: OffBandMessageJSON
): OffBandMessage {
	if (candidate) {
		return {
			candidate: new RTCIceCandidate(candidate)
		};
	} else if (description) {
		return {
			description: new RTCSessionDescription(description)
		};
	} else {
		throw new Error(`JSON has no relevant fields`);
	}
}


export interface OffBandMessage {
	description?: RTCSessionDescription;
	candidate?: any;
}

export interface OffBandSignalingChannel {

	observeIncoming(listener: (msg: OffBandMessage) => Promise<void>): void;

	send(msg: OffBandMessage): void;

	close(): void;

}
