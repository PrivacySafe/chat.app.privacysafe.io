/*
Copyright (C) 2025 3NSoft Inc.

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
import { inject } from 'vue';
import { defineStore } from 'pinia';
import { useI18n } from 'vue-i18n';
import cloneDeep from 'lodash/cloneDeep';
import type { Nullable } from '@v1nt1248/3nclient-lib';
import { NOTIFICATIONS_KEY, NotificationsPlugin } from '@v1nt1248/3nclient-lib/plugins';
import { Sound } from '@shared/sounds';
import { chatService, videoOpenerSrv } from '@main/common/services/external-services';
import { useAppStore } from '@main/common/store/app.store';
import { useChatsStore } from '@main/common/store/chats.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import { chatMessageIdForCallEvent, generateChatMessageId } from '@shared/chat-ids';
import type { ChatIdObj } from '~/asmail-msgs.types';
import { makeLogger } from '@shared/logger';

const log = makeLogger('UiIncomingStore');

export const useUiIncomingStore = defineStore('ui-incoming', () => {
  const appStore = useAppStore();
  const chatsStore = useChatsStore();
  const messagesStore = useMessagesStore();
  const { t } = useI18n();
  const { $createNotice } = inject<NotificationsPlugin>(NOTIFICATIONS_KEY)!;

  let ring: Nullable<Sound> = null;

  function noticeCallAlreadyOver(): void {
    $createNotice({
      type: 'info',
      content: t('va.presettings.call_already_over'),
    });
  }

  async function startRinging() {
    const ringFileUrl = new URL('@main/common/assets/sounds/ring_tone.mp3', import.meta.url).href;
    ring = await Sound.from(ringFileUrl);
    ring.playInLoop();
  }

  function stopRinging() {
    if (ring) {
      ring.stop();
      ring = null;
    }
  }

  async function toggleRinging(flag: boolean) {
    if (flag) {
      await startRinging();
    } else {
      stopRinging();
    }
  }

  /**
   * Returns 'joined' when the call was actually answered, and 'no-call' when
   * the background service had no live call to join - the button was armed for
   * a call that has since ended. In that case every ephemeral call field is
   * cleared, so the dead button does not linger; the caller shows the user a
   * notice.
   */
  async function joinIncomingCall(chatObjId: ChatIdObj, sender: string): Promise<'joined' | 'no-call'> {
    // At `info`, here and in dismissIncomingCall: which device the user actually
    // answered on, from the side that saw the button. The background service logs
    // the same event from its own side (joinOrDismissCallInRoom); having both is
    // what tells "the button was never pressed here" from "it was pressed and the
    // request did not get through".
    log.info(`Joining incoming call in chat ${chatObjId.chatId} from ${sender}`);
    const callSessionId = chatsStore.getChatView(chatObjId)?.incomingCall?.callSessionId;
    await chatsStore.updateChatItemInList(chatObjId, { incomingCall: undefined });
    stopRinging();
    const { handled } = await videoOpenerSrv.joinOrDismissCallInRoom(
      chatObjId, true, sender, callSessionId,
    );
    if (!handled) {
      await chatsStore.updateChatItemInList(chatObjId, {
        isCallActive: false,
        callStart: undefined,
      });
      noticeCallAlreadyOver();
      return 'no-call';
    }
    return 'joined';
  }

  async function dismissIncomingCall(chatObjId: ChatIdObj, withoutMakeSystemMsg: boolean) {
    const chat = chatsStore.getChatView(chatObjId);
    if (!chat) {
      return;
    }

    const currentIncomingCall = cloneDeep(chat.incomingCall);
    if (!currentIncomingCall?.peerAddress) {
      return;
    }

    log.info(
      `Declining incoming call in chat ${chatObjId.chatId} from `
        + `${currentIncomingCall.peerAddress} (system message: ${!withoutMakeSystemMsg})`,
    );

    await chatsStore.updateChatItemInList(chatObjId, { incomingCall: undefined });
    stopRinging();
    // Pass the host's address so the host can be told this was an explicit
    // decline (as opposed to being unreachable) — see joinOrDismissCallInRoom.
    // It answers with the id of the call session, which the system message below
    // names: that is how the host tells this cancellation from one of an earlier
    // call still sitting in its inbox.
    const { handled, callSessionId } = await videoOpenerSrv.joinOrDismissCallInRoom(
      chatObjId, false, currentIncomingCall.peerAddress, currentIncomingCall.callSessionId,
    );
    if (!handled) {
      // Nothing was declined: the call this button was armed for is already
      // over. A system message about a cancellation would name no session (or
      // the wrong one) and only litter peers' inboxes.
      noticeCallAlreadyOver();
      return;
    }

    const recipients: string[] = [];
    if (chat.isGroupChat) {
      for (const member of Object.keys(chat.members)) {
        if (member !== appStore.user) {
          recipients.push(member);
        }
      }
    } else {
      recipients.push(currentIncomingCall.peerAddress);
    }

    if (withoutMakeSystemMsg) {
      return;
    }

    // Derived from the session id when the backend named one: declining on two
    // devices at once would otherwise leave two lines about one cancellation on
    // every device of ours (see chatMessageIdForCallEvent). The peer gets the
    // same id in the system message below, and benefits from it too - two
    // identical declines collapse into one there as a redelivery.
    //
    // The address the id names is the caller's, because that is the one this
    // record puts in `sender` - the same rule the records of somebody else's
    // decline follow (see recordCallEvent), so declines by different people in
    // one group call stay different records.
    const { chatMessageId, timestamp } = callSessionId
      ? {
        chatMessageId: chatMessageIdForCallEvent(
          'call-cancelled', callSessionId, currentIncomingCall.peerAddress,
        ),
        timestamp: Date.now(),
      }
      : generateChatMessageId();

    // Synchronized, not merely saved: declining is a decision of this device
    // alone, and the user's other devices - the ones that yielded when this one
    // took the call, or never rang at all - have nothing else to learn it from.
    // `sender` is the peer here, not us: that is what makes the line read as
    // "the incoming call from X was cancelled" (see getTextForChatSystemMessage).
    const systemMsg = await chatService.saveAndSyncLocalSystemMsg(
      appStore.user,
      chatObjId,
      {
        event: 'webrtc-call',
        value: {
          subType: 'incoming-call-cancelled',
          sender: currentIncomingCall.peerAddress,
          chatId: chatObjId,
          callSessionId,
        },
      },
      {
        isIncomingMsg: false,
        groupChatId: chat.isGroupChat ? chat.chatId : null,
        otoPeerCAddr: chat.isGroupChat ? null : chat.chatId,
        groupSender: chat.isGroupChat ? appStore.user : null,
        chatMessageId,
        timestamp,
      },
    );
    await messagesStore.handleAddedMsg(systemMsg);

    // Peers are told last, and their failure is not this function's failure.
    // The host already learned of the decline from the 'call-declined' signal
    // that the backend sent before any of this; the system message is the chat
    // history for the peers and a fallback teardown path. When it used to go
    // first, one rejected delivery took the local record with it and the
    // cancellation existed nowhere at all (live run of 2026-08-15).
    chatService.sendSystemDeletableMessage({
      chatId: chatObjId,
      recipients,
      chatMessageId,
      chatSystemData: {
        event: 'webrtc-call',
        value: {
          subType: 'incoming-call-cancelled',
          sender: appStore.user,
          chatId: chatObjId,
          callSessionId,
        },
      },
    }).catch(err => {
      log.error(
        `Failed to tell peers that the call in chat ${chatObjId.chatId} was declined here`,
        err,
      );
    });
  }

  async function startCall(chatObjId: ChatIdObj): Promise<void> {
    await videoOpenerSrv.startVideoCallForChatRoom(chatObjId);
  }

  async function endCall(chatObjId: ChatIdObj) {
    videoOpenerSrv.endVideoCallInChatRoom(chatObjId);
  }

  /**
   * Rejoin an active call in a group chat.
   * Used when user left the call but other participants are still talking.
   * Clears the isCallActive flag and starts the video call.
   */
  async function rejoinCall(chatObjId: ChatIdObj): Promise<void> {
    await chatsStore.updateChatItemInList(chatObjId, { isCallActive: false });
    await videoOpenerSrv.startVideoCallForChatRoom(chatObjId);
  }

  return {
    startRinging,
    stopRinging,
    toggleRinging,
    joinIncomingCall,
    dismissIncomingCall,
    startCall,
    endCall,
    rejoinCall,
  };
});
