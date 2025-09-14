/*
Copyright (C) 2025 3NSoft Inc.

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
import { useStreamsStore } from '@video/common/store/streams.store';
import type {
  ChatIncomingMessage,
  ChatMessageJsonBodyV1,
  ChatSystemMsgV1,
  WebRTCMsgBodySysMsgData,
} from '~/asmail-msgs.types';

export function useHandleSystemMessages() {
  const streamsStore = useStreamsStore();

  async function handleSystemMessages(msg: web3n.asmail.IncomingMessage | ChatIncomingMessage) {
    const { msgType, jsonBody = {} } = msg;
    if (msgType !== 'chat' || (msgType === 'chat' && (jsonBody as ChatMessageJsonBodyV1)?.chatMessageType !== 'system')) {
      return;
    }

    const { chatSystemData } = (jsonBody || {}) as ChatSystemMsgV1;
    const { event, value } = (chatSystemData || {}) as WebRTCMsgBodySysMsgData;

    switch (event) {
      case 'webrtc-call': {
        const { subType, sender } = value;
        if (subType === 'incoming-call-cancelled') {
          await streamsStore.handlePeerDisconnected(sender)
        }
        break;
      }

      default:
        return;
    }
  }

  function initializeSystemMessagesHandler() {
    return w3n.mail?.inbox.subscribe('message', {
      next: msg => handleSystemMessages(msg),
      error: err => console.error('# WATCHING ERR => ', err),
      complete: () => console.log('# WATCHING COMPLETE #'),
    });
  }

  return {
    initializeSystemMessagesHandler,
  }
}
