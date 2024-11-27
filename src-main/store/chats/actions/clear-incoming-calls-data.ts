import type { ChatsActions } from './types';

export const clearIncomingCallsData: ChatsActions['clearIncomingCallsData'] = function(this) {
  this.incomingCalls = [];
}
