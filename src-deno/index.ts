/*
 Copyright (C) 2026 3NSoft Inc.

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
/* eslint-disable @typescript-eslint/no-unused-vars */
import { setupGlobalReportingOfUnhandledErrors } from '../shared-libs/error-handling.ts';
import { ensureDefaultAnonSenderMaxMsgSize } from './utils/workarounds.ts';
import { chatService } from './services/chat-service/chat-service.ts';
import { localDataStore } from './services/chat-delivery-service/local-data-store.ts';
import { videoChatService } from './services/video-chat-service/video-chat-service.ts';
import { chatDeliveryService } from './services/chat-delivery-service/chat-delivery-service.ts';

setupGlobalReportingOfUnhandledErrors(true);

try {
  const ownAddr = await w3n.mailerid!.getUserId();
  const localDataStoreSrv = await localDataStore();
  const appDeviceId = localDataStoreSrv.getAppDeviceId();
  const { chatsSrv, stopChatsService } = await chatService(ownAddr, localDataStoreSrv);
  console.log('🔵 --- CHATS SERVICE HAS STARTED --- 🔵');
  await chatsSrv.deleteExpiredMessages(Date.now());

  const latestIncomingMsgTS = chatsSrv.getLatestIncomingMsgTimestamp();
  await localDataStoreSrv.setLastReceivedMessageTimestamp(latestIncomingMsgTS || 0);

  console.log('🔵 --- LOCAL DATA STORE SERVICE HAS STARTED --- 🔵');
  console.log(`🔵 --- APP DEVICE ID [ ${appDeviceId} ] --- 🔵`);

  const { videoChatSrv } = await videoChatService(ownAddr, chatsSrv);
  console.log('🔵 --- VIDEO CHATS SERVICE HAS STARTED --- 🔵');

  const stopDeliveryService = await chatDeliveryService(chatsSrv, videoChatSrv, localDataStoreSrv);
  console.log('🔵 --- CHATS DELIVERY SERVICE HAS STARTED --- 🔵');
} catch (err) {
  w3n.log(
    'error',
    `Error in a startup of instance with main services for chat. Can't proceed, and will close the whole component.`,
    err,
  );
  setTimeout(() => w3n.closeSelf!(), 100);
}

ensureDefaultAnonSenderMaxMsgSize(100 * 1024 * 1024).catch(err => {
  w3n.log('error', `Fail in checking and setting anonymous sender max message size`, err);
});
