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

import { areAddressesEqual } from "./address-utils";

export async function startVideoCallComponent(
	chat: ChatView
): Promise<void> {
	const ownAddr = await w3n.mail!.getUserId();
	const peers: StartNewCallParam1['peers'] = chat.members
	.filter(address => !areAddressesEqual(address, ownAddr))
	.map(address => ({
		address,
		name: address,
		callRequestId: Math.floor(Number.MAX_SAFE_INTEGER * Math.random())
	}))

	// XXX need to setup webrtc CAP, giving it chat message that will be sent to
	//     tell all peers about call initialization

	await w3n.shell!.startAppWithParams!(null, 'start-new-call', { peers })
}

// XXX need here a function that should handle call starting service messages
//     by providing events that can be ahown to user as rings, followed by
//     setting webrtc CAP and opening video component.
