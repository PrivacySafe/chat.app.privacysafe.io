import type { ChatsActions } from './types';
import type { IncomingCallCmdArg } from '~/index';

export const setIncomingCallsData: ChatsActions['setIncomingCallsData'] = function(this, cmd: IncomingCallCmdArg) {
  this.incomingCalls.push(cmd);
};
