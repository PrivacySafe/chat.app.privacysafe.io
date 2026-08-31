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

/**
 * Signaling Channel Core — shared logic between client and host signaling channels.
 *
 * Extracted from client-signaling-channel.ts and host-signaling-channel.ts to
 * eliminate ~90% duplicated code:
 * - CONFIRMED_DELIVERY_SIGNALS set
 * - DataChannel send helper
 * - packing a Star signal into a WebRTCMsg for the ASMail path
 * - WebRTCMsg → StarSignalMessage parsing
 *
 * Putting the resulting message onto ASMail is not done here: that part is
 * identical for the window and for the background and lives in
 * @shared/webrtc-signalling. Only what is specific to the window stays — the
 * "signal inside SDP" packing and the set of signal types worth confirming.
 */

import type {
  CandidatesBatchPayload,
  StarSignalData,
  StarSignalMessage,
  StarSignalType,
  StreamSenderInfo,
  StreamSenderInfosBatchPayload,
} from '@video/common/types/star.types';
import type { ChatIdObj, WebRTCMsg } from '~/asmail-msgs.types';
import { sendWebRTCSignal } from '@shared/webrtc-signalling';
import { makeLogger } from '@shared/logger';
import { streamInfoKey } from './relay-slots';

const log = makeLogger('SignalingChannel');

// =============================================================================
// Confirmed Delivery Signals
// =============================================================================

/**
 * Signal types whose ASMail delivery is confirmed via observeDelivery()
 * rather than fire-and-forget addMsg(). These are singular, latency-critical
 * signals where the caller (client-channel.ts / host-channel.ts) can meaningfully react
 * to a delivery failure with a fast retry.
 *
 * Retries are deliberately absent on this side: a lost offer/answer is re-sent
 * by createRetryWatcher() in the WebRTC layer above, which also knows when a
 * retry became pointless (e.g. the signaling DataChannel opened meanwhile).
 *
 * NOTE: globally gated by CONFIRM_DELIVERY_ENABLED in webrtc-signalling.ts. It is
 * on again as of 2026-08-13; while it is off, every signal here goes
 * fire-and-forget and the retry watchers alone own re-sending.
 */
export const CONFIRMED_DELIVERY_SIGNALS: ReadonlySet<StarSignalType> = new Set([
  'offer',
  'answer',
  'disconnect',
  'call-full',
  'dropped',
]);

/**
 * How long to wait for ASMail delivery confirmation of a confirmed signal.
 *
 * Bounded from below by the latency ASMail actually shows for signalling
 * payloads — 7-12 s for a small signal, 10 s+ for a multi-KB SDP (see
 * sendMsgWithDeliveryConfirmation) — because a cap under it turns every send
 * into a false "NOT confirmed" and the watchers then flood the channel with
 * duplicates. That is what the former 12 s did.
 *
 * Bounded from above by the first retry-watcher tick, 45 s
 * (NEGOTIATION_RETRY_DELAYS / ANSWER_RETRY_DELAYS in host-channel.ts,
 * OFFER_RETRY_DELAYS in client-channel.ts): a tick landing while the
 * confirmation is still pending is the duplicate this cap exists to prevent.
 * 25 s sits at roughly twice the observed latency with 20 s of clearance.
 */
const SDP_CONFIRM_TIMEOUT_MS = 25_000;

/**
 * One-shot signals with no retry watcher of their own: offer/answer are re-sent
 * by createRetryWatcher() when they go unanswered, but a lost 'disconnect' or
 * 'call-full' is simply gone. While CONFIRM_DELIVERY_ENABLED is off these get
 * a blind fire-and-forget repeat instead of confirm+retry; the receiving paths
 * are idempotent, so the duplicate is harmless. With the flag on the repeats are
 * skipped and the confirmation carries them - see `blindRepeats` in
 * webrtc-signalling.ts.
 */
const BLIND_REPEAT_SIGNALS: ReadonlySet<StarSignalType> = new Set([
  'disconnect',
  'call-full',
  'dropped',
]);
const BLIND_REPEAT_DELAY_MILLIS = 4000;

/**
 * Repeat schedule for the teardown signals a peer's call window depends on to
 * close itself. Deliberately shorter-tailed than the deno-side schedule for the
 * same signals (TEARDOWN_REPEAT_DELAYS_MILLIS in video-chat-service's
 * _common.ts): these timers live in the call window, which closes moments after
 * the teardown it announced, taking any pending repeat with it. The long tail
 * belongs where the process outlives the call — the background service, which
 * sends its own 'disconnect' over ASMail in parallel.
 */
const TEARDOWN_REPEAT_DELAYS_MILLIS = [4_000, 20_000];

/**
 * Debounce window for batching ICE candidates into one ASMail message: the
 * FIRST buffered candidate arms the timer, later ones do not reset it, and
 * the batch also flushes when ICE gathering completes. One candidate per
 * message drove the ASMail server into HTTP 500 (a gathering burst opens a
 * parallel delivery session per message — see CandidatesBatchPayload).
 * Only the ASMail path batches; an open signaling DC sends singles directly.
 */
export const CANDIDATE_BATCH_WINDOW_MS = 400;

export interface CandidateBatcher {
  add(c: RTCIceCandidateInit): void;
  /** Cancel the timer and send buffered candidates now (no-op if empty). */
  flush(): void;
  /** Cancel the timer and drop the buffer without sending (pc recreate/close). */
  clear(): void;
}

export function createCandidateBatcher(
  send: (payload: CandidatesBatchPayload) => Promise<boolean>,
  windowMs = CANDIDATE_BATCH_WINDOW_MS,
): CandidateBatcher {
  let buffered: RTCIceCandidateInit[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (buffered.length === 0) {
      return;
    }
    const candidates = buffered;
    buffered = [];
    // Errors are logged inside sendWebRTCSignal; candidates stay
    // fire-and-forget like the single-candidate sends they replace.
    void send({ candidates });
  }

  return {
    add(c: RTCIceCandidateInit): void {
      buffered.push(c);
      if (timer === null) {
        timer = setTimeout(flush, windowMs);
      }
    },
    flush,
    clear(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      buffered = [];
    },
  };
}

/**
 * Debounce window for batching stream mappings into one ASMail message. Wider
 * than the candidate window because the mappings of a joining participant are
 * produced across several 'ontrack' events and a renegotiation, and because
 * nothing waits on them synchronously — the receiver buffers tracks until their
 * mapping arrives.
 */
export const STREAM_INFO_BATCH_WINDOW_MS = 800;

export interface StreamInfoBatcher {
  /** Buffers a mapping; a later mapping of the same stream replaces it. */
  add(info: StreamSenderInfo): void;
  /** Cancel the timer and send buffered mappings now (no-op if empty). */
  flush(): void;
  /** Cancel the timer and drop the buffer without sending. */
  clear(): void;
}

export function createStreamInfoBatcher(
  send: (payload: StreamSenderInfosBatchPayload) => Promise<boolean>,
  windowMs = STREAM_INFO_BATCH_WINDOW_MS,
): StreamInfoBatcher {
  // Keyed by mid where there is one, by streamId otherwise (see streamInfoKey):
  // a mapping is a statement about the current owner of ONE m-line, so within a
  // window only the last one matters. Keying on streamId alone collapsed the
  // mappings of several relay slots into one - their stream ids are minted
  // empty at negotiation and several slots can legitimately share one.
  let buffered = new Map<string, StreamSenderInfo>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (buffered.size === 0) {
      return;
    }
    const infos = [...buffered.values()];
    buffered = new Map();
    // Errors are logged inside sendWebRTCSignal; mappings stay
    // fire-and-forget like the single sends they replace.
    void send({ infos });
  }

  return {
    add(info: StreamSenderInfo): void {
      buffered.set(streamInfoKey(info), info);
      if (timer === null) {
        timer = setTimeout(flush, windowMs);
      }
    },
    flush,
    clear(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      buffered = new Map();
    },
  };
}

// =============================================================================
// DataChannel Send Helper
// =============================================================================

/**
 * Tries to send a signal via a low-latency DataChannel.
 * Returns true if sent via DC, false if ASMail fallback is needed.
 * Idempotent: safe to call when DC is not yet open or already closed.
 *
 * @param dc - The DataChannel to send through (may be null/undefined)
 * @param signal - The signal message to send
 * @param logLabel - Label for logging (e.g. '[ClientSignaling]')
 */
export function trySendViaDataChannel(
  dc: RTCDataChannel | null | undefined,
  signal: StarSignalMessage,
  logLabel: string,
): boolean {
  if (!dc || dc.readyState !== 'open') {
    return false;
  }
  try {
    dc.send(JSON.stringify(signal));
    return true;
  } catch (err) {
    log.error(`${logLabel}: DC send failed, falling back to ASMail:`, err);
    return false;
  }
}

// =============================================================================
// ASMail Signal Sending
// =============================================================================

/**
 * Options for sending a signal via ASMail (with DataChannel already attempted).
 */
export interface SendAsmailSignalOptions {
  /** Recipient address (host addr for client, client addr for host) */
  recipientAddr: string;
  /** Type of the Star signal */
  signalType: StarSignalType;
  /** Signal payload (SDP, ICE candidate, stream state, etc.) */
  payload?: unknown;
  /** Sender address */
  fromAddr: string;
  /** Recipient address (for signal routing, optional for client→host) */
  toAddr?: string;
  /** Chat ID for message routing */
  chatId: ChatIdObj;
  /** Prefix for delivery ID generation */
  deliveryIdPrefix: string;
  /** Label for logging */
  logLabel: string;
  /** Whether the channel is closed (signal is dropped if true) */
  isClosed: boolean;
  /**
   * Identifier of the call session this window serves (see
   * WebRTCMsg.callSessionId). Stamped into the signal so the receiving side can
   * tell it from a signal of an earlier call in the same chat.
   */
  callSessionId?: string;
}

/**
 * Packs a Star signal into the WebRTCMsg that carries it over ASMail.
 *
 * The signal travels "inside SDP": StarSignalData is serialized into
 * `description.sdp`, with `description.type` a mere placeholder — the real type
 * is `signalData.signalType`. Recognized back by parseStarSignalFromWebRTCMsg().
 */
function webRTCMsgWithStarSignal(
  signalData: StarSignalData,
  callSessionId: string | undefined,
): WebRTCMsg {
  return {
    stage: 'signalling',
    id: Date.now(),
    callSessionId,
    data: {
      description: {
        type: 'offer',
        sdp: JSON.stringify(signalData),
      } as RTCSessionDescription,
    },
  };
}

/**
 * Sends a signal to a recipient via ASMail.
 *
 * Packs the Star signal, then hands it to the shared sender, which owns the
 * message assembly and the delivery mechanics. This side only decides whether
 * the signal is worth confirming (CONFIRMED_DELIVERY_SIGNALS).
 *
 * Returns whether the signal is NOT known to have failed — confirmed, or
 * fire-and-forget accepted, or a confirmation that merely ran out of patience
 * while the delivery was still travelling. `false` only for a reported failure
 * (or a closed channel).
 *
 * That is deliberately weaker than "confirmed", because of what the callers do
 * with it: `false` arms a FAST re-send of the same SDP (5s). A multi-KB offer
 * whose confirmation timed out is still on its way, so a fast copy of it is pure
 * added load on the server that was slow in the first place — while the slow
 * retry watcher, already armed before the send was even awaited, remains the
 * recovery for a genuinely lost one. See `deliveryUnknown` in
 * webrtc-signalling.ts for the measurement behind this.
 */
export async function sendSignalViaAsmail(opts: SendAsmailSignalOptions): Promise<boolean> {
  const {
    recipientAddr,
    signalType,
    payload,
    fromAddr,
    toAddr,
    chatId,
    deliveryIdPrefix,
    logLabel,
    isClosed,
    callSessionId,
  } = opts;

  if (isClosed) {
    log.warn(`${logLabel}: Cannot send signal: channel is closed`);
    return false;
  }

  const { ok, deliveryUnknown } = await sendWebRTCSignal({
    chatId,
    recipient: recipientAddr,
    webrtcMsg: webRTCMsgWithStarSignal(
      { signalType, fromAddr, toAddr, payload },
      callSessionId,
    ),
    deliveryIdPrefix,
    logLabel,
    signalName: signalType,
    confirm: CONFIRMED_DELIVERY_SIGNALS.has(signalType),
    confirmTimeoutMs: SDP_CONFIRM_TIMEOUT_MS,
    blindRepeats: BLIND_REPEAT_SIGNALS.has(signalType)
      ? {
        delaysMillis: ((signalType === 'disconnect') || (signalType === 'dropped'))
          ? TEARDOWN_REPEAT_DELAYS_MILLIS
          : [BLIND_REPEAT_DELAY_MILLIS],
      }
      : undefined,
  });
  return ok || !!deliveryUnknown;
}

// =============================================================================
// WebRTCMsg → StarSignalMessage Parsing
// =============================================================================

/**
 * Parses a WebRTCMsg into a StarSignalMessage.
 *
 * Handles three serialization formats:
 * 1. `callFull` field (legacy call-full rejection)
 * 2. `starSignal` wrapper (legacy participant-left, stream-state-changed, etc.)
 * 3. `signalType` format (current: offer/answer/candidate and all star signals)
 *
 * @param webrtcMsg - The incoming WebRTC message
 * @param senderAddr - The address of the sender (overrides fromAddr in signalData
 *   to prevent spoofing; for client this is hostAddr, for host this is clientAddr)
 * @param logLabel - Label for logging
 * @returns Parsed StarSignalMessage, or null if the message could not be parsed
 */
export function parseStarSignalFromWebRTCMsg(
  webrtcMsg: WebRTCMsg,
  senderAddr: string,
  logLabel: string,
): StarSignalMessage | null {
  try {
    // Normalize data: it may be an array (legacy Mesh format) or a single object.
    const rawData = webrtcMsg.data;
    const data = Array.isArray(rawData) ? rawData[0] : rawData;

    if (!data) {
      return null;
    }

    // When the sender produced this message (its own clock, written at pack
    // time). Carried into the signal so the SDP handlers can tell a genuinely
    // new offer from one ASMail merely delivered late — see
    // StarSignalMessage.msgTs.
    const msgTs = (typeof webrtcMsg.id === 'number') ? webrtcMsg.id : undefined;

    // Check for call-full rejection first (before trying to parse SDP)
    if ('callFull' in data && data.callFull) {
      log.debug(`${logLabel}: Received call-full rejection: ${JSON.stringify(data.callFull)}`);
      return {
        type: 'call-full',
        fromAddr: senderAddr,
        data: data.callFull as { maxParticipants: number; currentParticipants: number },
        msgTs,
      };
    }

    if (!('description' in data) || !data.description) {
      return null;
    }

    const sdpStr = data.description.sdp;
    if (!sdpStr) {
      return null;
    }

    // Check for starSignal format (used for participant-left, stream-state-changed, etc.)
    // This format is: {"starSignal": {"type": "...", "fromAddr": "...", "data": {...}}}
    if (sdpStr.includes('"starSignal"')) {
      const parsed = JSON.parse(sdpStr);
      const starSignal = parsed.starSignal as StarSignalMessage;
      log.debug(`${logLabel}: Parsed starSignal: type=${starSignal.type}, from=${starSignal.fromAddr}`);
      return { ...starSignal, msgTs: starSignal.msgTs ?? msgTs };
    }

    // Check for signalType format (used for offer/answer/candidate and all star signals)
    // This format is: {"signalType": "...", "fromAddr": "...", "payload": {...}}
    if (sdpStr.includes('"signalType"')) {
      const signalData = JSON.parse(sdpStr) as StarSignalData;
      log.debug(
        `${logLabel}: Parsed StarSignalData: type=${signalData.signalType}, from=${signalData.fromAddr}, hasPayload=${!!signalData.payload}`,
      );

      // SDP/ICE: always trust the ASMail envelope sender (anti-spoof).
      // App-level star signals (stream-state-changed, etc.) carry the *logical*
      // actor in signalData.fromAddr (e.g. host relays peer mute with
      // fromAddr=peer while the envelope sender is the host). Overwriting
      // those with senderAddr made clients apply peer mute onto the host tile.
      const sdpSignalTypes = new Set(['offer', 'answer', 'candidate', 'candidates']);
      const logicalFrom =
        !sdpSignalTypes.has(signalData.signalType) && signalData.fromAddr
          ? signalData.fromAddr
          : senderAddr;

      return {
        type: signalData.signalType,
        fromAddr: logicalFrom,
        toAddr: signalData.toAddr,
        data: signalData.payload as RTCSessionDescriptionInit | RTCIceCandidateInit,
        msgTs,
      };
    }

    // Raw SDP without signal wrapper — not a Star signal
    return null;
  } catch (err) {
    log.error(`${logLabel}: Failed to parse WebRTC message:`, err);
    return null;
  }
}
