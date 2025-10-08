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

import type { ChatMenuItem, ChatMessageAction, MessageDeliveryStatusUI, OutgoingMessageStatus } from '~/index';

export const chatMsgActionElementHeight = 24;

export const messageDeliveryStatuses: Record<OutgoingMessageStatus, MessageDeliveryStatusUI> = {
  sending: {
    icon: 'round-refresh',
    color: 'var(--color-icon-chat-bubble-user-quote)',
  },
  sent: {
    icon: 'round-check',
    color: 'var(--success-content-default)',
  },
  error: {
    icon: 'round-report-gmailerrorred',
    color: 'var(--error-content-default)',
  },
  canceled: {
    icon: 'round-cancel-schedule-send',
    color: 'var(--warning-content-default)',
  },
  read: {
    icon: 'round-done-all',
    color: 'var(--success-content-default)',
  },
};

export const chatMenuItems: ChatMenuItem[] = [
  {
    icon: 'outline-info',
    action: 'chat:info',
    text: 'chat.action.menu.txt.info',
    chatTypes: ['single', 'group'],
  },
  {
    icon: 'outline-timer',
    action: 'chat:timer',
    text: 'chat.action.menu.txt.timer',
    chatTypes: ['single', 'group'],
    subMenu: [
      {
        icon: '',
        action: 'chat:timer:0',
        text: 'chat.action.menu.txt.timer.0',
        chatTypes: ['single', 'group'],
      },
      {
        icon: '',
        action: 'chat:timer:1',
        text: 'chat.action.menu.txt.timer.1',
        chatTypes: ['single', 'group'],
      },
      {
        icon: '',
        action: 'chat:timer:2',
        text: 'chat.action.menu.txt.timer.2',
        chatTypes: ['single', 'group'],
      },
      {
        icon: '',
        action: 'chat:timer:3',
        text: 'chat.action.menu.txt.timer.3',
        chatTypes: ['single', 'group'],
      },
      {
        icon: '',
        action: 'chat:timer:4',
        text: 'chat.action.menu.txt.timer.4',
        chatTypes: ['single', 'group'],
      },
    ],
  },
  {
    icon: 'outline-edit',
    action: 'chat:rename',
    text: 'chat.action.menu.txt.rename',
    chatTypes: ['group&admin'],
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
  },
  {
    icon: 'outline-delete',
    action: 'chat:delete',
    text: 'chat.action.menu.txt.leave',
    chatTypes: ['single', 'group'],
    isAccent: true,
    margin: true,
  },
];

/*
* condition - {part1}:{part2}:{part3}
* part1 (message type): 'incoming'|'outgoing' OR '' (if it does not matter)
* part2 (message delivery status): lists the MessageStatus separated by commas OR '' (if it does not matter)
* part3 (attachments):  true OR false OR '' (if it does not matter)
* part4 (lifetime): '' if it does not matter OR a string like '>1000' or '<1000' ('>' or '<' is the comparison
*  condition and then the value in ms
* */
export const messageActions: ChatMessageAction[] = [
  {
    id: 'reaction',
    icon: { name: 'outline-heart-plus' },
    title: 'chat.message.actions.menu.txt.reaction',
    conditions: [':sent,read::'],
  },
  {
    id: 'reply',
    icon: { name: 'outline-reply' },
    title: 'chat.message.actions.menu.txt.reply',
    conditions: ['incoming:sent,read::']
  },
  {
    id: 'copy',
    icon: { name: 'round-content-copy' },
    title: 'chat.message.actions.menu.txt.copy',
    conditions: ['incoming:::', 'outgoing:sent,read,error,canceled::'],
  },
  {
    id: 'forward',
    icon: { name: 'outline-reply', horizontalFlip: true },
    title: 'chat.message.actions.menu.txt.forward',
    conditions: ['incoming:::', 'outgoing:sent,read,error,canceled::'],
  },
  {
    id: 'edit',
    icon: { name: 'outline-edit' },
    title: 'chat.message.actions.menu.txt.edit',
    conditions: ['outgoing:sent,read,error,canceled::<86400000'],
  },
  {
    id: 'download',
    icon: { name: 'outline-download-for-offline' },
    title: 'chat.message.actions.menu.txt.download',
    conditions: ['incoming::true:', 'outgoing:sent,read,error,canceled:true:'],
  },
  {
    id: 'resend',
    icon: { name: 'round-refresh' },
    title: 'chat.message.actions.menu.txt.resend',
    conditions: ['outgoing:error::']
  },
  {
    id: 'select',
    icon: { name: 'round-check-circle-outline' },
    title: 'chat.message.actions.menu.txt.select',
    conditions: [':::'],
  },
  {
    id: 'info',
    icon: { name: 'outline-info', rotateIcon: 2 },
    title: 'chat.message.actions.menu.txt.info',
    conditions: [':::'],
  },
  {
    id: 'delete_message',
    icon: { name: 'outline-delete' },
    title: 'chat.message.actions.menu.txt.delete_message',
    conditions: ['incoming:::', 'outgoing:sent,read,error,canceled::'],
    blockStart: true,
    accent: 'var(--warning-content-default)',
  },
  {
    id: 'cancel_sending',
    disabled: true,
    icon: { name: 'outline-delete' },
    title: 'chat.message.actions.menu.txt.cancel_sending',
    conditions: ['outgoing:sending::'],
    blockStart: true,
    accent: 'var(--warning-content-default)',
  },
];

export const validationParams = {
  chatsNameMaxLength: 50,
};
