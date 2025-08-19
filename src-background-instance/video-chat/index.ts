/*
 Copyright (C) 2024 - 2025 3NSoft Inc.

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

// @deno-types="../shared-libs/ipc/ipc-service.d.ts"
import { MultiConnectionIPCWrap } from '../../shared-libs/ipc/ipc-service.js';
import { sleep } from '../../shared-libs/processes/sleep.ts';
import { includesAddress, toCanonicalAddress } from '../../shared-libs/address-utils.ts';
import {
  ChatIdObj,
  ChatIncomingMessage,
  ChatInfoForCall,
  ChatWebRTCMsgV1,
  IncomingCallCmdArg,
  VideoChatEvent,
  VideoGUIOpener,
  WebRTCMsg,
  WebRTCOffBandMessage,
} from '../../types/index.ts';
import { ChatService } from '../chat-service/index.ts';
import type { ChatDbEntry } from '../dataset/versions/v2/chats-db.ts';
import { ObserversSet } from '../../shared-libs/observer-utils.ts';
import { areAddressesEqual } from '../../shared-libs/address-utils.ts';
import { CallInChat } from './call.ts';

export type WebRTCSignalHandler = (msg: ChatIncomingMessage) => Promise<void>;

export type IncomingCallHandler = (
  chat: ChatDbEntry,
  chatId: ChatIdObj,
  peer: string,
  msg: WebRTCMsg,
) => Promise<void>;

const rtcStaticConfig: RTCConfiguration = {
  iceServers: [{
    urls: ['stun:t1.3nweb.net:443'],
  }, {
    urls: ['turns:t1.3nweb.net:443'],
    username: 'chat-app',
    credential: 'WLIvWVDTrxHpy78GknE6tNsNiqjNNFU5mN4qSUU',
  }],
  iceTransportPolicy: 'relay',
};

const MSG_REMOVAL_DELAY_MILLIS = 10 * 1000;

function checkChatMessageJSONforWebRTC(msg: ChatIncomingMessage): {
  webrtcMsg: ChatWebRTCMsgV1['webrtcMsg'];
  chatId: ChatIdObj;
} | undefined {
  const { sender, jsonBody } = msg;
  if (msg.jsonBody.v !== 1) {
    return;
  }

  const { chatMessageType, groupChatId, webrtcMsg } = jsonBody as ChatWebRTCMsgV1;

  if (chatMessageType !== 'webrtc-call' || !webrtcMsg) {
    return;
  }

  const { id, stage, data } = webrtcMsg;

  if ((typeof stage !== 'string') || (typeof id !== 'number') || !checkData(data)) {
    return;
  }

  const chatId: ChatIdObj = (typeof groupChatId === 'string') && groupChatId
    ? { isGroupChat: true, chatId: groupChatId }
    : { isGroupChat: false, chatId: toCanonicalAddress(sender) };

  if (chatId.isGroupChat && chatId.chatId.includes('@')) {
    return;
  }

  return { chatId, webrtcMsg };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function checkData(data: WebRTCOffBandMessage | WebRTCOffBandMessage[]): boolean {
  // TODO add sanity checks here, and for outgoing thing we may add filtering
  return true;
}

export function setupAndStartVideoGUIOpener(
  ownAddr: string,
  findChatEntry: ChatService['findChatEntry'],
  postProcessingForVideoChat: () => {
    doAfterStartCall: (
      { chatId, direction, sender }:
      { chatId: ChatIdObj; direction: 'incoming' | 'outgoing'; sender?: string },
    ) => Promise<void>,
    doAfterEndCall: (chatId: ChatIdObj) => Promise<void>,
  },
): { webrtcMsgsHandler: WebRTCSignalHandler; getChatsWithVideoCall: () => Promise<ChatIdObj[]> } {
  const guisCtrl = new VideoGUIsController(ownAddr, findChatEntry, postProcessingForVideoChat);

  const videoOpenerWrap = new MultiConnectionIPCWrap('VideoGUIOpener');
  videoOpenerWrap.exposeReqReplyMethods(guisCtrl, [
    'startVideoCallForChatRoom',
    'joinOrDismissCallInRoom',
    'endVideoCallInChatRoom',
  ]);
  videoOpenerWrap.exposeObservableMethods(guisCtrl, [
    'watchVideoChats',
  ]);
  videoOpenerWrap.startIPC();

  return {
    webrtcMsgsHandler: guisCtrl.handleIncomingWebRTCMsg.bind(guisCtrl),
    getChatsWithVideoCall: guisCtrl.getChatsWithVideoCall.bind(guisCtrl),
  };
}

class VideoGUIsController implements VideoGUIOpener {
  private readonly videoChatsObs = new ObserversSet<VideoChatEvent>();
  private readonly calls = new Map<string, CallInChat>();

  constructor(
    private readonly ownAddr: string,
    private readonly getChatEntry: ChatService['findChatEntry'],
    private readonly postProcessingForVideoChat: ChatService['postProcessingForVideoChat'],
  ) {
  }

  async getChatsWithVideoCall(): Promise<ChatIdObj[]> {
    return [...this.calls.keys()].map(key => ({
      isGroupChat: !key.includes('@'),
      chatId: key,
    }));
  }

  private createAndRegisterCall(chat: ChatDbEntry, chatId: ChatIdObj): CallInChat {
    const callInfo = this.chatInfoForNewCall(chat, chatId);
    const call = new CallInChat(
      callInfo,
      this.sinkForGUIEvents,
      () => {
        if (this.calls.get(chatId.chatId) === call) {
          this.calls.delete(chatId.chatId);
        }
      },
      this.postProcessingForVideoChat,
    );

    this.calls.set(chatId.chatId, call);
    return call;
  }

  private nameFromAddr(addr: string): string {
    return addr.indexOf('@') === 0 ? addr : addr.substring(0, addr.indexOf('@'));
  }

  async startVideoCallForChatRoom(chatId: ChatIdObj): Promise<void> {
    let call = this.calls.get(chatId.chatId);
    if (!call) {
      const chat = this.getChatEntry(chatId, true)!;
      call = this.createAndRegisterCall(chat, chatId);
    }
    await call.startCall();

    console.log(`### START CALL [${this.ownAddr}] ###`);
    const { doAfterStartCall } = this.postProcessingForVideoChat();
    await doAfterStartCall({ chatId, direction: 'outgoing' });
  }

  async endVideoCallInChatRoom(chatId: ChatIdObj): Promise<void> {
    const call = this.calls.get(chatId.chatId);
    if (!call) {
      return;
    }
    await call.endCallInGUI();
  }

  private readonly sinkForGUIEvents = this.videoChatsObs.next.bind(this.videoChatsObs);

  private chatInfoForNewCall(chat: ChatDbEntry, chatId: ChatIdObj): ChatInfoForCall {
    const peers = chat.isGroupChat
      ? Object.keys(chat.members)
        .filter(addr => !areAddressesEqual(addr, this.ownAddr))
        .map(addr => ({ addr, name: this.nameFromAddr(addr) }))
      : [{ addr: chat.peerAddr, name: chat.name }];

    return {
      chatId,
      ownAddr: this.ownAddr,
      ownName: this.nameFromAddr(this.ownAddr),
      peers,
      chatName: chat.name,
      rtcConfig: rtcStaticConfig,
    };
  }

  /**
   * All incoming calls go throw this controller first, creating call objects
   * that open other UI elements. Those other elements send tell to either join
   * or ignore call.
   * @param chatId
   * @param join tells to either join call (true value), or dismiss it (false)
   * @param sender who was the current call's initiator
   */
  async joinOrDismissCallInRoom(chatId: ChatIdObj, join: boolean, sender?: string): Promise<void> {
    const call = this.calls.get(chatId.chatId);
    if (!call) {
      return;
    }

    if (join) {
      console.log(`### JOIN CALL [${this.ownAddr}] from ${sender} ###`);
      await call.startCall();
      const { doAfterStartCall } = this.postProcessingForVideoChat();
      await doAfterStartCall({ chatId, direction: 'incoming', sender });
    } else {
      await call.end();
    }
  }

  watchVideoChats(obs: web3n.Observer<VideoChatEvent>): () => void {
    this.videoChatsObs.add(obs);
    return () => this.videoChatsObs.delete(obs);
  }

  private async handleIncomingCall(
    chat: ChatDbEntry,
    chatId: ChatIdObj,
    peer: string,
    webrtcMsg: WebRTCMsg,
  ): Promise<void> {
    const call = this.createAndRegisterCall(chat, chatId);
    call.handleWebRTCSignalFrom(peer, webrtcMsg);

    const cmdArg: IncomingCallCmdArg = {
      chatId,
      peerAddress: peer,
    };
    await w3n.shell!.startAppWithParams!(null, 'incoming-call', cmdArg);
  }

  async handleIncomingWebRTCMsg(msg: ChatIncomingMessage): Promise<void> {
    const { sender, msgId } = msg;
    const checkMsgBody = checkChatMessageJSONforWebRTC(msg);
    if (!checkMsgBody) {
      return await this.removeMessageFromInbox(
        msgId,
        `Incoming WebRTC chat message ${msgId} failed body check. Removing it from inbox.`,
      );
    }

    const { chatId, webrtcMsg } = checkMsgBody;
    const chat = this.getChatEntry(chatId);
    if (!chat) {
      return await this.removeMessageFromInbox(
        msgId,
        `Incoming WebRTC chat message ${msgId}, type has no known chat. Removing it from inbox.`,
      );
    }

    if (chat.isGroupChat && !includesAddress(Object.keys(chat.members), sender)) {
      return await this.removeMessageFromInbox(
        msgId,
        `Sender ${sender} is not a member of group chat ${chat.chatId}. Removing it from inbox.`,
      );
    }

    try {
      const call = this.calls.get(chatId.chatId);
      if (call) {
        const removeMsg = call.handleWebRTCSignalFrom(sender, webrtcMsg);

        if (removeMsg) {
          await this.removeMessageFromInbox(msgId);
        }
      } else if (webrtcMsg.stage === 'start') {
        await this.handleIncomingCall(chat, chatId, sender, webrtcMsg);
      }
    } catch (err) {
      await w3n.log('error', `Error is thrown while handling WebRTC chat message`, err);
      await this.removeMessageFromInbox(msgId, undefined, true);
    }
  }

  private async removeMessageFromInbox(msgId: string, logInfo?: string, delay?: true): Promise<void> {
    if (logInfo) {
      await w3n.log('info', logInfo);
    }
    if (delay) {
      await sleep(MSG_REMOVAL_DELAY_MILLIS);
    }
    await w3n.mail!.inbox.removeMsg(msgId)
      .catch(async (e: web3n.asmail.InboxException) => {
        if (!e.msgNotFound) {
          await w3n.log('error', `Error deleting message ${msgId} from INBOX. `, e);
        }
      });
  }
}
