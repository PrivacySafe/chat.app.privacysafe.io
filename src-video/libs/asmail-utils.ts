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

import { areAddressesEqual } from "./address-utils.ts";
import { filter, streamFrom } from "./stream-utils.ts";

type IncomingMessage = web3n.asmail.IncomingMessage;
type OutgoingMessage = web3n.asmail.OutgoingMessage;
type DeliveryProgress = web3n.asmail.DeliveryProgress;

export type MsgType = 'chat';

export function watchIncomingMsgs(
	msgType: MsgType
): ReadableStream<IncomingMessage> {
	return streamFrom<IncomingMessage>(
		obs => w3n.mail!.inbox.subscribe('message', obs)
	).pipeThrough(filter(m => (m.msgType === msgType)));
}

export async function sendMsg(
	msg: OutgoingMessage, progress?: (p: DeliveryProgress) => void
) {
	if (!msg.recipients || (msg.recipients.length === 0)) {
		throw new Error(`No recicpients given in the message`);
	}
	const recipients = msg.recipients.concat();
	msg.carbonCopy?.forEach(addr => {
		if (!recipients.find(a => areAddressesEqual(a, addr))) {
			recipients.push(addr);
		}
	});
	const deliveryId = `#${Date.now()}-${Math.floor(Number.MAX_SAFE_INTEGER * Math.random())}`;
	await w3n.mail!.delivery.addMsg(recipients, msg, deliveryId);
	try {
		await new Promise<void>((resolve, reject) => {
			let isDone = false;
			w3n.mail!.delivery.observeDelivery(deliveryId, {
				next: p => {
					if (isDone) { return; }
					try {
						progress?.(p);
					} catch (err) {
						console.error(err);
					}
					if (p.allDone) {
						isDone = true;
						if (p.allDone === 'all-ok') {
							resolve();
						} else if (p.allDone === 'with-errors') {
							reject(p);
						}
					}
				},
				complete: () => {
					if (!isDone) {
						isDone = true;
						resolve();
					}
				},
				error: err => {
					if (!isDone) {
						isDone = true;
						reject(err);
					}
				}
			});
		});
	} finally {
		w3n.mail!.delivery.rmMsg(deliveryId).catch(err => console.error(err));
	}
}
