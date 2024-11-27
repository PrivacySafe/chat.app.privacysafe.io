import { getRandomId } from '@v1nt1248/3nclient-lib/utils';
import type { ChatsActions } from './types';
import { appChatsSrvProxy, appDeliverySrvProxy } from '@main/services/services-provider';
import { msgIdLength } from '@main/constants';
import type { ChatOutgoingMessage } from '~/index';

export const sendSystemMessage: ChatsActions['sendSystemMessage'] = async function(this, {
  chatId,
  chatMessageId,
  recipients,
  event,
  value,
  displayable = false,
}) {
  const chat = await appChatsSrvProxy.getChat(chatId);
  const { members = [], admins = [], name } = chat || {};

  const msgId = getRandomId(msgIdLength);
  const msgData: ChatOutgoingMessage = {
    msgId,
    msgType: 'chat',
    recipients,
    jsonBody: {
      chatId,
      chatMessageType: 'system',
      ...(chat && name && { chatName: name }),
      members,
      admins,
      chatMessageId,
      chatSystemData: { event, value, displayable },
    },
  };
  appDeliverySrvProxy.addMessageToDeliveryList(msgData, `chat:${chatId}:${msgId}:system`);
  return msgId;
};
