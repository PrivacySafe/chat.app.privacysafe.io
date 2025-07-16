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

import type { Router } from 'vue-router';
import { chatService } from '@main/store/external-services';
import { areAddressesEqual, toCanonicalAddress } from '@shared/address-utils';
import type { ChatIdObj, IncomingCallCmdArg, MainWindowCommand, OpenChatCmdArg } from '~/index';
import { useRouting } from '@main/composables/useRouting';

export class ChatCommandsHandler {

  private readonly unsub: () => void;

  constructor(
    private readonly ownAddr: string,
    private readonly router: Router
  ) {
    this.unsub = w3n.shell!.watchStartCmds!({
      next: this.process.bind(this),
      error: err => console.error(`Error in listening to commands for chat app:`, err),
      complete: () => console.log(`Listening to commands for chat app is closed by platform side.`),
    });
  }

  private async process(
    { cmd, params }: web3n.shell.commands.CmdParams,
  ): Promise<void> {
    try {
      if ((cmd as MainWindowCommand) === 'open-chat-with') {
        await this.openChatWith(params[0]);
      } else if ((cmd as MainWindowCommand) === 'incoming-call') {
        await this.showIncomingCall(params[0]);
      } else {
        console.error(`🫤 Unknown/unimplemented command`, cmd, `with parameters`, params);
      }
    } catch (err) {
      console.error(`Error occurred while handing command`, err);
      w3n.log('error', `Error occurred while handing command`, err);
    }
  }

  private async openChatWith(cmdArg: OpenChatCmdArg): Promise<void> {
    const peerAddress = cmdArg?.peerAddress;
    if ((typeof peerAddress !== 'string') || !peerAddress) {
      console.error(`Invalid peer address passed in open chat command`);
      return;
    }

    const { goToChatsRoute, goToChatRoute } = useRouting(this.router);
    if (areAddressesEqual(peerAddress, this.ownAddr)) {
      await goToChatsRoute();
      return;
    }

    const chatId = cmdArg.chatId
      ? cmdArg.chatId
      : await findOneToOneChatWithPeer(peerAddress);

    if (chatId) {
      await goToChatRoute(chatId);
    } else {
      await goToChatsRoute({ createNew: true });
    }
  }

  private async showIncomingCall(
    { chatId, peerAddress: callingPeer }: IncomingCallCmdArg
  ): Promise<void> {
    const { goToChatRoute } = useRouting(this.router);
    await goToChatRoute(chatId, { callingPeer });
  }

  static async start(router: Router): Promise<void> {
    const ownAddr = await w3n.mailerid!.getUserId();
    const cmdsHandler = new ChatCommandsHandler(ownAddr, router);
    const startCmd = await w3n.shell!.getStartedCmd!();
    if (startCmd) {
      await cmdsHandler.process(startCmd);
    }
  }

}

async function findOneToOneChatWithPeer(
  peerAddr: string
): Promise<ChatIdObj | undefined> {
  const chats = await chatService.getChatList();
  const peerCAddr = toCanonicalAddress(peerAddr);
  for (const { isGroupChat, chatId } of chats) {
    if (!isGroupChat && (chatId === peerCAddr)) {
      return { isGroupChat, chatId }
    }
  }
}
