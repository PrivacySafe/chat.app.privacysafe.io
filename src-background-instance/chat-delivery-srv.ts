/*
 Copyright (C) 2020 - 2024 3NSoft Inc.

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

/* eslint-disable @typescript-eslint/triple-slash-reference, @typescript-eslint/no-explicit-any, max-len */
/// <reference path="../@types/platform-defs/injected-w3n.d.ts" />
/// <reference path="../@types/platform-defs/test-stand.d.ts" />
/// <reference path="../@types/app.d.ts" />
/// <reference path="../@types/contact.d.ts" />
/// <reference path="../@types/chat.d.ts" />
/// <reference path="../@types/services.d.ts" />
// @deno-types="./libs/ipc/ipc-service.d.ts"
import { MultiConnectionIPCWrap } from './libs/ipc/ipc-service.js'
import { SingleProc } from './libs/processes/single.ts'
import { prepareMessageDeliveryInfo } from './helpers/delivery.helpers.ts'
import { ObserversSet } from './libs/observer-utils.ts';
import { WebRTCSignalHandler } from './webrtc-messaging.ts';

interface DeliveryServiceData {
  lastReceivedMessageTimestamp: number;
}

declare const w3n: web3n.testing.CommonW3N;

const deliveryServiceDataFileName = 'delivery-service-data.json'

export class ChatDeliveryService implements AppDeliverySrv {

  public readonly fileProc = new SingleProc()
  private readonly incomingChatMessageObservers = new ObserversSet<ChatIncomingMessage>()
  private readonly outgoingChatMessageObservers = new ObserversSet<DeliveryMessageProgress>()
  private data: DeliveryServiceData = {
    lastReceivedMessageTimestamp: 0,
  }
  private readonly msgHandlingProc = new SingleProc()

  private userId: string|undefined

  constructor(
    private readonly webrtcSignalsHandler: WebRTCSignalHandler,
  ) {}

  private async saveServiceDataFile(data: DeliveryServiceData): Promise<void> {
    const fs = await (w3n.storage as web3n.storage.Service).getAppLocalFS('')
    try {
      await this.fileProc.startOrChain(
        () => fs.writeJSONFile(deliveryServiceDataFileName, data)
      )
    } catch (e) {
      w3n.log!('error', 'Error saving DeliveryService data file. ', e)
    } finally {
      await fs.close()
    }
  }

  private async getServiceDataFile(): Promise<DeliveryServiceData> {
    const fs = await (w3n.storage as web3n.storage.Service).getAppLocalFS('')
    try {
      const res = await this.fileProc.startOrChain(
        () => fs.readJSONFile<DeliveryServiceData>(deliveryServiceDataFileName)
      )
      return res
    } catch (e) {
      const { notFound, path } = e as web3n.files.FileException
      if (path !== deliveryServiceDataFileName || !notFound) {
        w3n.log!('error', 'Error reading DeliveryService data file. ', e)
      }
      return {
        lastReceivedMessageTimestamp: 0,
      }
    }
  }

  private async handleMissedInboxMessages(): Promise<void> {
    const { lastReceivedMessageTimestamp } = await this.getServiceDataFile()
    this.data.lastReceivedMessageTimestamp = Math.max(lastReceivedMessageTimestamp - 60 * 1000, 0)
    const listMessages = await w3n.mail!.inbox.listMsgs(this.data.lastReceivedMessageTimestamp)
    .catch(err => w3n.log!('error', `LIST MESSAGES ERROR: `, err))
    if (listMessages) {
      for (const item of listMessages) {
        const { msgId, msgType, deliveryTS } = item
        if (msgType === 'chat') {
          try {
            const msg = await w3n.mail!.inbox.getMsg(msgId) as ChatIncomingMessage
            if (msg) {
              if (msg.jsonBody?.chatMessageType === 'webrtc-call') {
                w3n.mail!.inbox.removeMsg(msg.msgId).catch(noop)
              } else {
                this.incomingChatMessageObservers.next(msg)
                this.data.lastReceivedMessageTimestamp = Math.max(this.data.lastReceivedMessageTimestamp, deliveryTS || 0)
              }
            }
          } catch (e) {
            w3n.log!('error', `GET MSG ${msgId} ERROR: `, e)
          }
        }
      }
      await this.saveServiceDataFile(this.data)
    }
  }

  private async handleIncomingMessage(msg: IncomingMessage): Promise<void> {
    const { msgType } = msg
    if (msgType === 'chat') {
      const { jsonBody } = msg as ChatIncomingMessage
      if (jsonBody?.chatMessageType === 'webrtc-call') {
        this.webrtcSignalsHandler(msg as ChatIncomingMessage)
      } else {
        if (this.incomingChatMessageObservers.isEmpty()) {

          // XXX need trigger taskbar notifications instead of the following

          if (jsonBody.chatMessageType === 'regular') {
            await w3n.shell!.startAppWithParams!(null, 'open-chat-with', {
              chatId: jsonBody.chatId,
              peerAddress: msg.sender
            } as OpenChatCmdArg)
          }

        } else {
          this.data.lastReceivedMessageTimestamp = msg.deliveryTS
          await this.saveServiceDataFile(this.data)
          this.incomingChatMessageObservers.next(msg as ChatIncomingMessage)
        }
      }
    }
  }

  public async start(): Promise<void> {
    if (this.userId) {
      // service is already started, and second start will be echoing messages
      return;
    }
    this.userId = await w3n.mail!.getUserId()

    w3n.mail!.inbox.subscribe(
      'message',
      {
        next: msg => this.msgHandlingProc.startOrChain(
          () => this.handleIncomingMessage(msg)
        ),
        error: err => w3n.log!('error', `Inbox subscribe error: `, err),
      },
    )

    w3n.mail!.delivery.observeAllDeliveries({
      next: async (value: DeliveryMessageProgress) => {
        const { progress } = value
        const { localMeta = {} } = progress || {}
        const { path } = localMeta
        if (path?.includes('chat')) {
          this.outgoingChatMessageObservers.next(value)
        }
      },
      error: err => w3n.log!('error', `Send error: `, err),
    })
  }

  public async addMessageToDeliveryList(message: ChatOutgoingMessage, localMetaPath: ChatMessageLocalMeta, systemMessage?: boolean): Promise<void> {
    const { msgId, recipients = [] } = message
    if (msgId && recipients.length) {
      try {
        await w3n.mail!.delivery.addMsg(
          recipients,
          message,
          msgId,
          { sendImmediately: true, localMeta: { path: localMetaPath } },
        )
        if (systemMessage) {
          w3n.mail!.delivery.observeDelivery(
            msgId,
            {
              error: async () => await this.removeMessageFromDeliveryList([msgId]),
              complete: async () => await this.removeMessageFromDeliveryList([msgId]),
            }
          )
        }
      } catch (e) {
        await w3n.log!('error', `Error adding the ${systemMessage ? 'message ' : ''} ${msgId} to the delivery list. `, e)
        throw new Error(JSON.stringify(e))
      }
    }
  }

  public async removeMessageFromDeliveryList(msgIds: string[] = []): Promise<void> {
    if (msgIds.length) {
      try {
        for (const msgId of msgIds) {
          w3n.mail!.delivery.rmMsg(msgId)
        }
      } catch (e) {
        w3n.log!('error', `Error deleting the messages ${msgIds.join(', ')} from the delivery list. `, e)
        throw new Error(JSON.stringify(e))
      }
    }
  }

  public async getMessage(msgId: string): Promise<ChatIncomingMessage | undefined> {
    try {
      return w3n.mail!.inbox.getMsg(msgId) as Promise<ChatIncomingMessage | undefined>
    } catch (e) {
      w3n.log!('error', `Error getting the message ${msgId}.`)
      throw new Error(JSON.stringify(e))
    }
  }

  public async getDeliveryList(localMetaPath: ChatMessageLocalMeta): Promise<SendingMessageStatus[]> {
    const deliveredMessages = await w3n.mail!.delivery.listMsgs()
    return (deliveredMessages || []).reduce((res, message) => {
      const { id, info } = message
      const { localMeta } = info || {}
      const { path = '' } = localMeta || {}
      if (path.includes(localMetaPath)) {
        res.push({
          msgId: id,
          status: info,
          info: prepareMessageDeliveryInfo(id, info),
        })
      }

      return res
    }, [] as SendingMessageStatus[])
  }

  public async removeMessageFromInbox(msgIds: string[] = []): Promise<void> {
    if (msgIds.length) {
      try {
        for (const msgId of msgIds) {
          w3n.mail!.inbox.removeMsg(msgId)
        }
      } catch (e) {
        w3n.log!('error', `Error deleting the messages ${msgIds.join(', ')} from INBOX. `, e)
        throw new Error(JSON.stringify(e))
      }
    }
  }

  public watchIncomingMessages(obs: web3n.Observer<ChatIncomingMessage>): () => void {
    this.incomingChatMessageObservers.add(obs)
    this.msgHandlingProc.startOrChain(
      () => this.handleMissedInboxMessages()
    )
    return () => this.incomingChatMessageObservers.delete(obs)
  }

  public watchOutgoingMessages(obs: web3n.Observer<DeliveryMessageProgress>): () => void {
    this.outgoingChatMessageObservers.add(obs)
    return () => this.outgoingChatMessageObservers.delete(obs)
  }

  public completeAllWatchers(): void {
    this.incomingChatMessageObservers.complete()
    this.outgoingChatMessageObservers.complete()
  }
}

function noop() {}

export class ChatDeliveryServiceWrap extends MultiConnectionIPCWrap {
  constructor(
    srvName: string,
    private readonly fileProc: SingleProc,
  ) {
    super(srvName)
  }

  protected onListeningCompletion(): Promise<void> {
    return this.fileProc.startOrChain(async () => w3n.closeSelf?.());
  }

  protected async onListeningError(err: any): Promise<void> {
    await super.onListeningError(err);
    await this.fileProc.startOrChain(async () => w3n.closeSelf?.());
  }

}

export async function setupAndStartChatDeliveryService(
  webrtcSignalsHandler: WebRTCSignalHandler
): Promise<ChatDeliveryService> {
  const deliverySrv = new ChatDeliveryService(webrtcSignalsHandler)
  const deliverySrvWrap = new ChatDeliveryServiceWrap(
    'ChatDeliveryService', deliverySrv.fileProc
  )

  await deliverySrv.start()

  deliverySrvWrap.exposeReqReplyMethods(deliverySrv, [
    'addMessageToDeliveryList', 'removeMessageFromDeliveryList', 'getMessage', 'getDeliveryList', 'removeMessageFromInbox'
  ])
  deliverySrvWrap.exposeObservableMethods(deliverySrv, [
    'watchIncomingMessages', 'watchOutgoingMessages'
  ])

  deliverySrvWrap.startIPC()

  return deliverySrv;
}

