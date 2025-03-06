/*
 Copyright (C) 2020, 2024 3NSoft Inc.

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

import { makeServiceCaller } from '@shared/ipc/ipc-service-caller';
import { outgoingFileLinkStore } from './outgoing-file-link-store';
import type { AppContacts, AppChatsSrv, AppDeliverySrv, FileLinkStoreService, VideoGUIOpener } from '~/index';

export let fileLinkStoreSrv: FileLinkStoreService;
export let appContactsSrvProxy: AppContacts;
export let appChatsSrvProxy: AppChatsSrv;
export let appDeliverySrvProxy: AppDeliverySrv;
export let videoOpenerProxy: VideoGUIOpener;

export async function initializationServices() {
  try {

    ([
      fileLinkStoreSrv,
      appContactsSrvProxy,
      appChatsSrvProxy,
      appDeliverySrvProxy,
      videoOpenerProxy,
    ] = await Promise.all([

      outgoingFileLinkStore(),

      w3n.rpc!.otherAppsRPC!('contacts.app.privacysafe.io', 'AppContacts')
        .then(srvConn => makeServiceCaller<AppContacts>(
          srvConn, ['getContact', 'getContactList', 'upsertContact'],
        ) as AppContacts),

      w3n.rpc!.thisApp!('AppChatsInternal')
        .then(srvConn => makeServiceCaller<AppChatsSrv>(srvConn, [
          'getChatList',
          'createChat',
          'updateChat',
          'getChatsUnreadMessagesCount',
          'getChat',
          'deleteChat',
          'clearChat',
          'getMessage',
          'deleteMessage',
          'getMessagesByChat',
          'upsertMessage',
        ]) as AppChatsSrv),

      w3n.rpc!.thisApp!('ChatDeliveryService')
        .then(srvConn => makeServiceCaller<AppDeliverySrv>(srvConn, [
          'addMessageToDeliveryList',
          'removeMessageFromDeliveryList',
          'getMessage',
          'getDeliveryList',
          'removeMessageFromInbox',
        ]) as AppDeliverySrv),

      w3n.rpc!.thisApp!('VideoGUIOpener')
        .then(srvConn => makeServiceCaller<VideoGUIOpener>(srvConn, [
          'startVideoCallForChatRoom', 'joinCallInRoom',
        ], [
          'watchVideoChats',
        ]) as VideoGUIOpener),

    ]));

    console.info('\n--- initializationServices DONE---\n');
  } catch (err) {
    w3n.log('error', 'ERROR in initializationServices', err);
    throw err;
  }
}
