import type { ChatsActions } from './types';

export const setChatDialogFlag: ChatsActions['setChatDialogFlag'] = function(this, value: boolean) {
  this.newChatDialogFlag = value;
}
