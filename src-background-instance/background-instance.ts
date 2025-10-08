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

import { ChatDeliveryService } from './chat-delivery-srv.ts';
import { ChatService } from './chat-service/index.ts';
import { setupGlobalReportingOfUnhandledErrors } from '../shared-libs/error-handling.ts';
import { setupAndStartVideoGUIOpener } from './video-chat/index.ts';
import { ensureDefaultAnonSenderMaxMsgSize } from './workarounds.ts';

setupGlobalReportingOfUnhandledErrors(true);

try {
  const ownAddr = await w3n.mailerid!.getUserId();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { chats, stopChatsService } = await ChatService.setupAndStartServing(ownAddr);

  chats.deleteExpiredMessages(Date.now());

  const { webrtcMsgsHandler } = setupAndStartVideoGUIOpener(
    ownAddr,
    chats.findChatEntry.bind(chats),
    chats.postProcessingForVideoChat.bind(chats),
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const stopDeliveryService = await ChatDeliveryService.setupAndStartServing(
    chats.makeChatMessagesHandler(),
    webrtcMsgsHandler,
    chats.getLatestIncomingMsgTimestamp(),
  );
} catch (err) {
  w3n.log('error', `Error in a startup of instance with main services for chat. Can't proceed, and will close the whole component.`, err);
  setTimeout(() => w3n.closeSelf!(), 100);
}

// work around incomplete/missing inbox configuration
ensureDefaultAnonSenderMaxMsgSize(100 * 1024 * 1024)
  .catch(err => {
    w3n.log('error', `Fail in checking and setting anonymous sender max message size`, err);
  });
