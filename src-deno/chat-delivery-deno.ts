/* eslint-disable @typescript-eslint/triple-slash-reference, @typescript-eslint/no-explicit-any, max-len */
/// <reference path="../@types/platform-defs/injected-w3n.d.ts" />
/// <reference path="../@types/platform-defs/test-stand.d.ts" />
/// <reference path="../@types/app.d.ts" />
/// <reference path="../@types/contact.d.ts" />
/// <reference path="../@types/chat.d.ts" />
// @deno-types="./ipc-service.d.ts"
import { MultiConnectionIPCWrap } from './ipc-service.js'
// @ts-ignore
import { SingleProc } from '../src/helpers/processes.ts'
// @ts-ignore
import { prepareMessageDeliveryInfo } from './helpers/delivery.helpers.ts'

declare let Deno: {
  exit: () => void;
}

const deliveryServiceDataFileName = 'delivery-service-data.json'

class ChatDeliveryService {
  public readonly fileProc = new SingleProc()
  private readonly incomingChatMessageObservers = new Set<web3n.Observer<ChatIncomingMessage>>()
  private readonly outgoingChatMessageObservers = new Set<web3n.Observer<DeliveryMessageProgress>>()
  private data: DeliveryServiceData = {
    lastReceivedMessageTimestamp: 0,
  }

  private userId: string|undefined

  private async saveServiceDataFile(data: DeliveryServiceData): Promise<void> {
    const fs = await (w3n.storage as web3n.storage.Service).getAppLocalFS('')
    try {
      await this.fileProc.startOrChain(
        () => fs.writeJSONFile(deliveryServiceDataFileName, data)
      )
    } catch (e) {
      console.error('Error saving DeliveryService data file. ', e)
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
        console.error('Error reading DeliveryService data file. ', e)
      }
      return {
        lastReceivedMessageTimestamp: 0,
      }
    }
  }

  private async handleMissedInboxMessages(): Promise<void> {
    const { lastReceivedMessageTimestamp } = await this.getServiceDataFile()
    this.data.lastReceivedMessageTimestamp = Math.max(lastReceivedMessageTimestamp - 60 * 1000, 0)
    const listMessages = await w3n.mail?.inbox.listMsgs(this.data.lastReceivedMessageTimestamp)
    if (listMessages) {
      for (const item of listMessages) {
        const { msgId, msgType, deliveryTS } = item
        if (msgType === 'chat') {
          try {
            const msg = await w3n.mail?.inbox.getMsg(msgId) as ChatIncomingMessage
            if (msg) {
              for (const obs of this.incomingChatMessageObservers) {
                if (obs.next) {
                  obs.next(msg)
                }
              }
              this.data.lastReceivedMessageTimestamp = Math.max(this.data.lastReceivedMessageTimestamp, deliveryTS || 0)
            }
          } catch (e) {
            console.error(`GET MSG ${msgId} ERROR: `, e)
          }
        }
      }
      await this.saveServiceDataFile(this.data)
    }
  }

  public async start(): Promise<void> {
    this.userId = await w3n.mail?.getUserId()
    this.completeAllWatchers()

    await this.handleMissedInboxMessages()

    w3n.mail?.inbox.subscribe(
      'message',
      {
        next: async value => {
          const { msgType } = value
          if (msgType === 'chat') {
            const { deliveryTS } = value
            this.data.lastReceivedMessageTimestamp = deliveryTS
            await this.saveServiceDataFile(this.data)
            for (const obs of this.incomingChatMessageObservers) {
              if (obs.next) {
                obs.next(value as ChatIncomingMessage)
              }
            }
          }
        },
        error: err => console.error(`Inbox subscribe error: `, err),
      },
    )

    w3n.mail?.delivery.observeAllDeliveries({
      next: async (value: DeliveryMessageProgress) => {
        const { progress } = value
        const { localMeta = {} } = progress || {}
        const { path } = localMeta
        if (path.includes('chat')) {
          for (const obs of this.outgoingChatMessageObservers) {
            if (obs.next) {
              obs.next(value)
            }
          }
        }
      },
      error: err => console.error(`Send error: `, err),
    })
  }

  public async addMessageToDeliveryList(message: ChatOutgoingMessage, localMetaPath: ChatMessageLocalMeta, systemMessage?: boolean): Promise<void> {
    const { msgId, recipients = [] } = message
    if (msgId && recipients.length) {
      try {
        await w3n.mail?.delivery.addMsg(
          recipients,
          message,
          msgId,
          { sendImmediately: true, localMeta: { path: localMetaPath } },
        )
        if (systemMessage) {
          w3n.mail?.delivery.observeDelivery(
            msgId,
            {
              error: async () => await this.removeMessageFromDeliveryList([msgId]),
              complete: async () => await this.removeMessageFromDeliveryList([msgId]),
            }
          )
        }
      } catch (e) {
        console.error(`Error adding the ${systemMessage ? 'message ' : ''} ${msgId} to the delivery list. `, e)
        throw new Error(JSON.stringify(e))
      }
    }
  }

  public async removeMessageFromDeliveryList(msgIds: string[] = []): Promise<void> {
    if (msgIds.length) {
      try {
        for (const msgId of msgIds) {
          w3n.mail?.delivery.rmMsg(msgId)
        }
      } catch (e) {
        console.error(`Error deleting the messages ${msgIds.join(', ')} from the delivery list. `, e)
        throw new Error(JSON.stringify(e))
      }
    }
  }

  public async getMessage(msgId: string): Promise<ChatIncomingMessage | undefined> {
    try {
      return w3n.mail?.inbox.getMsg(msgId) as Promise<ChatIncomingMessage | undefined>
    } catch (e) {
      console.error(`Error getting the message ${msgId}.`)
      throw new Error(JSON.stringify(e))
    }
  }

  public async getDeliveryList(localMetaPath: ChatMessageLocalMeta): Promise<SendingMessageStatus[]> {
    const deliveredMessages = await w3n.mail?.delivery.listMsgs()
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
          w3n.mail?.inbox.removeMsg(msgId)
        }
      } catch (e) {
        console.error(`Error deleting the messages ${msgIds.join(', ')} from INBOX. `, e)
        throw new Error(JSON.stringify(e))
      }
    }
  }

  public watchIncomingMessages(obs: web3n.Observer<ChatIncomingMessage>): () => void {
    this.incomingChatMessageObservers.add(obs)
    return () => {
      this.incomingChatMessageObservers.delete(obs)
    }
  }

  public watchOutgoingMessages(obs: web3n.Observer<DeliveryMessageProgress>): () => void {
    this.outgoingChatMessageObservers.add(obs)
    return () => {
      this.outgoingChatMessageObservers.delete(obs)
    }
  }

  public completeAllWatchers(): void {
    for (const obs of this.incomingChatMessageObservers) {
      if (obs.complete) {
        obs.complete()
      }
    }
    this.incomingChatMessageObservers.clear()

    for (const obs of this.outgoingChatMessageObservers) {
      if (obs.complete) {
        obs.complete()
      }
    }
    this.outgoingChatMessageObservers.clear()
  }
}

class ChatDeliveryServiceWrap extends MultiConnectionIPCWrap {
  constructor(
    srvName: string,
    private readonly fileProc: SingleProc,
  ) {
    super(srvName)
  }

  protected onListeningCompletion(): Promise<void> {
    return this.fileProc.startOrChain(async () => Deno.exit());
  }

  protected async onListeningError(err: any): Promise<void> {
    await super.onListeningError(err);
    await this.fileProc.startOrChain(async () => Deno.exit());
  }
}

const deliverySrv = new ChatDeliveryService()
const deliverySrvWrap = new ChatDeliveryServiceWrap('ChatDeliveryService', deliverySrv.fileProc)

deliverySrvWrap.exposeReqReplyMethods(deliverySrv, [
  'start', 'addMessageToDeliveryList', 'removeMessageFromDeliveryList', 'getMessage', 'getDeliveryList', 'removeMessageFromInbox',
])
deliverySrvWrap.exposeObservableMethods(deliverySrv, ['watchIncomingMessages', 'watchOutgoingMessages'])

deliverySrvWrap.startIPC()
