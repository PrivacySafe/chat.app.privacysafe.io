## Анализ системных сообщений (chatMessageType = 'system') в проекте

### Структура системного сообщения

```typescript
interface ChatSystemMsgV1 {
  v: 1;
  chatMessageType: 'system';
  groupChatId?: string;
  chatSystemData: ChatSystemMessageData;
  chatMessageId?: string;
}
```

### Все 13 типов событий системных сообщений

---

#### 1. `update:status` — Обновление статуса сообщения
**Когда:** Сообщение доставлено или прочитано
```typescript
{
  event: 'update:status';
  value: { chatMessageId: string; status: 'sent' | 'read'; };
}
```
**Источник:** `msg-status-updating.ts`, `msg-sending.ts`

---

#### 2. `delete:message` — Удаление сообщений
**Когда:** Пользователь удаляет сообщение(я)
```typescript
{
  event: 'delete:message';
  value: {
    oneMessage?: ChatMessageId;
    multipleMessages?: { chatMsgIds: ChatMessageId[] };
    allInChat?: ChatIdObj;
  };
}
```
**Источник:** `msg-deletion.ts`

---

#### 3. `update:members` — Изменение участников чата
**Когда:** Админ добавляет/удаляет участников
```typescript
{
  event: 'update:members';
  value: {
    membersToDelete: Record<string, { hasAccepted: boolean }>;
    membersToAdd: Record<string, { hasAccepted: boolean }>;
    membersAfterUpdate: Record<string, { hasAccepted: boolean }>;
  };
}
```
**Источник:** `chat-members-updating.ts`

---

#### 4. `update:admins` — Изменение администраторов
**Когда:** Назначаются/снимаются администраторы
```typescript
{
  event: 'update:admins';
  value: {
    adminsToDelete: string[];
    adminsToAdd: string[];
    adminsAfterUpdate: string[];
  };
}
```
**Источник:** `chat-members-updating.ts`

---

#### 5. `update:chatName` — Переименование чата
**Когда:** Изменяется название группового чата
```typescript
{
  event: 'update:chatName';
  value: { name: string; };
}
```
**Источник:** `chat-renaming.ts`

---

#### 6. `update:settings` — Обновление настроек чата
**Когда:** Изменяются настройки (автоудаление сообщений и др.)
```typescript
{
  event: 'update:settings';
  value: { settings: ChatSettings; };
}
```
**Источник:** `chat-setting-up.ts`

---

#### 7. `member-left` — Участник покинул чат
**Когда:** Пользователь самостоятельно выходит из чата
```typescript
{
  event: 'member-left';
  value?: { sender: string; };
}
```
**Источник:** `send-chat-msg.ts` (`sendSysMsgToLeaveChat`), `chat-member-removal.ts`

---

#### 8. `member-removed` — Участник удалён
**Когда:** Админ удаляет участника или удаляется весь чат
```typescript
{
  event: 'member-removed';
  chatDeleted?: true;
}
```
**Источник:** `send-chat-msg.ts` (`sendSysMsgsAboutRemovalFromChat`)

---

#### 9. `update:body` — Редактирование сообщения
**Когда:** Пользователь редактирует отправленное сообщение
```typescript
{
  event: 'update:body';
  value: { chatMessageId: string; body: string; };
}
```
**Источник:** `msg-editing.ts`, `chat-service.ts` (`updateEarlySentMessage`)

---

#### 10. `update:reactions` — Обновление реакций
**Когда:** Добавляются/удаляются реакции на сообщении
```typescript
{
  event: 'update:reactions';
  value: {
    chatMessageId: string;
    reactions: Record<string, ChatMessageReaction>;
  };
}
```
**Источник:** `msg-reactions.ts`, `chat-service.ts` (`changeMessageReaction`)

---

#### 11. `accept:invitation` — Принятие приглашения
**Когда:** Пользователь принял приглашение в чат (отображается в истории)
```typescript
{
  event: 'accept:invitation';
  value: { sender: string; };
}
```
**Источник:** `chat-creation.ts` (`createDisplayableSystemMessage`)

---

#### 12. `call` — Информация о звонке
**Когда:** Начало/завершение голосового или видеозвонка
```typescript
{
  event: 'call';
  value: {
    sender: string;
    direction: 'incoming' | 'outgoing';
    endTimestamp?: number | null;
  };
}
```
**Источник:** `chat-service.ts` (`postProcessingForVideoChat`)

---

#### 13. `webrtc-call` — WebRTC событие
**Когда:** Отмена входящего или исходящего WebRTC звонка
```typescript
{
  event: 'webrtc-call';
  value: {
    sender: string;
    subType: 'outgoing-call-cancelled' | 'incoming-call-cancelled';
    chatId: ChatIdObj;
  };
}
```
**Источник:** `webrtc-call-reaction.ts`, `video-chat-srv.ts`

---

### Способы отправки

| Функция | Назначение |
|---------|------------|
| `sendSystemMessage()` | Отправка с сохранением в delivery |
| `sendSystemDeletableMessage()` | Отправка с автоудалением (transient) |
| Прямое сохранение в БД | Локальные события (звонки, приглашения) |

### Сохранение в истории чата

**Сохраняемые (постоянные):** `update:members`, `update:admins`, `update:chatName`, `update:settings`, `member-left`, `accept:invitation`, `call`

**Transient (не сохраняются):** `update:status`, `delete:message`, `member-removed`, `update:body`, `update:reactions`, `webrtc-call`