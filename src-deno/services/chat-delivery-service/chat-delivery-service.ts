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
import type { ChatIncomingMessage } from '../../../types/asmail-msgs.types.ts';
import type { LocalMetadataInDelivery } from '../../../types/chat.types.ts';
import type { ChatSrv, LocalDataStore, SendingProgressInfo, VideoChatSrv } from '../../types/index.ts';
import { SingleProc } from '../../../shared-libs/processes/single.ts';

export async function chatDeliveryService(
  chatsSrv: ChatSrv,
  videoChatSrv: VideoChatSrv,
  localDataStoreSrv: LocalDataStore,
) {
  const { handleIncomingMsg, handleSendingProgress: _handleSendingProgress } = chatsSrv.makeChatMessagesHandler();
  const { webrtcMsgsHandler } = videoChatSrv;

  const chatMsgsQueue: ChatIncomingMessage[] = [];
  const chatMsgsProc = new SingleProc();

  const webRTCMsgsQueue: ChatIncomingMessage[] = [];
  const webRTCMsgsProc = new SingleProc();

  const progressNotificationsQueue: SendingProgressInfo[] = [];
  const notificationsProc = new SingleProc();

  let userId: string | undefined;

  async function processQueuedChatMsg() {
    while (chatMsgsQueue.length > 0) {
      const msg = chatMsgsQueue.shift()!;
      try {
        await handleIncomingMsg(msg);
        await localDataStoreSrv.setLastReceivedMessageTimestamp(msg.deliveryTS);
      } catch (err) {
        await w3n.log('error', `Processing incoming chat message threw an error.`, err);
      }
    }
  }

  async function processQueuedWebRTCMsg() {
    while (webRTCMsgsQueue.length > 0) {
      const msg = webRTCMsgsQueue.shift()!;
      try {
        await webrtcMsgsHandler(msg);
        await localDataStoreSrv.setLastReceivedMessageTimestamp(msg.deliveryTS);
      } catch (err) {
        await w3n.log('error', `Processing incoming WebRTC signalling message threw an error.`, err);
      }
    }
  }

  async function processQueuedNotifications() {
    while (progressNotificationsQueue.length > 0) {
      const info = progressNotificationsQueue.shift()!;
      try {
        await _handleSendingProgress(info);
      } catch (err) {
        await w3n.log('error', `Processing sending progress info threw an error.`, err);
      }
    }
  }

  async function handleMissedInboxMessages(): Promise<void> {
    const listMessages = await w3n
      .mail!.inbox.listMsgs(Math.max(localDataStoreSrv.getLastReceivedMessageTimestamp() - 60 * 1000, 0))
      .catch(err => w3n.log('error', `Fail to list messages`, err));

    if (listMessages) {
      let latestDeliveryTS = 0;
      for (const item of listMessages) {
        const { msgId, msgType, deliveryTS } = item;
        if (msgType === 'chat') {
          try {
            const msg = (await w3n.mail!.inbox.getMsg(msgId)) as ChatIncomingMessage;
            if (msg) {
              if (msg.jsonBody?.chatMessageType === 'webrtc-call') {
                w3n.mail!.inbox.removeMsg(msg.msgId).catch(() => void 0);
              } else {
                handleIncomingMessage(msg);
                if (deliveryTS > latestDeliveryTS) {
                  latestDeliveryTS = deliveryTS;
                }
              }
            }
          } catch (e) {
            w3n.log('error', `Fail to get message ${msgId}`, e);
          }
        }
      }
      if (latestDeliveryTS > 0) {
        await localDataStoreSrv.setLastReceivedMessageTimestamp(latestDeliveryTS);
      }
    }
  }

  function handleIncomingMessage(msg: web3n.asmail.IncomingMessage) {
    const { msgType } = msg;
    if (msgType === 'chat') {
      const { jsonBody } = msg as ChatIncomingMessage;

      if (jsonBody?.chatMessageType === 'webrtc-call') {
        webRTCMsgsQueue.push(msg as ChatIncomingMessage);
        if (!webRTCMsgsProc.getP()) {
          webRTCMsgsProc.start(processQueuedWebRTCMsg);
        }
        return;
      }

      chatMsgsQueue.push(msg as ChatIncomingMessage);
      if (!chatMsgsProc.getP()) {
        chatMsgsProc.start(processQueuedChatMsg);
      }
    }
  }

  function handleSendingProgress(info: SendingProgressInfo): void {
    const { localMeta } = info.progress;
    if (localMeta && typeof localMeta === 'object' && (localMeta as LocalMetadataInDelivery).chatId) {
      progressNotificationsQueue.push(info);
      if (!notificationsProc.getP()) {
        notificationsProc.start(processQueuedNotifications);
      }
    }
  }

  async function initialize() {
    if (userId) {
      throw new Error(`service is already started, and second start will be echoing messages`);
    }

    userId = await w3n.mail!.getUserId();

    const stopInboxWatching = w3n.mail!.inbox.subscribe('message', {
      next: msg => handleIncomingMessage(msg),
      error: err => w3n.log('error', `Inbox subscribe error: `, err),
    });

    const stopDeliveryWatch = w3n.mail!.delivery.observeAllDeliveries({
      next: info => handleSendingProgress(info),
      error: err => w3n.log('error', `Send error: `, err),
    });

    await handleMissedInboxMessages();

    return () => {
      stopInboxWatching();
      stopDeliveryWatch();
    };
  }

  const stopMsgWatching = await initialize();
  const stopDeliveryService = () => {
    stopMsgWatching();
  };

  return {
    stopDeliveryService,
  };
}
