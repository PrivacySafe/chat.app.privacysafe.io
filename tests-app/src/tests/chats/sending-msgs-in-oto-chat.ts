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
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChatsStore, useChatsStore } from '@main/common/store/chats.store.ts';
import { itCond } from '../../libs-for-tests/jasmine-utils.js';
import { ChatStore, useChatStore } from '@main/common/store/chat.store.ts';
import { useMessagesStore } from '@main/common/store/messages.store.ts';
import { TestSetupContainer } from '@tests/setups.js';
import { findOrCreateOneToOneChatWith, removeAllChats, waitEventFromChatService, waitForEventsFromChatService } from '../utils.js';
import { ChatIdObj } from "~/asmail-msgs.types.ts";
import { ChatMessageAddedEvent, ChatMessageUpdatedEvent, ChatServiceIPC } from '~/services.types.js';
import { DbRecordException } from '@bg/utils/exceptions.js';
import { RegularMsgView } from '~/chat.types.js';
import { sleep } from '@tests/lib-common/processes/sleep.js';

type WritableFS = web3n.files.WritableFS;

export function sendingMsgsInOTOChatSpec() {

  let chatsStore: ChatsStore;
  let chatStore: ChatStore;
  let messagesStore: ReturnType<typeof useMessagesStore>;
  let chatService: ChatServiceIPC;
  let fstUserAddr: string;
  let sndUserAddr: string;
  let chatId: ChatIdObj;
  let sndUserName: string;
  let testFS: WritableFS;

  beforeAll(async () => {
    ({
      fstUserAddr, sndUserAddr, sndUserName, chatService
    } = (window as any as TestSetupContainer).testSetup);
    chatsStore = useChatsStore();
    chatStore = useChatStore();
    messagesStore = useMessagesStore();
    await chatsStore.refreshChatList();
    chatId = await findOrCreateOneToOneChatWith(
      sndUserName+` at ${Date.now()}`, sndUserAddr, chatsStore, fstUserAddr
    );
    testFS = await (await w3n.storage!.getAppLocalFS()).writableSubRoot(
      `test-folder`
    );
  }, 15000);

  afterAll(async () => {
    await removeAllChats(chatsStore, chatStore);
    // XXX should may be send signal to other user(s) to clean up, if needed
  }, 15000);

  itCond(`sending message fails when current chat is not set`, async () => {
    if (!chatStore.currentChatId) {
      chatStore.resetCurrentChat();
    }
    await chatStore.sendMessageInChat({
      chatId,
      text: `attempted message`,
      files: undefined,
      relatedMessage: undefined,
    }).then(
      () => fail(`sending message should happen when current chat is set`),
      err => expect(err).toBeTruthy()
    );
  });

  itCond(`send and see acknowledgement of reading message`, async () => {
    if (chatStore.currentChatId?.chatId !== chatId.chatId) {
      await chatStore.setChatAndFetchMessages(chatId);
    }

    // send message
    const text = `test message text, and timestamp ${Date.now()} to find message in test`;
    const msgAddition = waitEventFromChatService('message', 'added');
    const msgUpdates = waitForEventsFromChatService('message', 'updated', 3);
    await chatStore.sendMessageInChat({ chatId, text, files: undefined, relatedMessage: undefined });
    const { msg: msgStartSending } = (await msgAddition) as ChatMessageAddedEvent;
    expect(msgStartSending.status).toBe('sending');

    const events = (await msgUpdates) as ChatMessageUpdatedEvent[];

    const msgSentEvent = events.find(ev => (ev.msg.status === 'sent'));
    expect(msgSentEvent).toBeDefined();
    // XXX add other more useful checks about history, etc.

    const msgReadEvent = events.find(ev => (ev.msg.status === 'read'));
    expect(msgReadEvent).toBeDefined();
    // XXX add other more useful checks about history, etc.

  }, 10000);

  // itCond(`send message with attachment`, async () => {
  //   if (chatStore.currentChatId?.chatId !== chatId.chatId) {
  //     await chatStore.setChatAndFetchMessages(chatId);
  //   }
  //
  //   const fileTxt = `This is content of test file`;
  //   const filePath = `test-${Date.now()}`;
  //   await testFS.writeTxtFile(filePath, fileTxt);
  //   const fileToAttach = await testFS.readonlyFile(filePath);
  //
  //   // send message
  //   const text = `test message text, and timestamp ${Date.now()} to find message in test`;
  //   const echoedMsgEvent = waitEventFromChatService('message', 'added',
  //     ev => {
  //       const {
  //         isIncomingMsg, incomingMsgId, attachments
  //       } = (ev as ChatMessageAddedEvent).msg as RegularMsgView;
  //       return (isIncomingMsg && !!incomingMsgId && !!attachments);
  //     }
  //   );
  //   await chatStore.sendMessageInChat({
  //     chatId,
  //     text,
  //     files: [fileToAttach],
  //     relatedMessage: undefined,
  //   });
  //
  //   // await echo with same body and attachments
  //   const { msg: echoMsg } = (await echoedMsgEvent) as ChatMessageAddedEvent;
  //   const {
  //     incomingMsgId, attachments, body, relatedMessage
  //   } = echoMsg as RegularMsgView;
  //   expect(body).toBe(text);
  //   const files = await messagesStore.getMessageAttachments(
  //     attachments!, incomingMsgId
  //   );
  //   expect(await files[0].readTxt()).toBe(fileTxt);
  //   expect(relatedMessage?.replyTo).withContext(`2nd test user also adds replyTo reference`).toBeDefined();
  //
  // }, 20000);

  itCond(`deleting non-existing message`, async () => {
    if (chatStore.currentChatId?.chatId !== chatId.chatId) {
      await chatStore.setChatAndFetchMessages(chatId);
    }

    // service throws error
    await chatService.deleteMessage({
      chatId, chatMessageId: `unknown-message-id`
    }, true).then(
      () => fail(`service should throw up on deletion with unknown/wrong message id`),
      (exc: DbRecordException) => {
        expect(exc.messageNotFound).toBeTrue();
      }
    );

    // but store should smething about this error
    await messagesStore.deleteMessageInChat(`unknown-message-id`);

    await chatService.deleteMessage({
      chatId: { isGroupChat: false, chatId: `unknown-chat` },
      chatMessageId: `unknown-message-id`
    }, true).then(
      () => fail(`service should throw up on deletion with unknown/wrong message id`),
      (exc: DbRecordException) => {
        expect(exc.chatNotFound).toBeTrue();
      }
    );
  });

  itCond(`sender deletes message`, async () => {
    if (chatStore.currentChatId?.chatId !== chatId.chatId) {
      await chatStore.setChatAndFetchMessages(chatId);
    }

    // send message to setup for deletion
    const text = `timestamp ${Date.now()} to find message in test`;
    const msgReadEvent = waitEventFromChatService('message', 'updated', ev => (
      ((ev as ChatMessageUpdatedEvent).msg.status === 'read') &&
      (((ev as ChatMessageUpdatedEvent).msg as RegularMsgView).body === text)
    ));
    await chatStore.sendMessageInChat({ chatId, text, files: undefined, relatedMessage: undefined });
    const { msg: msgWhenRead } = (await msgReadEvent) as ChatMessageUpdatedEvent;
    const { chatMessageId, body } = msgWhenRead as RegularMsgView;
    expect(body).withContext(`setup condition`).toBe(text);

    // delete message
    await messagesStore.deleteMessageInChat(chatMessageId, true);

    // give time for message propagation
    await sleep(3000);
  }, 20000);

}
