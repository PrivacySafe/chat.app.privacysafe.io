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

import { setupAndStartChatDeliveryService } from './chat-delivery-srv.ts';
import { setupAndStartAppChatsInternalService } from './chats-internal-srv.ts';
import { setupGlobalReportingOfUnhandledErrors } from './libs/error-handling.ts';
import { setupAndStartVideoGUIOpener } from './video-gui-controller.ts';

setupGlobalReportingOfUnhandledErrors(true);

try {

  const ownAddr = await w3n.mailerid!.getUserId();

  const chatsSrv = await setupAndStartAppChatsInternalService();

  const webrtcSignalsHandler = setupAndStartVideoGUIOpener(ownAddr, chatsSrv);

  const deliverySrv = await setupAndStartChatDeliveryService(
    webrtcSignalsHandler,
  );

} catch (err) {
  w3n.log('error', `Error in a startup of instance with main services for chat. Can't proceed, and will close the whole component.`, err);
  setTimeout(() => w3n.closeSelf!(), 100);
}
