import { ChatsActions } from './types'
import { appDeliverySrvProxy } from '../../../services/services-provider'

export const getMessage: ChatsActions['getMessage'] = async function (this, msgId): Promise<ChatIncomingMessage|undefined> {
  return appDeliverySrvProxy.getMessage(msgId)
}
