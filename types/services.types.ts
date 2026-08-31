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

import type {
  ChatIdObj,
  ChatMessageId,
  ChatIncomingMessage,
  WebRTCMsg,
  WebRTCMsgBodySysMsgData,
  ChatOutgoingMessage,
} from './asmail-msgs.types';
import type { ChatMessageView, ChatListItemView } from './chat.types';
import type { GuiLogLine } from '../shared-libs/log-relay';
import type { SendingProgressInfo } from '../src-deno/types/index.ts';

/**
 * Chat aggregates that a change invalidates. They are computed in the database,
 * taking message types and statuses into account, so the emitter ships them
 * with the event instead of letting the GUI ask for them back over IPC on every
 * single change.
 * Absent only when the chat itself is already gone, leaving nothing to count.
 */
export interface ChatSummary {
  chatId: ChatIdObj;
  unread: number;
  lastMsg: ChatMessageView | null;
}

export interface ChatEventBase {
  updatedEntityType: 'chat';
}

export interface ChatUpdatedEvent extends ChatEventBase {
  event: 'updated';
  chat: ChatListItemView;
}

export interface ChatRemovedEvent extends ChatEventBase {
  event: 'removed';
  chatId: ChatIdObj;
}

export interface AllChatMessagesRemovedEvent extends ChatEventBase {
  event: 'messages-removed';
  chatId: ChatIdObj;
  chatSummary?: ChatSummary;
}

export interface ChatAddedEvent extends ChatEventBase {
  event: 'added';
  chat: ChatListItemView;
}

export interface ChatWebRTCCallEvent extends ChatEventBase {
  event: 'webRTCCall';
  value: {
    msg: ChatIncomingMessage | ChatOutgoingMessage;
    data: WebRTCMsgBodySysMsgData['value'];
  };
}

export type ChatEvent =
  ChatAddedEvent | ChatUpdatedEvent | ChatRemovedEvent | AllChatMessagesRemovedEvent | ChatWebRTCCallEvent;

export interface ChatMessageEventBase {
  updatedEntityType: 'message';
}

export interface ChatMessageAddedEvent extends ChatMessageEventBase {
  event: 'added';
  msg: ChatMessageView;
  chatSummary?: ChatSummary;
}

export interface ChatMessageUpdatedEvent extends ChatMessageEventBase {
  event: 'updated';
  msg: ChatMessageView;
  chatSummary?: ChatSummary;
}

export interface ChatMessageRemovedEvent extends ChatMessageEventBase {
  event: 'removed';
  msgId: ChatMessageId;
  chatSummary?: ChatSummary;
}

export interface ChatMessageRemovedMultipleEvent extends ChatMessageEventBase {
  event: 'removed-multiple';
  chatMsgIds: ChatMessageId[];
  chatSummary?: ChatSummary;
}

export interface ChatMessageSendingProgressEvent extends ChatMessageEventBase {
  event: 'sending-progress';
  data: SendingProgressInfo;
}

export type ChatMessageEvent =
  | ChatMessageAddedEvent
  | ChatMessageUpdatedEvent
  | ChatMessageRemovedEvent
  | ChatMessageRemovedMultipleEvent
  | ChatMessageSendingProgressEvent;

/**
 * What the synchronization with the user's other devices is busy with right
 * now. 'catch-up' is the scan of messages missed while this device was off,
 * 'incoming' is applying phantoms of changes made elsewhere, 'outgoing' is
 * handing this device's own phantoms to delivery.
 */
export type SyncPhase = 'idle' | 'catch-up' | 'incoming' | 'outgoing';

export interface SyncActivityView {
  /**
   * Monotonic number of this snapshot. The GUI both subscribes to events and
   * asks for the current value once, and the answer to the ask can arrive after
   * a newer event; comparing seq is what keeps the older one from winning.
   */
  seq: number;
  /** Whether to show the indicator, i.e. after debouncing. */
  syncing: boolean;
  /** Units of work left, 0 when there is nothing to show a count for. */
  pending: number;
  phase: SyncPhase;
  /**
   * There are phantoms to send, but the last pass over the journal failed:
   * the server is unreachable rather than this device being busy.
   */
  stalled: boolean;
}

export interface SyncStateChangedEvent {
  updatedEntityType: 'sync-state';
  event: 'changed';
  state: SyncActivityView;
}

/**
 * Another instance of this app works with the same local data folder, so both
 * share this device's identity and neither can synchronize with the other.
 * A misconfiguration rather than a runtime condition - see
 * startForeignInstanceWatch() in local-data-store.ts.
 */
export interface DuplicateDeviceInstanceEvent {
  updatedEntityType: 'sync-state';
  event: 'duplicate-device-instance';
}

export type SyncStateEvent = SyncStateChangedEvent | DuplicateDeviceInstanceEvent;

export type UpdateEvent = ChatEvent | ChatMessageEvent | SyncStateEvent;

export type AddressCheckResult =
  | 'found'
  | 'found-but-access-restricted'
  | 'not-present-at-domain'
  | 'no-service-for-domain'
  | 'not-valid-public-key';

/**
 * This app's service.
 * It is a singleton in "background instance" component.
 * This service manages video chat windows: opens them, keeps track of them,
 * passes signals to them, etc.
 */
export interface VideoGUIOpener {
  startVideoCallForChatRoom(chatId: ChatIdObj): Promise<void>;

  endVideoCallInChatRoom(chatId: ChatIdObj): Promise<void>;

  /**
   * Resolves to the id of the call session that was answered or declined; the
   * window names it in the system message about the cancelled call, as the
   * session id lives in the background service. See VideoChatSrv for details.
   *
   * `handled: false` means there was no call to act on - it is over, or the
   * click was about a different (dead) session than the one going on
   * (`expectedCallSessionId` names the session the button was armed for). The
   * caller clears its incoming-call UI state and tells the user, instead of
   * silently doing nothing.
   */
  joinOrDismissCallInRoom(
    chatId: ChatIdObj,
    join: boolean,
    sender?: string,
    expectedCallSessionId?: string,
  ): Promise<{ handled: boolean; callSessionId?: string }>;

  watchVideoChats(obs: web3n.Observer<VideoChatEvent>): () => void;
}

export interface VideoChatEvent {
  type: 'gui-closed' | 'gui-opened' | 'call-started' | 'call-ended' | 'call-ended-by-host' | 'call-active';
  chatId: ChatIdObj;
  peerAddr?: string;
  /**
   * Indicates whether a call is currently active in the chat room.
   * Used for re-join feature: when true, shows "Join call" button in UI.
   * Only present when type is 'call-active'.
   */
  isCallActive?: boolean;
  /**
   * Why this event was emitted.
   *
   * 'self-left' ('call-active' only): we ourselves just left a group call that
   * continues without us, so the re-join button is shown immediately without
   * waiting for the host's heartbeat. The main window must NOT raise a "call is
   * active in chat" notice in this case — the user just left the call knowingly.
   *
   * 'unanswered-here' ('call-ended' only): the host withdrew a call the user
   * never answered on this device. Besides taking the ringtone and the
   * Join/Decline buttons away, the window records the cancelled call in the
   * chat history — the host's 'outgoing-call-cancelled' system message, which
   * normally does that, arrives on a separate delivery and would find the
   * incoming-call state already cleared (`peerAddr` says who was calling).
   *
   * 'answered-elsewhere' ('call-ended' only): another device of this same user
   * took the call. The window says so, because on a device where the user had
   * already started answering this closes the media setup screen under their
   * hands — a ringtone stopping on its own explains itself, that does not.
   */
  reason?: 'self-left' | 'unanswered-here' | 'answered-elsewhere';
}

/**
 * This app's service.
 * VideoChatComponent service exposes control of video component to background.
 * Methods are used by background to control video component, while watching
 * method is used to consume from video side both call requests and events.
 */
export interface VideoChatComponent {
  /**
   * This service call
   * @param chat
   */
  startVideoCallComponentForChat(chat: ChatInfoForCall): Promise<void>;

  focusWindow(): Promise<void>;

  endCall(): Promise<void>;

  /**
   * Absorbs WebRTC signalling messages that come to this particular video
   * component instance.
   * @param peerAddr identifies from which peer this message is from
   * @param msg message itself
   */
  handleWebRTCSignal(peerAddr: string, msg: WebRTCMsg): Promise<void>;

  /**
   * Tells this call window that a signal to `peerAddr` was NOT delivered - the
   * platform reported the delivery as failed and the resends it triggered are
   * spent (see noteSignalDeliveryOutcome in webrtc-signalling.ts).
   *
   * For 'start' this is the difference between "not reached" and "did not
   * answer", which the window otherwise cannot tell apart: an invitation lost on
   * the server looks exactly like a peer ignoring the call, so a group call whose
   * invitations all died showed nothing but "waiting for participants"
   * (2026-08-12).
   */
  notifyOfUndeliveredSignal(peerAddr: string, stage: WebRTCMsg['stage']): Promise<void>;

  /**
   * Tells this call window - the HOST's - that `peerAddr` is re-joining the
   * call, as that peer announced ahead of its SDP offer.
   *
   * The offer is the only other thing that says so, and it is the largest
   * message in the protocol: in the group call of 2026-08-13 the other
   * participants had no sign of a returning peer for 50s. The window answers
   * this by broadcasting 'participant-reconnecting', which every participant
   * already renders as "connecting to the call…".
   */
  notifyOfRejoiningPeer(peerAddr: string): Promise<void>;

  /**
   * This absorbs different requests from video to gui component, reusing
   * single service connection.
   * @param obs for requests and events from video component to background
   */
  watchRequests(obs: web3n.Observer<CallFromVideoGUI>): () => void;

  notifyBkgrndInstanceOnCallStart(): void;
}

export type CallFromVideoGUI =
  | CallStartedEvent | HostEndedCallEvent | PeerLeftCallEvent | GuiLogEvent;

export interface CallStartedEvent {
  type: 'call-started-event';
}

/**
 * Sent by a client's GUI when its signaling channel reports that the host
 * ended the call, so Deno can perform GUI teardown and notify the main window.
 */
export interface HostEndedCallEvent {
  type: 'host-ended-call';
}

/**
 * Sent by the host's GUI when a group-call client has been removed from the
 * call (in-band 'disconnect' over the DataChannel, its signaling channel
 * closing, or the disconnect grace period expiring). Lets the host's Deno
 * side drop the client from its bookkeeping and send it an out-of-cycle
 * re-join heartbeat without waiting for the much slower ASMail 'disconnect'.
 */
export interface PeerLeftCallEvent {
  type: 'peer-left-call';
  peerAddr: string;
}

/**
 * The call window's log lines, on their way to the background component that
 * prints them where the whole run is read from.
 *
 * This window has no outgoing RPC of its own, so the observer the background
 * subscribes to is the only channel it has - and it needs one: the window lives
 * only as long as the call, and its devtools console goes with it. The
 * background handles this event ahead of every other one, because the lines
 * worth having most are the ones written while a call is falling apart.
 */
export interface GuiLogEvent {
  type: 'gui-log';
  lines: GuiLogLine[];
}

export interface ChatInfoForCall {
  chatId: ChatIdObj;
  ownAddr: string;
  ownName: string;
  peers: {
    addr: string;
    name: string;
  }[];
  chatName: string;
  rtcConfig: RTCConfiguration;
  isRejoiningActiveCall?: boolean;
  /** Call direction: 'outgoing' for host, 'incoming' for client */
  direction?: 'incoming' | 'outgoing';
  /** Host address (mailerId of the call initiator, for incoming calls) */
  hostAddr?: string;
  /**
   * Identifier of the call session this window serves (see
   * WebRTCMsg.callSessionId). The window stamps it into every signal it sends
   * over ASMail, so the peer can tell a signal of this call from a signal of
   * a previous one in the same chat.
   */
  callSessionId?: string;
  /**
   * Total number of participants in the call (including self).
   * Used to determine video quality tier.
   * Defaults to peers.length + 1 if not provided.
   */
  participantCount?: number;
}
