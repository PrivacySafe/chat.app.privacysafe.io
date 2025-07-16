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

import { chatService } from "@main/store/external-services";
import { AppViewInstance, useAppView } from "@main/composables/useAppView";
import { ChatServiceIPC, UpdateEvent } from "~/services.types";
import { ChatStore, useChatStore } from "@main/store/chat.store";
import { addMsgToPage } from "./test-page-utils";
import { sleep } from "./lib-common/processes/sleep";
import { ChatInvitationMsgView, RegularMsgView } from "~/chat.types";
import { ChatsStore, useChatsStore } from "@main/store/chats.store";

declare const w3n: web3n.testing.CommonW3N;

export interface TestSetupContainer extends Window {
  testSetup: {
    fstUserAddr: string;
    fstUserName: string;
    sndUserAddr: string;
    sndUserName: string;
    thirdUserAddr: string;
    thirdUserName: string;
    appView: AppViewInstance;
    chatService: ChatServiceIPC;
  };
}


export async function setupBeforeAllTests(): Promise<void> {

  const appView = useAppView();
  await appView.doBeforeMount();

  const fstUserAddr = await w3n.testStand.idOfTestUser(1);
  const fstUserName = `1st user`;
  const sndUserAddr = await w3n.testStand.idOfTestUser(2);
  const sndUserName = `2nd user`;
  const thirdUserAddr = await w3n.testStand.idOfTestUser(3);
  const thirdUserName = `3rd user`;

  (window as any as TestSetupContainer).testSetup = {
    appView,
    chatService,
    fstUserAddr, fstUserName, sndUserAddr, sndUserName,
    thirdUserAddr, thirdUserName
  };
}

export function setupSecondaryUser(userNum: 2|3): void {
  const { sndUserName, thirdUserName } = (window as any as TestSetupContainer).testSetup;
  let userName: string;
  if (userNum === 2) {
    userName = sndUserName;
  } else if (userNum === 3) {
    userName = thirdUserName;
  } else {
    throw new Error(`Invalid user number ${userNum}`);
  }
  const chatStore = useChatStore();
  const chatsStore = useChatsStore();
  const markIncomingMessagesRead = handlerToMarkIncomingMessagesRead(
    chatStore
  );
  const sendAttachmentBackInReply = handlerToSendAttachmentBackInReply(
    chatStore
  );
  const acceptChatInvite = handlerToAcceptChatInvitation(
    chatsStore, userName
  );
  const stopWatching = chatService.watch({
    next: ev => {
      if ((ev.updatedEntityType === 'message') && (ev.event === 'added')) {
        const { msg } = ev;
        const { isIncomingMsg, chatMessageType } = msg;
        if (isIncomingMsg) {
          if (chatMessageType === 'regular') {
            markIncomingMessagesRead(msg);
            sendAttachmentBackInReply(msg);
          } else if (chatMessageType === 'invitation') {
            acceptChatInvite(msg);
          }
        }
      }
      displayUpdateEvent(ev);
    },
    error: err => console.error(`Failure in watching chat service events`, err),
    complete: () => console.warn(`Watching chat service events completed`)
  });
}

function handlerToAcceptChatInvitation(
  chatsStore: ChatsStore, sndUserName: string
): (msg: ChatInvitationMsgView) => void {
  const { acceptChatInvitation } = chatsStore;
  return async msg => {
    const { type } = msg.inviteData;
    if ((type === 'oto-chat-invite') || (type === 'group-chat-invite')) {
      const { chatId, chatMessageId } = msg;
      await sleep(1000);
      await acceptChatInvitation({ chatId, chatMessageId }, sndUserName)
      .catch(err => console.error(
        `Error in accpeting chat invitation`, err
      ));
    }
  }
}

function handlerToMarkIncomingMessagesRead(
  chatStore: ChatStore
): (msg: RegularMsgView) => void {
  const { markMessageAsRead } = chatStore;
  return async msg => {
    const {
      isIncomingMsg, status, chatId, chatMessageId
    } = msg;
    if (isIncomingMsg && (status === 'unread')) {
      await sleep(1000);
      await markMessageAsRead(chatId, chatMessageId)
      .catch(err => console.error(
        `Error in marking incoming message as read`, err
      ));
    }
  };
}

function handlerToSendAttachmentBackInReply(
  chatStore: ChatStore
): (msg: RegularMsgView) => void {
  const {
    setChatAndFetchMessages, getMessageAttachments, sendMessageInChat
  } = chatStore;
  const fsPromise = w3n.storage!.getAppLocalFS().then(
    fs => fs.writableSubRoot(`test on ${Date.now()}`)
  );
  return async msg => {
    const { isIncomingMsg, attachments, incomingMsgId } = msg;
    if (!isIncomingMsg || !attachments || !incomingMsgId) {
      return;
    }
    // get attachment
    const { chatId, chatMessageId, body } = msg;
    await setChatAndFetchMessages(chatId);
    const filesFromInbox = await getMessageAttachments(
      attachments, incomingMsgId
    );
    // put them into linkable files
    const fs = await fsPromise;
    const files = await Promise.all(filesFromInbox.map(
      f => fs.saveFile(f, f.name).then(() => fs.readonlyFile(f.name))
    ));
    // echo it all back, adding replyTo reference
    await sendMessageInChat(chatId, body, files, {
      replyTo: { chatMessageId }
    });
  }
}

function displayUpdateEvent(ev: UpdateEvent): void {
  const { updatedEntityType, event } = ev;
  delete (ev as any).updatedEntityType;
  delete (ev as any).event;
  addMsgToPage(`🖥️ ${updatedEntityType} ${event} ${Object.values(ev).map(v => JSON.stringify(v, null, 2)).join(', ')}`);
}
