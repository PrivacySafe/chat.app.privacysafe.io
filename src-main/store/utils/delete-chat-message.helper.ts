import isEmpty from 'lodash/isEmpty';
import { appChatsSrvProxy, appDeliverySrvProxy, fileLinkStoreSrv } from '@main/services/services-provider';
import type { ChatMessageView, MessageType } from '~/index';

export async function deleteChatMessage(
  { chatMsgId, message }: { chatMsgId: string, message: ChatMessageView<MessageType> },
): Promise<void> {
  const { messageType, attachments, msgId } = message;
  await appChatsSrvProxy.deleteMessage({ chatMsgId });
  if (messageType === 'incoming') {
    await appDeliverySrvProxy.removeMessageFromInbox([msgId]);
  } else {
    await appDeliverySrvProxy.removeMessageFromDeliveryList([msgId]);
    if (!isEmpty(attachments)) {
      for (const attachment of attachments!) {
        const { id } = attachment;
        id && await fileLinkStoreSrv.deleteLink(id);
      }
    }
  }
}
