# Архитектурный дизайн: Синхронизация комнаты, живой стриминг ответов Мастера и учёт токенов

## 1. Контекст и цели
В мультиплеерных комнатах D&D 5e (`battle+ai`):
1. **Статусы Мастера («Мастер обдумывает...»)** отображались только у хоста в одиночном хуке или ошибочно дублировались в нижнем блоке действий (`PartyTurnBar`), а не в ленте чата. Нужно, чтобы статус отображался непосредственно в чате для ВСЕХ участников комнаты.
2. **Стриминг ответа Мастера**: Сейчас генерация блокирующая (`generateText`), и ответ появляется у остальных только целиком после сохранения в БД. Нужно, чтобы текст ответа Мастера плавно появлялся у всех участников в реальном времени.
3. **Расход токенов и стоимость**: При генерации раунда комнаты не сохранялся объект `_stats` (токены, кеш, рубли) в `chatMessage`, из-за чего под сообщением Мастера отсутствовал блок телеметрии, а общая статистика кампании не обновлялась.
4. **Очистка панели ввода**: Убрать навязчивый баннер ожидания из нижнего блока ввода (`PartyTurnBar`), оставив фокус на действиях персонажей, а статус перенести в чат.

---

## 2. Архитектура и поток данных (Data Flow)

### 2.1. Стриминг и Realtime-шина (Supabase Realtime Broadcast)
```
[Клиент-инициатор (Хост / последний готовый игрок)]
         │
         │ POST /api/room/[code]/turn/resolve (или /turn auto-resolve)
         ▼
[Сервер Next.js: resolveActiveRoomTurnHelper]
         │
         ├─► streamText() из 'ai' (с поддержкой tools: roll_dice, start_combat и т.д.)
         ├─► Передача потока клиенту-инициатору через Server-Sent Events (SSE) / Data Stream
         │
         ▼
[Клиент-инициатор получает чанки текста]
         │
         ├─► Обновляет локальный стримящийся баббл сообщения
         ├─► Транслирует событие в Supabase Realtime:
         │   channel(`room:${roomId}`).send({
         │     type: "broadcast",
         │     event: "dm_stream",
         │     payload: {
         │       type: "chunk" | "status" | "finish",
         │       turnId,
         │       roundNumber,
         │       text: accumulatedText,
         │       statusText?: string,
         │       stats?: { usage, costRub }
         │     }
         │   })
         ▼
[Все остальные клиенты в комнате]
         │
         └─► Подписка `channel.on("broadcast", { event: "dm_stream" })`
             ├─ payload.type === "status": отображает индикатор в чате
             ├─ payload.type === "chunk": плавно выводит появляющийся текст в чате
             └─ payload.type === "finish": закрепляет сообщение, показывает токены/рубли,
                 обновляет campaignStats
```

### 2.2. Завершение генерации и персистентность (Persistence & Fallback)
1. Сервер по завершении `streamText`:
   - Извлекает `usage = await result.usage` (`inputTokens`, `outputTokens`, `cachedTokens`, `totalTokens`).
   - Рассчитывает стоимость `costRub = calculateCostRub(model, usage)`.
   - Сохраняет `_stats: { model, usage, costRub }` в поле `toolResults` записи `db.chatMessage`.
   - Завершает раунд в Supabase (`status = "completed"`, `dm_response = narrative`) через `roomService.resolveRoomTurn`.
2. Если у любого участника моргнула сеть или отключился WebSocket:
   - При следующем такте опроса (`/api/room/[code]/turn` и `/api/chat/history`) клиент гарантированно получает готовое завершённое сообщение со всеми статистиками из БД.

---

## 3. Изменения компонентов интерфейса

### 3.1. Лента сообщений чата (`DnDApp.tsx`)
* В конце списка сообщений (перед `messagesEndRef`):
  ```tsx
  {(isLoading || resolvingTurn || activeRoomTurn?.status === "resolving" || streamingDmText) && (
    <div className="flex flex-col gap-2">
      {streamingDmText ? (
        <MessageBubble
          role="assistant"
          content={streamingDmText}
          metadata={null}
        />
      ) : (
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground pl-3 py-2 animate-pulse">
          <Loader2 className="size-4 animate-spin text-amber-500" />
          <Dices className="size-4 text-amber-600/70" />
          <span>{dmStatusText || "Мастер оценивает действия отряда и описывает события мира..."}</span>
        </div>
      )}
    </div>
  )}
  ```
* Индикатор виден **одновременно всем участникам комнаты** благодаря синхронизации статуса `activeRoomTurn.status === "resolving"` и realtime-событий `dm_stream`.

### 3.2. Нижняя панель действий (`PartyTurnBar.tsx`)
* Удаляем из `CardContent` дублирующий желтый баннер:
  `{resolving && (<div ...>✨ Мастер оценивает действия отряда...</div>)}`.
* Ввод действий остаётся чистым, а внимание игрока при генерации направлено в чат.

### 3.3. Блок расхода токенов и стоимости (`MessageBubble.tsx`)
* `MessageBubble` уже умеет отображать:
  ```tsx
  {role === "assistant" && metadata?.usage && (
    <div className="mt-2.5 pt-1.5 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
      <span>⏱️ {formatTokens(metadata.usage.totalTokens)} токенов</span>
      ...
      <span>~{formatRubles(metadata.costRub)}</span>
    </div>
  )}
  ```
* Теперь для раундов комнаты этот блок будет гарантированно отображаться, потому что:
  1) `resolveActiveRoomTurnHelper` сохраняет `_stats` в `toolResults`.
  2) `/api/chat/history` извлекает `_stats` из `toolResults` и прокидывает в `metadata`.
  3) При завершении стрима `campaignStats` обновляется на клиенте.

---

## 4. План тестирования и верификации
1. **Unit/Integration тесты (`resolve-turn-helper.test.ts`, `room-combat-tool.test.ts`)**:
   - Проверка возврата `usage` и `costRub` из `resolveActiveRoomTurnHelper`.
   - Проверка записи `_stats` в базу данных SQLite (`db.chatMessage`).
2. **Типизация и линтинг**:
   - `npx tsc --noEmit` — 0 ошибок.
   - `npx eslint .` — 0 ошибок.
3. **E2E / Браузерная проверка**:
   - Проверка отображения индикатора в чате.
   - Проверка отображения токенов под ответом Мастера.
