import { get, without } from 'lodash';
import { useAppStore } from '../store/app.store';
import { getContactName } from './contacts.helper';
import type { ChatMessageView, ChatView, MessageType } from '~/index';

export function getChatName(chat: ChatView & { unread: number } & ChatMessageView<MessageType>): string {
  const { name, members = [] } = chat;
  const { user } = useAppStore();
  const isChatGroup = members.length > 2;
  if (isChatGroup) {
    return name || 'Untitled';
  }

  if (name) {
    return getContactName(name);
  }

  const friend = get(without(members, user), [0], '');
  return getContactName(friend);
}

export function getChatSystemMessageText(
  { chat, message }:
    {
      chat: ChatView & { unread: number } & ChatMessageView<MessageType> | null,
      message?: ChatMessageView<MessageType>
    },
): string {
  const key = get(message, 'body');
  if (!key || !chat) {
    return '';
  }

  const appStore = useAppStore();
  const { sender } = chat;

  if (key === 'rename.chat.system.message') {
    const text = appStore.$i18n.tr(key);
    return sender
      ? `${text} ${getContactName(sender)}`
      : text;
  }

  if (
    key.includes('leave.chat.system.message')
    || key.includes('delete.member.system.message')
    || key.includes('delete.members.system.message')
  ) {
    const values = key.match(/\[([^\[\]]+)]/);
    if (values) {
      const usersStr = values[1];
      const i18key = key.replace(values[0], '');
      return `${usersStr} ${appStore.$i18n.tr(i18key)}`;
    }
    return '';
  }

  if (
    key.includes('add.members.system.message')
    || key.includes('remove.members.system.message')
  ) {
    const membersToAdd = key.match(/\[([^\[\]]+)]/);
    if (membersToAdd) {
      const membersToAddStr = membersToAdd[1];
      const i18key = key.replace(membersToAdd[0], '');
      return appStore.$i18n.tr(i18key, { user: sender, members: membersToAddStr });
    }
    return '';
  }

  return appStore.$i18n.tr(key);
}
