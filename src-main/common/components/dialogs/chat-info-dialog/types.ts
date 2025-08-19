import type { ChatListItemView } from '~/chat.types.ts';

export interface ChatInfoDialogProps {
  chat: ChatListItemView;
  isMobileMode?: boolean;
}

export interface ChatInfoDialogEmits {
  (event: 'close'): void;
}
