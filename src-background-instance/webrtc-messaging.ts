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

import { toCanonicalAddress } from './libs/address-utils.ts';
import { sendMsg } from './libs/asmail-utils.ts';

export type WebRTCSignalHandler = (msg: ChatIncomingMessage) => void;

export type MakePeerChannelsInChat = (
  chatId: string, peer: string
) => WebRTCSignalingPeerChannels;

export type NewWebRTCCallHandler = (msg: ChatIncomingMessage) => void;


class WebRTCSignalingProc {

  private readonly channelsByChats = new Map<string, Map<string, WebRTCSignalingPeerChannels>>()

  constructor(
    private readonly handleNewCall: NewWebRTCCallHandler
  ) {}

  setupChannelForChat(
    chatId: string, peer: string
  ): WebRTCSignalingPeerChannels {
    let chatChannels = this.channelsByChats.get(chatId)
    if (!chatChannels) {
      chatChannels = new Map()
      this.channelsByChats.set(chatId, chatChannels)
    }
    const canonPeerAddr = toCanonicalAddress(peer)
    let peerChannel = chatChannels.get(canonPeerAddr)
    if (!peerChannel) {
      peerChannel = new WebRTCSignalingPeerChannels(
        chatId, canonPeerAddr, () => chatChannels!.delete(canonPeerAddr)
      )
      chatChannels.set(canonPeerAddr, peerChannel)
    }
    return peerChannel
  }

  handleIncomingMsg(msg: ChatIncomingMessage): void {
    try {
      const { chatId, webrtcMsg } = msg.jsonBody!
      if (!chatId || !webrtcMsg || !webrtcMsg.channel || !webrtcMsg.data) {
        return
      }
      const chatChannels = this.channelsByChats.get(chatId)
      if (!chatChannels) {
        this.handleNewCall(msg)
        return
      }
      const peerChannels = chatChannels.get(toCanonicalAddress(msg.sender))
      if (!peerChannels) {
        // sender doesn't belong to this chat
        return
      }
      peerChannels.handleIncomingSignal(webrtcMsg)
    } catch (err) {
      // XXX should this 4+ liner to remove message be refactored,
      //     as it will be used elsewhere, noting that it also needs offline
      //     case, and may be in general it should be turned to GC-style
      //     process that can be run from multiple instances, as 2nd removal is
      //     a noop.
      // XXX also there is an eventual, but not immediate removal below
      w3n.mail!.inbox!.removeMsg(msg.msgId)
      .catch((exc: web3n.asmail.InboxException) => {
        if (!exc.msgNotFound) {
          throw exc
        }
      })
    } finally {
      // XXX add eventual removal within few minutes
    }
  }

}


export type WebRTCSignalListener = (signal: WebRTCMsg) => void;


export class WebRTCSignalingPeerChannels {

  private readonly channelListeners = new Map<string, WebRTCSignalListener>()
  private receivingBuffer: WebRTCMsg[]|undefined = undefined
  private sendingProc: Promise<void>|undefined = undefined
  private sendingBuffer: WebRTCMsg[]|undefined = undefined

  constructor(
    public readonly chatId: string,
    public readonly peerAddr: string,
    private readonly onDetach: () => void
  ) {}

  attach(channel: string, signalsListener: WebRTCSignalListener): void {
    if (this.channelListeners.has(channel)) {
      throw new Error(`Message listener is already set for peer ${this.peerAddr} in chat ${this.chatId}`)
    }
    this.channelListeners.set(channel, signalsListener)
    this.drainReceivingBuffer(channel, signalsListener)
  }

  private drainReceivingBuffer(
    channel: string, signalsListener: WebRTCSignalListener
  ): void {
    if (!this.receivingBuffer) {
      return
    }
    let i=0;
    while (i<this.receivingBuffer.length) {
      const msg = this.receivingBuffer[i]
      if (msg.channel === channel) {
        signalsListener(msg)
        this.receivingBuffer.splice(i, 1)
      } else {
        i += 1
      }
    }
    if (this.receivingBuffer.length === 0) {
      this.receivingBuffer = undefined
    }
  }

  private addToReceivingBuffer(msg: WebRTCMsg): void {
    if (!this.receivingBuffer) {
      this.receivingBuffer = []
    }
    this.receivingBuffer.push(msg)
  }

  handleIncomingSignal(msg: WebRTCMsg): void {
    const listener = this.channelListeners.get(msg.channel)
    if (listener) {
      listener(msg)
    } else {
      this.addToReceivingBuffer(msg)
    }
  }

  private addToSendingBuffer(
    channel: string, data: WebRTCOffBandMessage
  ): void {
    if (!this.sendingBuffer) {
      this.sendingBuffer = []
    }
    for (const buffered of this.sendingBuffer) {
      if (buffered.channel === channel) {
        if (Array.isArray(buffered.data)) {
          buffered.data.push(data)
        } else {
          buffered.data = [ buffered.data, data ]
        }
        return
      }
    }
    this.sendingBuffer.push({ channel, data })
  }

  sendMsg(channel: string, data: WebRTCOffBandMessage): Promise<void> {
    if (this.sendingProc) {
      this.addToSendingBuffer(channel, data)
    }
    this.sendingProc = this.sendWebRTCMsg({ channel, data })
    return this.sendingProc
  }

  private async sendWebRTCMsg(webrtcMsg: WebRTCMsg): Promise<void> {
    await sendMsg({
      msgType: 'chat',
      recipients: [ this.peerAddr ],
      jsonBody: {
        chatId: this.chatId,
        chatMessageType: 'webrtc-call',
        webrtcMsg
      } as ChatMessageJsonBody
    })
    if (this.sendingBuffer) {
      const msg = this.sendingBuffer.pop()
      if (msg) {
        return this.sendWebRTCMsg(msg)
      } else {
        this.sendingBuffer = undefined
      }
    }
    this.sendingProc = undefined
  }

  detachAll(): void {
    this.channelListeners.clear()
    this.receivingBuffer = undefined
    this.onDetach()
  }

  detachChannel(channel: string): void {
    this.channelListeners.delete(channel)
  }

}


export  function setupWebRTCSignalingPipe(
  handleNewCall: NewWebRTCCallHandler
): {
  webrtcSignalsHandler: WebRTCSignalHandler,
  webrtcChannelMaker: MakePeerChannelsInChat
} {
  const srv = new WebRTCSignalingProc(handleNewCall)
  return {
    webrtcChannelMaker: srv.setupChannelForChat.bind(srv),
    webrtcSignalsHandler: srv.handleIncomingMsg.bind(srv)
  };
}
