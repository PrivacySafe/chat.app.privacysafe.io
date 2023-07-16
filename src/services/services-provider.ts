/*
 Copyright (C) 2020 3NSoft Inc.

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
import { makeServiceCaller } from '@/libs/ipc-service-caller'
import { outgoingFileLinkStore } from '@/services/outgoing-file-link-store'

export let appContactsSrvProxy: AppContacts
export let appChatsSrvProxy: AppChatsSrv
export let appDeliverySrvProxy: AppDeliverySrv

export let fileLinkStoreSrv: FileLinkStoreService

export async function initializationServices() {

  try {
    fileLinkStoreSrv = await outgoingFileLinkStore()
    const srvConn = await w3n.rpc!.otherAppsRPC!( 'contacts.app.privacysafe.io', 'AppContacts')
    appContactsSrvProxy = makeServiceCaller<AppContacts>(
      srvConn, ['getContact',  'getContactList']
    ) as AppContacts

    const chatsSrvInternalConn = await w3n.rpc!.thisApp!('AppChatsInternal')
    appChatsSrvProxy = makeServiceCaller<AppChatsSrv>(chatsSrvInternalConn, [
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
    ]) as AppChatsSrv

    const deliverySrvConn = await w3n.rpc!.thisApp!('ChatDeliveryService')
    appDeliverySrvProxy = makeServiceCaller<AppDeliverySrv>(deliverySrvConn, [
      'start',
      'addMessageToDeliveryList',
      'removeMessageFromDeliveryList',
      'getMessage',
      'getDeliveryList',
      'removeMessageFromInbox',
    ]) as AppDeliverySrv
    await appDeliverySrvProxy.start()

    console.info('\n--- initializationServices DONE---\n')
  } catch (e) {
    console.error('\nERROR into initializationServices: ', e)
  }
}
