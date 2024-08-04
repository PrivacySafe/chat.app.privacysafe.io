/*
 Copyright (C) 2024 3NSoft Inc.

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

import { Router } from "vue-router";
import { appChatsSrvProxy } from "./services/services-provider";
import { areAddressesEqual } from "./libs/address-utils";
import { useSharedRef } from "./router";

export class ChatCommandsHandler {

  private readonly unsub: () => void;

  constructor(
    private readonly router: Router
  ) {
    this.unsub = w3n.shell!.watchStartCmds!({
      next: this.process.bind(this),
      error: err => console.error(`Error in listening to commands for chat app:`, err),
      complete: () => console.log(`Listening to commands for chat app is closed by platform side.`)
    })
  }

  private async process(
    { cmd, params }: web3n.shell.commands.CmdParams
  ): Promise<void> {
    try {
      if ((cmd as MainWindowCommand) === 'open-chat-with') {
        await this.openChatWith(params[0])
      } else if ((cmd as MainWindowCommand) === 'incoming-call') {
        await this.showIncomingCall(params[0])
      } else {
        console.error(`🫤 Unknown/unimplemented command`, cmd, `with parameters`, params)
      }
    } catch (err) {
      console.error(`Error occured while handing command`, err)
      w3n.log?.('error', `Error occured while handing command`, err)
    }
  }

  private async openChatWith(cmdArg: OpenChatCmdArg): Promise<void> {
    const peerAddress = cmdArg?.peerAddress
    if ((typeof peerAddress !== 'string') || !peerAddress) {
      console.error(`Invalid peer address passed in open chat command`)
      return
    }
    if (areAddressesEqual(peerAddress, await w3n.mailerid!.getUserId())) {
      await this.router.push(`/chats`)
      return
    }
    const chatId = await findChatWithPeer(peerAddress)
    if (chatId) {
      await this.router.push(`/chats/${chatId}`)
    } else {
      await this.router.push(`/chats`)
      useSharedRef('newChatDialogFlag').value = true
    }
  }

  private async showIncomingCall(cmdArg: IncomingCallCmdArg): Promise<void> {
    useSharedRef('incomingCalls').value.push(cmdArg)
    if (this.router.currentRoute.value.name !== 'chat') {
      await this.router.push(`/chats/${cmdArg.chatId}`)
    }
  }

  static async start(router: Router): Promise<void> {
    const cmdsHandler = new ChatCommandsHandler(router)
    const startCmd = await w3n.shell!.getStartedCmd!()
    if (startCmd) {
      await cmdsHandler.process(startCmd)
    }
  }

}

async function findChatWithPeer(peerAddr: string): Promise<string|undefined> {
  const chats = await appChatsSrvProxy.getChatList()
  let smallestChat: string|undefined = undefined;
  let smallestChatSize = Number.MAX_SAFE_INTEGER;
  for (const { members, chatId } of chats) {
    if (members.find(addr => areAddressesEqual(addr, peerAddr))
    && (members.length < smallestChatSize)) {
      smallestChat = chatId
      smallestChatSize = members.length
      if (smallestChatSize === 2) {
        break
      }
    }
  }
  return smallestChat
}
