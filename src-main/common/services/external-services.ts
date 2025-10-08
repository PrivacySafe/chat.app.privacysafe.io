/*
 Copyright (C) 2020, 2024 - 2025 3NSoft Inc.

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

import { makeOutgoingFileLinkStore } from '@bg/dataset/versions/v0-none/attachments.ts';
import { makeServiceCaller } from '@shared/ipc/ipc-service-caller';
import type { ContactsService, ChatServiceIPC, FileLinkStoreService, VideoGUIOpener } from '~/index.ts';

export let fileLinkStoreSrv: FileLinkStoreService;
export let appContactsSrv: ContactsService;
export let chatService: ChatServiceIPC;
export let videoOpenerSrv: VideoGUIOpener;

export async function initializeServices() {
  try {

    ([
      fileLinkStoreSrv,
      appContactsSrv,
      chatService,
      videoOpenerSrv,
    ] = await Promise.all([

      makeOutgoingFileLinkStore(),

      w3n.rpc!.otherAppsRPC!('contacts.app.privacysafe.io', 'AppContacts')
      .then(srvConn => makeServiceCaller<ContactsService>(srvConn, [
        'isThereContactWithTheMail',
        'getContactByMail',
        'getContact',
        'getContactList',
        'upsertContact',
        'insertContact'
      ]) as ContactsService),

      w3n.rpc!.thisApp!('AppChatsInternal')
      .then(srvConn => makeServiceCaller<ChatServiceIPC>(srvConn, [
        'createOneToOneChat',
        'createGroupChat',
        'acceptChatInvitation',
        'getChat',
        'getChatList',
        'renameChat',
        'chatSetUp',
        'deleteChat',
        'updateGroupMembers',
        'updateGroupAdmins',
        'deleteMessagesInChat',
        'deleteMessage',
        'deleteMessages',
        'deleteExpiredMessages',
        'getMessage',
        'getMessagesByChat',
        'sendRegularMessage',
        'markMessageAsReadNotifyingSender',
        'checkAddressExistenceForASMail',
        'getIncomingMessage',
        'updateEarlySentMessage',
        'changeMessageReaction',
        'sendSystemDeletableMessage',
        'makeAndSaveMsgToDb',
      ], [
        'watch'
      ]) as ChatServiceIPC),

      w3n.rpc!.thisApp!('VideoGUIOpener')
      .then(srvConn => makeServiceCaller<VideoGUIOpener>(srvConn, [
        'startVideoCallForChatRoom',
        'joinOrDismissCallInRoom',
        'endVideoCallInChatRoom',
      ], [
        'watchVideoChats',
      ]) as VideoGUIOpener),
    ]));

    console.info('<- SERVICES ARE INITIALIZED ->');
  } catch (err) {
    w3n.log('error', '# ERROR WHILE SERVICES INITIALISE # ', err);
    throw err;
  }
}
