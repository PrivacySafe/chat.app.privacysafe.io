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
import { shallowRef } from 'vue';
import { chatService, videoOpenerSrv } from '@main/common/services/external-services';
import { useChatsStore } from '@main/common/store/chats.store';
import { useMessagesStore } from '@main/common/store/messages.store';
import type { UpdateEvent } from '~/services.types';
import { SingleProc } from '@shared/processes/single';

export function useInitialize() {
  const chatsStore = useChatsStore();
  const messagesStore = useMessagesStore();

  const {
    handleBackgroundChatEvents,
    refreshChatList,
    updateChatItemInList,
  } = chatsStore;
  const { handleBackgroundMessageEvents } = messagesStore;

  const updatesQueue: UpdateEvent[] = [];
  const updatesProc = new SingleProc();

  const stopMessagesProcessing = shallowRef<(() => void) | undefined>(undefined);
  const stopVideoCallsWatching = shallowRef<(() => void) | undefined>(undefined);

  async function processQueuedUpdateEvents(): Promise<void> {
    while (updatesQueue.length > 0) {
      const event = updatesQueue.pop()!;
      try {
        switch (event.updatedEntityType) {
          case 'chat':
            return handleBackgroundChatEvents(event);
          case 'message':
            return handleBackgroundMessageEvents(event);
          default:
            console.info(`Unknown update event from ChatService:`, event);
            break;
        }
      } catch (err) {
        console.error(err);
      }
    }
  }

  async function initialize() {
    await refreshChatList();

    stopMessagesProcessing.value = chatService.watch({
      next: updateEvent => {
        updatesQueue.push(updateEvent);
        if (!updatesProc.getP()) {
          updatesProc.start(processQueuedUpdateEvents);
        }
      },
      complete: () => console.log(`Observation of updates events from ChatService completed.`),
      error: err => console.error(`Error occurred in observation of updates events from ChatService: `, err),
    });

    stopVideoCallsWatching.value = videoOpenerSrv.watchVideoChats({
      next: async data => {
        const { type, chatId } = data;
        // eslint-disable-next-line default-case
        switch (type) {
          case 'call-started':
            await updateChatItemInList(chatId, { callStart: Date.now() });
            break;

          case 'call-ended':
            await updateChatItemInList(chatId, { callStart: undefined });
            break;

          case 'close-channel':
            // TODO
            break;
        }
      },
      complete: () => console.log('Observation of video call events from VideoOpenerService completed.'),
      error: err => console.error('Error occurred in observation of video call events from VideoOpenerService:', err),
    });
  }

  return {
    stopMessagesProcessing,
    stopVideoCallsWatching,
    initialize,
  };
}
