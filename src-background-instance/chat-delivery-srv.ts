/*
 Copyright (C) 2020 - 2025 3NSoft Inc.

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


/// <reference path="../@types/platform-defs/injected-w3n.d.ts" />
/// <reference path="../@types/platform-defs/test-stand.d.ts" />
import { SingleProc } from '../shared-libs/processes/single.ts';
import type { ChatIncomingMessage } from '../types/asmail-msgs.types.ts';
import { LocalMetadataInDelivery } from '../types/chat.types.ts';
import type { ChatMessagesHandler, SendingProgressInfo } from './chat-service/index.ts';
import { WebRTCSignalHandler } from './video-chat/index.ts';

declare const w3n: web3n.caps.W3N;
type WritableFile = web3n.files.WritableFile;
type IncomingMessage = web3n.asmail.IncomingMessage;

export class ChatDeliveryService {

  private readonly chatMsgsQueue: ChatIncomingMessage[] = [];
  private readonly chatMsgsProc = new SingleProc();

  private readonly webRTCMsgsQueue: ChatIncomingMessage[] = [];
  private readonly webRTCMsgsProc = new SingleProc();

  private readonly progressNotificationsQueue: SendingProgressInfo[] = [];
  private readonly notificationsProc = new SingleProc();

  private userId: string | undefined;

  private constructor(
    private readonly chatMessages: ChatMessagesHandler,
    private readonly webrtcSignalsHandler: WebRTCSignalHandler,
    private readonly data: LocalServiceDataStore,
  ) {
  }

  static async setupAndStartServing(
    chatMessagesHandler: ChatMessagesHandler,
    webrtcSignalsHandler: WebRTCSignalHandler,
    latestIncomingMsgTS: number | undefined,
  ): Promise<() => void> {
    const deliverySrv = new ChatDeliveryService(
      chatMessagesHandler,
      webrtcSignalsHandler,
      await LocalServiceDataStore.make(latestIncomingMsgTS),
    );

    const stopMsgWatching = await deliverySrv.start();

    return () => {
      stopMsgWatching();
    };
  }

  private async start(): Promise<() => void> {
    if (this.userId) {
      throw new Error(`service is already started, and second start will be echoing messages`);
    }
    this.userId = await w3n.mail!.getUserId();

    const stopInboxWatching = w3n.mail!.inbox.subscribe(
      'message',
      {
        next: msg => this.handleIncomingMessage(msg),
        error: err => w3n.log('error', `Inbox subscribe error: `, err),
      },
    );

    const stopDeliveryWatch = w3n.mail!.delivery.observeAllDeliveries({
      next: info => this.handleSendingProgress(info),
      error: err => w3n.log('error', `Send error: `, err),
    });

    await this.handleMissedInboxMessages();

    return () => {
      stopInboxWatching();
      stopDeliveryWatch();
    };
  }

  private async handleMissedInboxMessages(): Promise<void> {
    const listMessages = await w3n.mail!.inbox.listMsgs(
      Math.max(this.data.lastReceivedMessageTimestamp - 60 * 1000, 0),
    ).catch(err => w3n.log('error', `Fail to list messages`, err));

    if (listMessages) {
      let latestDeliveryTS = 0;
      for (const item of listMessages) {
        const { msgId, msgType, deliveryTS } = item;
        if (msgType === 'chat') {
          try {
            const msg = await w3n.mail!.inbox.getMsg(msgId) as ChatIncomingMessage;
            if (msg) {
              if (msg.jsonBody?.chatMessageType === 'webrtc-call') {
                w3n.mail!.inbox.removeMsg(msg.msgId).catch(noop);
              } else {
                this.handleIncomingMessage(msg);
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
        await this.data.setLastReceivedMessageTimestamp(latestDeliveryTS);
      }
    }
  }

  private handleIncomingMessage(msg: IncomingMessage): void {
    const { msgType } = msg;
    if (msgType === 'chat') {
      const { jsonBody } = msg as ChatIncomingMessage;
      if (jsonBody?.chatMessageType === 'webrtc-call') {
        this.webRTCMsgsQueue.push(msg as ChatIncomingMessage);
        if (!this.webRTCMsgsProc.getP()) {
          this.webRTCMsgsProc.start(this.processQueuedWebRTCMsg);
        }
      } else {
        this.chatMsgsQueue.push(msg as ChatIncomingMessage);
        if (!this.chatMsgsProc.getP()) {
          this.chatMsgsProc.start(this.processQueuedChatMsg);
        }
      }
    }
  }

  private processQueuedChatMsg = async (): Promise<void> => {
    while (this.chatMsgsQueue.length > 0) {
      const msg = this.chatMsgsQueue.shift()!;
      try {
        await this.chatMessages.handleIncomingMsg(msg);
        await this.data.setLastReceivedMessageTimestamp(msg.deliveryTS);
      } catch (err) {
        await w3n.log(
          'error', `Processing incoming chat message threw an error.`, err,
        );
      }
    }
  };

  private processQueuedWebRTCMsg = async (): Promise<void> => {
    while (this.webRTCMsgsQueue.length > 0) {
      const msg = this.webRTCMsgsQueue.shift()!;
      try {
        await this.webrtcSignalsHandler(msg);
        await this.data.setLastReceivedMessageTimestamp(msg.deliveryTS);
      } catch (err) {
        await w3n.log(
          'error', `Processing incoming WebRTC signalling message threw an error.`, err,
        );
      }
    }
  };

  private handleSendingProgress(info: SendingProgressInfo): void {
    const { localMeta } = info.progress;
    if (
      localMeta && (typeof localMeta === 'object') && (localMeta as LocalMetadataInDelivery).chatId
    ) {
      this.progressNotificationsQueue.push(info);
      if (!this.notificationsProc.getP()) {
        this.notificationsProc.start(this.processQueuedNotifications);
      }
    }
  }

  private processQueuedNotifications = async (): Promise<void> => {
    while (this.progressNotificationsQueue.length > 0) {
      const info = this.progressNotificationsQueue.shift()!;
      try {
        await this.chatMessages.handleSendingProgress(info);
      } catch (err) {
        await w3n.log(
          'error', `Processing sending progress info threw an error.`, err,
        );
      }
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
function noop() {
}

interface DeliveryServiceData {
  lastReceivedMessageTimestamp: number;
}

const deliveryServiceDataFileName = 'delivery-service-data.json';

class LocalServiceDataStore {

  readonly proc = new SingleProc();
  private needsSaving = true;

  private constructor(
    private readonly file: WritableFile,
    private readonly data: DeliveryServiceData,
  ) {
  }

  static async make(
    latestIncomingMsgTS: number | undefined,
  ): Promise<LocalServiceDataStore> {
    const fs = await w3n.storage!.getAppLocalFS();
    const file = await fs.writableFile(deliveryServiceDataFileName);
    let data: DeliveryServiceData;
    if (file.isNew) {
      data = {
        lastReceivedMessageTimestamp: ((latestIncomingMsgTS === undefined) ?
            0 : latestIncomingMsgTS
        ),
      };
      await file.writeJSON(data);
    } else {
      data = await file.readJSON<DeliveryServiceData>();
      if ((latestIncomingMsgTS !== undefined)
        && (data.lastReceivedMessageTimestamp < latestIncomingMsgTS)) {
        data.lastReceivedMessageTimestamp = latestIncomingMsgTS;
        await file.writeJSON(data);
      }
    }
    return new LocalServiceDataStore(file, data);
  }

  private async saveOrderly(): Promise<void> {
    this.needsSaving = true;
    await this.proc.startOrChain(async () => {
      if (this.needsSaving) {
        await this.file.writeJSON(this.data);
        this.needsSaving = false;
      }
    });
  };

  get lastReceivedMessageTimestamp(): number {
    return this.data.lastReceivedMessageTimestamp;
  }

  async setLastReceivedMessageTimestamp(ts: number): Promise<void> {
    if (ts > this.data.lastReceivedMessageTimestamp) {
      this.data.lastReceivedMessageTimestamp = ts;
      await this.saveOrderly();
    }
  }
}
