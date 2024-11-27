import type { ChatsActions } from './types';
import { appDeliverySrvProxy } from '@main/services/services-provider';
import type { ChatIncomingMessage } from '~/index';

export const getMessage: ChatsActions['getMessage'] = async function(this, msgId): Promise<ChatIncomingMessage | undefined> {
  return appDeliverySrvProxy.getMessage(msgId);
};
