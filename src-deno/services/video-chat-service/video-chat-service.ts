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
import type { ChatIdObj, ChatIncomingMessage, WebRTCMsg } from '../../../types/asmail-msgs.types.ts';
import type { IncomingCallCmdArg } from '../../../types/chat-commands.types.ts';
import type { ChatInfoForCall, VideoChatEvent } from '../../../types/services.types.ts';
import type { CallInChat, ChatDbEntry, ChatSrv, VideoChatSrv } from '../../types/index.ts';
import { MultiConnectionIPCWrap } from '../../../shared-libs/ipc/ipc-service.js';
import { sleep } from '../../../shared-libs/processes/sleep.ts';
import { ObserversSet } from '../../../shared-libs/observer-utils.ts';
import { includesAddress, areAddressesEqual } from '../../../shared-libs/address-utils.ts';
import { checkChatMessageJSONforWebRTC } from './utils/_common.ts';
import { callInChat } from './utils/call.ts';
import { MSG_REMOVAL_DELAY_MILLIS, RTC_STATIC_CONFIG } from './constants.ts';

function exposeServiceOnIPC(videoGUI: VideoChatSrv) {
  const videoOpenerWrap = new MultiConnectionIPCWrap('VideoGUIOpener');
  videoOpenerWrap.exposeReqReplyMethods(videoGUI, [
    'startVideoCallForChatRoom',
    'joinOrDismissCallInRoom',
    'endVideoCallInChatRoom',
  ]);
  videoOpenerWrap.exposeObservableMethods(videoGUI, ['watchVideoChats']);
  return videoOpenerWrap.startIPC();
}

export async function videoChatService(
  ownAddr: string,
  chatSrv: ChatSrv,
): Promise<{ videoChatSrv: VideoChatSrv; stopVideoChatSrv: () => void }> {
  const videoChatsObs = new ObserversSet<VideoChatEvent>();
  const calls = new Map<string, CallInChat>();

  const sinkGUIEvents = videoChatsObs.next;

  function nameFromAddr(addr: string): string {
    return addr.indexOf('@') === 0 ? addr : addr.substring(0, addr.indexOf('@'));
  }

  function chatInfoForNewCall(chat: ChatDbEntry, chatId: ChatIdObj): ChatInfoForCall {
    const peers = chat.isGroupChat
      ? Object.keys(chat.members)
          .filter(addr => !areAddressesEqual(addr, ownAddr))
          .map(addr => ({ addr, name: nameFromAddr(addr) }))
      : [{ addr: chat.peerAddr, name: chat.name }];

    return {
      chatId,
      ownAddr,
      ownName: nameFromAddr(ownAddr),
      peers,
      chatName: chat.name,
      rtcConfig: RTC_STATIC_CONFIG,
    };
  }

  function createAndRegisterCall(chat: ChatDbEntry, chatId: ChatIdObj): CallInChat {
    const callInfo = chatInfoForNewCall(chat, chatId);
    const call = callInChat({
      info: callInfo,
      sinkGUIEvents,
      detachFromParent: () => {
        if (calls.get(chatId.chatId) === call) {
          calls.delete(chatId.chatId);
        }
      },
      postProcessingForVideoChat: chatSrv.postProcessingForVideoChat,
    });

    calls.set(chatId.chatId, call);
    return call;
  }

  async function removeMessageFromInbox(msgId: string, logInfo?: string, delay?: true): Promise<void> {
    if (logInfo) {
      await w3n.log('info', logInfo);
    }
    if (delay) {
      await sleep(MSG_REMOVAL_DELAY_MILLIS);
    }
    await w3n.mail!.inbox.removeMsg(msgId).catch(async (e: web3n.asmail.InboxException) => {
      if (!e.msgNotFound) {
        await w3n.log('error', `Error deleting message ${msgId} from INBOX. `, e);
      }
    });
  }

  async function handleIncomingCall(
    chat: ChatDbEntry,
    chatId: ChatIdObj,
    peer: string,
    webrtcMsg: WebRTCMsg,
  ): Promise<void> {
    const call = createAndRegisterCall(chat, chatId);
    call.handleWebRTCSignalFrom(peer, webrtcMsg);

    const cmdArg: IncomingCallCmdArg = {
      chatId,
      peerAddress: peer,
    };
    await w3n.shell!.startAppWithParams!(null, 'incoming-call', cmdArg);
  }

  async function handleIncomingWebRTCMsg(msg: ChatIncomingMessage): Promise<void> {
    const { sender, msgId } = msg;
    const checkMsgBody = checkChatMessageJSONforWebRTC(msg);
    if (!checkMsgBody) {
      return await removeMessageFromInbox(
        msgId,
        `Incoming WebRTC chat message ${msgId} failed body check. Removing it from inbox.`,
      );
    }

    const { chatId, webrtcMsg } = checkMsgBody;
    const chat = chatSrv.findChatEntry(chatId);
    if (!chat) {
      return await removeMessageFromInbox(
        msgId,
        `Incoming WebRTC chat message ${msgId}, type has no known chat. Removing it from inbox.`,
      );
    }

    if (chat.isGroupChat && !includesAddress(Object.keys(chat.members), sender)) {
      return await removeMessageFromInbox(
        msgId,
        `Sender ${sender} is not a member of group chat ${chat.chatId}. Removing it from inbox.`,
      );
    }

    try {
      const call = calls.get(chatId.chatId);
      if (call) {
        const removeMsg = call.handleWebRTCSignalFrom(sender, webrtcMsg);

        if (removeMsg) {
          await removeMessageFromInbox(msgId);
        }
      } else if (webrtcMsg.stage === 'start') {
        await handleIncomingCall(chat, chatId, sender, webrtcMsg);
      }
    } catch (err) {
      await w3n.log('error', `Error is thrown while handling WebRTC chat message`, err);
      await removeMessageFromInbox(msgId, undefined, true);
    }
  }

  async function startVideoCallForChatRoom(chatId: ChatIdObj): Promise<void> {
    let call = calls.get(chatId.chatId);
    if (!call) {
      const chat = chatSrv.findChatEntry(chatId, true)!;
      call = createAndRegisterCall(chat, chatId);
    }
    await call.startCall();

    const { doAfterStartCall } = chatSrv.postProcessingForVideoChat();
    await doAfterStartCall({ chatId, direction: 'outgoing' });
  }

  async function endVideoCallInChatRoom(chatId: ChatIdObj): Promise<void> {
    const call = calls.get(chatId.chatId);
    if (!call) {
      return;
    }
    await call.endCallInGUI();
  }

  /**
   * All incoming calls go throw this controller first, creating call objects
   * that open other UI elements. Those other elements send tell to either join
   * or ignore call.
   * @param chatId
   * @param join tells to either join call (true value), or dismiss it (false)
   * @param sender who was the current call's initiator
   */
  async function joinOrDismissCallInRoom(chatId: ChatIdObj, join: boolean, sender?: string): Promise<void> {
    const call = calls.get(chatId.chatId);
    if (!call) {
      return;
    }

    if (join) {
      await call.startCall();
      const { doAfterStartCall } = chatSrv.postProcessingForVideoChat();
      await doAfterStartCall({ chatId, direction: 'incoming', sender });
    } else {
      await call.end();
    }
  }

  function watchVideoChats(obs: web3n.Observer<VideoChatEvent>): () => void {
    videoChatsObs.add(obs);
    return () => videoChatsObs.delete(obs);
  }

  const methods: VideoChatSrv = {
    webrtcMsgsHandler: handleIncomingWebRTCMsg,
    startVideoCallForChatRoom,
    endVideoCallInChatRoom,
    joinOrDismissCallInRoom,
    watchVideoChats,
  };

  const stopVideoChatSrv = exposeServiceOnIPC(methods);

  return {
    videoChatSrv: methods,
    stopVideoChatSrv,
  };
}
