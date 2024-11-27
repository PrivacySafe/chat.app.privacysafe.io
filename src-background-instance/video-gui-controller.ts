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

import { ObserversSet } from './libs/observer-utils.ts';
// @deno-types="./libs/ipc/ipc-service-caller.d.ts"
import { makeServiceCaller } from './libs/ipc/ipc-service-caller.js';
// @deno-types="./libs/ipc/ipc-service.d.ts"
import { MultiConnectionIPCWrap } from './libs/ipc/ipc-service.js';
import { areAddressesEqual, toCanonicalAddress } from './libs/address-utils.ts';
import { ChatService } from './chats-internal-srv.ts';
import {
  WebRTCSignalingPeerChannels,
  MakePeerChannelsInChat,
  setupWebRTCSignalingPipe,
  WebRTCSignalHandler,
} from './webrtc-messaging.ts';
import { SingleProc } from './libs/processes/single.ts';
import type {
  ChatInfoForCall,
  CallGUIEvent,
  ChatIncomingMessage,
  IncomingCallCmdArg,
  VideoChatComponent,
  OutgoingWebRTCSignalEvent,
  VideoChatEvent,
  VideoGUIOpener,
  WebRTCMsg,
} from '../types/index.ts';

interface Peer {
  peerName: string;
  peerAddr: string;
  channels: WebRTCSignalingPeerChannels;
}

const vaChannel = 'video/audio';

class CallGUI {
  public readonly chatId: string;
  private readonly peers = new Map<string, Peer>;
  private guiSrv: VideoChatComponent | undefined = undefined;

  constructor(
    private readonly chat: ChatInfoForCall,
    makePeerChannels: MakePeerChannelsInChat,
  ) {
    this.chatId = chat.chatId;
    for (const peer of chat.peers) {
      const peerCanonicalAddr = toCanonicalAddress(peer.addr);
      this.peers.set(peerCanonicalAddr, {
        peerAddr: peer.addr,
        peerName: peer.name,
        channels: makePeerChannels(chat.chatId, peer.addr),
      });
    }
  }

  get started(): boolean {
    return !!this.guiSrv;
  }

  async start(obs: web3n.Observer<CallGUIEvent>): Promise<void> {
    if (this.guiSrv) {
      throw new Error(`Video GUI was already started`);
    }
    const srvConn = await w3n.rpc!.thisApp!('VideoChatComponent');
    this.guiSrv = makeServiceCaller<VideoChatComponent>(srvConn, [
      'closeWindow', 'focusWindow', 'startCallGUIForChat',
      'handleWebRTCSignal',
    ], [
      'watch',
    ]) as VideoChatComponent;
    this.guiSrv.watch(obs);
    await this.guiSrv.startCallGUIForChat(this.chat);
  }

  hasPeer(addr: string): boolean {
    return this.peers.has(toCanonicalAddress(addr));
  }

  private getPeer(addr: string): Peer {
    const peer = this.peers.get(toCanonicalAddress(addr));
    if (!peer) {
      throw new Error(`Peer ${addr} is not found`);
    }
    return peer;
  }

  sendSignalToPeer(
    event: OutgoingWebRTCSignalEvent,
  ): void {
    const { channel, data, peerAddr } = event;
    const peer = this.getPeer(peerAddr);
    peer.channels.sendMsg(channel, data);
  }

  async focusWindow(): Promise<void> {
    await this.guiSrv!.focusWindow();
  }

  connectChannel(channel: string, peerAddr: string): void {
    const peer = this.getPeer(peerAddr);
    peer.channels.attach(
      channel, msg => this.guiSrv!.handleWebRTCSignal(peerAddr, msg),
    );
  }

  disconnectAllChannels(): void {
    this.peers.forEach(({ channels }) => channels.detachAll());
  }

  disconnectChannel(channel: string, peerAddr: string): void {
    const peer = this.getPeer(peerAddr);
    peer.channels.detachChannel(channel);
  }

  bufferFirstMsg(
    peerAddr: string, msg: WebRTCMsg,
  ): void {
    const peer = this.getPeer(peerAddr);
    peer.channels.handleIncomingSignal(msg);
  }

}


class ChatCallsController implements VideoGUIOpener {
  private readonly videoChatsObs = new ObserversSet<VideoChatEvent>();
  private readonly calls = new Map<string, CallGUI>();
  private readonly callCreationProc = new SingleProc();

  constructor(
    private readonly ownAddr: string,
    private readonly chatsSrv: ChatService,
    private readonly makePeerChannels: MakePeerChannelsInChat,
  ) {
  }

  private async getOrCreateCallGUI(chatId: string): Promise<CallGUI> {
    let call = this.calls.get(chatId);
    if (call) {
      return call;
    } else if (this.callCreationProc.getP()) {
      return this.callCreationProc.startOrChain(
        () => this.getOrCreateCallGUI(chatId),
      );
    } else {
      return this.callCreationProc.addStarted(
        this.chatInfoForNewCall(chatId)
          .then(chat => this.createAndRegisterCallGUI(chat)),
      );
    }
  }

  private async createAndRegisterCallGUI(
    chat: ChatInfoForCall,
  ): Promise<CallGUI> {
    const call = new CallGUI(chat, this.makePeerChannels);
    this.calls.set(chat.chatId, call);
    return call;
  }

  private makeGuiObs(chatId: string): web3n.Observer<CallGUIEvent> {
    return {
      next: event => this.onCallEvent(chatId, event),
      complete: () => this.onCallComplete(chatId),
      error: err => this.onCallError(chatId, err),
    };
  }

  private nameFromAddr(addr: string): string {
    if (addr.indexOf('@') === 0) {
      return addr;
    } else {
      return addr.substring(0, addr.indexOf('@'));
    }
  }

  private callPeersFrom(chatMembers: string[]): ChatInfoForCall['peers'] {
    return chatMembers
      .filter(addr => !areAddressesEqual(addr, this.ownAddr))
      .map(addr => ({ addr, name: this.nameFromAddr(addr) }));
  }

  private async onCallEvent(chatId: string, event: CallGUIEvent) {
    const call = this.calls.get(chatId);
    if (!call) {
      return;
    }
    const { type } = event;
    if (type === 'webrtc-signal') {
      call.sendSignalToPeer(event);
    } else if (type === 'start-channel') {
      const { channel, peerAddr } = event;
      call.connectChannel(channel, peerAddr);
    } else if (type === 'close-channel') {
      const { channel, peerAddr } = event;
      call.disconnectChannel(channel, peerAddr);
    } else if (type === 'call-started') {
      this.videoChatsObs.next({
        type: 'call-started',
        chatId: call.chatId,
      });
    } else {
      throw new Error(`unknown event from video component`);
    }
  }

  private onCallComplete(chatId: string) {
    const call = this.calls.get(chatId);
    if (!call) {
      return;
    }
    this.calls.delete(chatId);
    call.disconnectAllChannels();
    this.videoChatsObs.next({
      type: 'call-ended',
      chatId: call.chatId,
    });
  }

  private onCallError(chatId: string, err: web3n.rpc.RPCException) {
    const call = this.calls.get(chatId);
    if (!call) {
      return;
    }
    if (err.connectionClosed) {
      this.onCallComplete(chatId);
    } else {
      this.calls.delete(chatId);

      // XXX
      console.log(`🚧 broadcast notification of call error and closing is not implemented, yet`, err);

    }
  }

  async startVideoCallForChatRoom(chatId: string): Promise<void> {
    let call = await this.getOrCreateCallGUI(chatId);
    if (call.started) {
      await call.focusWindow();
    } else {
      await call.start(this.makeGuiObs(chatId));
    }
  }

  private async chatInfoForNewCall(chatId: string): Promise<ChatInfoForCall> {
    const foundChat = await this.chatsSrv.getChat(chatId);
    if (!foundChat) {
      throw new Error(`Chat room '${chatId}' is unknown`);
    }
    return {
      chatId,
      ownAddr: this.ownAddr,
      ownName: this.nameFromAddr(this.ownAddr),
      peers: this.callPeersFrom(foundChat.members),
      chatName: foundChat.name,
      rtcConfig: rtcStaticConfig,
    };
  }

  async joinCallInRoom({ chatId, peerAddress }: IncomingCallCmdArg): Promise<void> {
    const call = this.calls.get(chatId);
    if (call) {
      if (!call.hasPeer(peerAddress)) {
        return;
      }
      if (call.started) {
        await call.focusWindow();
      } else {
        await call.start(this.makeGuiObs(chatId));
      }
    }
  }

  watchVideoChats(obs: web3n.Observer<VideoChatEvent>): () => void {
    this.videoChatsObs.add(obs);
    return () => this.videoChatsObs.delete(obs);
  }

  async handleNewCall(msg: ChatIncomingMessage): Promise<void> {
    console.log(`handleNewCall, p 1`);
    try {
      const { sender, jsonBody: { chatId, webrtcMsg } } = msg;
      if (!webrtcMsg || !chatId || (webrtcMsg.channel !== 'video/audio')) {
        return;
      }

      console.log(`handleNewCall, p 2`);
      const foundChat = await this.chatsSrv.getChat(chatId);
      // @ts-ignore
      if (!foundChat?.members.find(addr => areAddressesEqual(addr, sender))) {
        return;
      }

      console.log(`handleNewCall, p 3`);
      const call = await this.getOrCreateCallGUI(chatId);
      call.bufferFirstMsg(sender, webrtcMsg);

      console.log(`handleNewCall, p 4`);
      const cmdArg: IncomingCallCmdArg = {
        chatId,
        peerAddress: sender,
      };
      await w3n.shell!.startAppWithParams!(null, 'incoming-call', cmdArg);
      console.log(`handleNewCall, p 5`);
    } finally {
      // XXX add eventual removal within few minutes
    }
  }
}

const rtcStaticConfig: RTCConfiguration = {
  iceServers: [{
    urls: ['stun:stunserver2024.stunprotocol.org:3478'],
  }],
  iceTransportPolicy: 'all',
};

export function setupAndStartVideoGUIOpener(
  ownAddr: string, chatsSrv: ChatService,
): WebRTCSignalHandler {
  const {
    webrtcChannelMaker, webrtcSignalsHandler,
  } = setupWebRTCSignalingPipe(msg => srv.handleNewCall(msg));
  const srv = new ChatCallsController(ownAddr, chatsSrv, webrtcChannelMaker);
  const srvWrap = new MultiConnectionIPCWrap('VideoGUIOpener');
  srvWrap.exposeReqReplyMethods(srv, [
    'startVideoCallForChatRoom', 'joinCallInRoom',
  ]);
  srvWrap.exposeObservableMethods(srv, [
    'watchVideoChats',
  ]);
  srvWrap.startIPC();
  return webrtcSignalsHandler;
}
