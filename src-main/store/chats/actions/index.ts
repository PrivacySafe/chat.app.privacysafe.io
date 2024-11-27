import type { ChatsActions } from './types';
import { setChatDialogFlag } from './set-chat-dialog-flag';
import { setIncomingCallsData } from './set-incoming-calls-data';
import { clearIncomingCallsData } from './clear-incoming-calls-data';
import { getChatList } from './get-chat-list';
import { createChat } from './create-chat';
import { getChat } from './get-chat';
import { clearChat } from './clear-chat';
import { deleteChat } from './delete-chat';
import { leaveChat } from './leave-chat';
import { renameChat } from './rename-chat';
import { updateMembers } from './update-members';
import { getMessage } from './get-message';
import { getChatMessage } from './get-chat-message';
import { deleteMessage } from './delete-message';
import { sendMessage } from './send-message';
import { sendSystemMessage } from './send-system-message';
import { receiveMessage } from './receive-message';
import { handleUpdateChatName } from './handle-update-chat-name';
import { handlerDeleteChatMembers } from './handler-delete-chat-members';
import { handleUpdateMessageStatus } from './handle-update-message-status';
import { handlerAddChatMembers } from './handler-add-chat-members';
import { handlerRemoveChatMembers } from './handler-remove-chat-members';
import { handlerDeleteChatMessage } from './handler-delete-chat-message';

export const actions: ChatsActions = {
  setChatDialogFlag,
  setIncomingCallsData,
  clearIncomingCallsData,
  getChatList,
  createChat,
  getChat,
  clearChat,
  deleteChat,
  leaveChat,
  renameChat,
  updateMembers,
  getMessage,
  getChatMessage,
  deleteMessage,
  sendMessage,
  sendSystemMessage,
  receiveMessage,
  handleUpdateChatName,
  handlerDeleteChatMembers,
  handleUpdateMessageStatus,
  handlerAddChatMembers,
  handlerRemoveChatMembers,
  handlerDeleteChatMessage,
};
