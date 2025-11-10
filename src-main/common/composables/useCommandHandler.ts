import { storeToRefs } from 'pinia';
import { useRouting } from '@main/desktop/composables/useRouting';
import { chatService } from '@main/common/services/external-services';
import { useAppStore } from '@main/common/store/app.store';
import { areAddressesEqual, toCanonicalAddress } from '@shared/address-utils';
import type { ChatIdObj } from '~/asmail-msgs.types';
import type { IncomingCallCmdArg, OpenChatCmdArg } from '~/chat-commands.types';

export function useCommandHandler() {
  const { goToChatsRoute, goToChatRoute } = useRouting();
  const { user: ownAddr } = storeToRefs(useAppStore());

  async function findOneToOneChatWithPeer(peerAddr: string): Promise<ChatIdObj | undefined> {
    const chats = await chatService.getChatList();
    const peerCAddr = toCanonicalAddress(peerAddr);

    for (const chat of chats) {
      const { isGroupChat, chatId } = chat;

      if (!isGroupChat && chatId === peerCAddr) {
        return { isGroupChat, chatId };
      }
    }
  }

  async function openChatWith(cmdArg: OpenChatCmdArg): Promise<void> {
    const peerAddress = cmdArg?.peerAddress;
    if ((typeof peerAddress !== 'string') || !peerAddress) {
      w3n.log('error', 'Invalid peer address passed in open chat command');
      return;
    }

    if (areAddressesEqual(peerAddress, ownAddr.value)) {
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

  async function showIncomingCall({ chatId, peerAddress: callingPeer }: IncomingCallCmdArg): Promise<void> {
    await goToChatRoute(chatId, { callingPeer });
  }

  async function process({ cmd, params }: web3n.shell.commands.CmdParams): Promise<void> {
    try {
      switch (cmd) {
        case 'open-chat-with':
          return openChatWith(params[0]);
        case 'incoming-call':
          return showIncomingCall(params[0]);
        default:
          w3n.log('error', `🫤 Unknown/unimplemented command ${cmd}, with parameters ${(params || []).join(', ')}}`);
          break;
      }
    } catch (err) {
      w3n.log('error', `Error occurred while handing command`, err);
    }
  }

  async function start(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const unsub = w3n.shell!.watchStartCmds!({
      next: cmdParams => {
        process(cmdParams);
      },
      error: err => w3n.log('error', `Error in listening to commands for chat app:`, err),
      complete: () => console.info(`Listening to commands for chat app is closed by platform side.`),
    });

    const startCmd = await w3n.shell!.getStartedCmd!();
    if (startCmd) {
      await process(startCmd);
    }
  }

  return { start };
}
