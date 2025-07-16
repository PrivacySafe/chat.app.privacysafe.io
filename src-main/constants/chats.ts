/*
 Copyright (C) 2020 - 2025 3NSoft Inc.

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

import type { ChatMessageAction, MessageDeliveryStatusUI, OutgoingMessageStatus } from '~/index';

export const chatMsgActionElementHeight = 24;

export const messageDeliveryStatuses: Record<OutgoingMessageStatus, MessageDeliveryStatusUI> = {
  sending: {
    icon: 'round-refresh',
    color: 'var(--color-icon-chat-bubble-user-quote)',
  },
  'sending:some-done': {
    icon: 'round-refresh',
    color: 'var(--color-icon-chat-bubble-user-quote)',
  },
  sent: {
    icon: 'round-check',
    color: 'var(--success-content-default)',
  },
  received: {
    icon: 'round-done-all',
    color: 'var(--success-content-default)',
  },
  'received:some': {
    icon: 'round-done-all',
    color: 'var(--success-content-default)',
  },
  'sent:all-failed': {
    icon: 'round-report-gmailerrorred',
    color: 'var(--error-content-default)',
  },
  'sent:some-failed': {
    icon: 'round-report-gmailerrorred',
    color: 'var(--error-content-default)',
  },
  'sent:canceled': {
    icon: 'round-report-gmailerrorred',
    color: 'var(--warning-content-default)',
  },
  read: {
    icon: 'round-done-all',
    color: 'var(--success-content-default)',
  },
  'read:some': {
    icon: 'round-done-all',
    color: 'var(--success-content-default)',
  },
};

export const chatMenuItems: {
  icon: string;
  action: string; // XXX this can be typed, can't it?
  text: string;
  chatTypes: ('single' | 'group' | 'group&admin')[];
  disabled?: boolean;
  isAccent?: boolean;
  margin?: boolean;
}[] = [
  {
    icon: 'outline-info',
    action: 'chat:info',
    text: 'chat.action.menu.txt.info',
    chatTypes: ['single', 'group'],
  },
  {
    icon: 'outline-edit',
    action: 'chat:rename',
    text: 'chat.action.menu.txt.rename',
    chatTypes: ['single', 'group&admin'],
  },
  {
    icon: 'round-system-update-alt',
    action: 'history:export',
    text: 'chat.action.menu.txt.history.export',
    chatTypes: ['single', 'group'],
  },
  {
    icon: 'outline-cleaning-services',
    action: 'history:clean',
    text: 'chat.action.menu.txt.history.clean',
    chatTypes: ['single', 'group'],
  },
  {
    icon: 'round-close',
    action: 'chat:close',
    text: 'chat.action.menu.txt.close',
    chatTypes: ['single', 'group'],
    margin: true,
  },
  {
    icon: 'outline-delete',
    action: 'chat:delete',
    text: 'chat.action.menu.txt.delete',
    chatTypes: ['single', 'group&admin'],
    isAccent: true,
    margin: true,
  },
  {
    icon: 'round-logout',
    action: 'chat:leave',
    text: 'chat.action.menu.txt.leave',
    chatTypes: ['group'],
    isAccent: true,
    margin: true,
  },
];

/*
* condition - {part1}:{part2}:{part3}
* part1 (message type): 'incoming'|'outgoing' OR '' (if it does not matter)
* part2 (message delivery status): lists the MessageDeliveryStatus separated by commas OR '' (if it does not matter)
* part3 (attachments):  true OR false OR '' (if it does not matter)
* */
export const messageActions: ChatMessageAction[] = [
  { id: 'reply', icon: { name: 'outline-reply' }, title: 'Reply', conditions: [] },
  {
    id: 'copy',
    icon: { name: 'round-content-copy' },
    title: 'chat.message.actions.menu.txt.copy',
    conditions: ['incoming::', 'outgoing:sent,received,error,canceled:'],
  },
  {
    id: 'forward',
    icon: { name: 'outline-reply', horizontalFlip: true },
    title: 'chat.message.actions.menu.txt.forward',
    conditions: ['incoming::', 'outgoing:sent,received,error,canceled:'],
  },
  {
    id: 'download',
    icon: { name: 'outline-download-for-offline' },
    title: 'chat.message.actions.menu.txt.download',
    conditions: ['incoming::true', 'outgoing:sent,received,error,canceled:true'],
  },
  { id: 'resend', disabled: true, icon: { name: 'round-refresh' }, title: 'Resend', conditions: ['outgoing:error:'] },
  {
    id: 'delete_message',
    icon: { name: 'outline-delete' },
    title: 'chat.message.actions.menu.txt.delete_message',
    conditions: ['incoming::', 'outgoing:sent,received,error,canceled:'],
    blockStart: true,
    accent: 'var(--warning-content-default)',
  },
  {
    id: 'cancel_sending',
    disabled: true,
    icon: { name: 'outline-delete' },
    title: 'chat.message.actions.menu.txt.cancel_sending',
    conditions: ['outgoing:sending:'],
    blockStart: true,
    accent: 'var(--warning-content-default)',
  },
];

export const validationParams = {
  chatsNameMaxLength: 50,
};
