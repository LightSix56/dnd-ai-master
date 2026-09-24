# План реализации: Система совместного пошагового хода отряда (Cooperative Party Turns)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать синхронный пошаговый ввод действий для всех игроков сетевого стола: каждый игрок пишет заявку строго за своего персонажа, все видят заявки друг друга, повторный ввод блокируется («Сказанного не вернёшь»), при 100% готовности отряда мир автоматически реагирует через AI-Мастера, а ведущий (ДМ) может отправить ход принудительно, если кто-то задерживается.

**Architecture:** Серверная валидация и блокировка повторной отправки в `room_turns`, вычисление готовности через `calculateTurnReadiness`, автоматический серверный вызов генерации мира при `isAllReady`, компонент `PartyTurnBar` над полем ввода для отображения карточек участников и их цитат, интеграция перехвата сообщений в `DnDApp.tsx`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Vitest, Supabase Realtime/REST, Tailwind CSS, Lucide Icons, AI SDK.

**Spec:** [`docs/superpowers/specs/2026-09-24-cooperative-party-turns-design.md`](file:///C:/antig/battle+ai/docs/superpowers/specs/2026-09-24-cooperative-party-turns-design.md)

## Global Constraints
- Чистая светлая тема (white card, black text, `--background: oklch(1 0 0)`, `--foreground: oklch(0.145 0 0)`), без средневекового пергамента.
- Принцип «Сказанного не вернёшь»: запрет повторного ввода/редактирования заявки в активном раунде после отправки.
- Очистка прокси `$env:HTTPS_PROXY=""; $env:HTTP_PROXY="";` перед любыми сетевыми и git командами.
- Обязательный запуск тестов, линтера, `graphify update .` и `git push origin main` перед завершением.

---

### Task 1: Backend Turn API — Блокировка повторной отправки и авто-резолвинг

**Files:**
- Modify: `src/app/api/room/[code]/turn/route.ts`
- Modify: `src/lib/room/room-service.ts`
- Test: `src/app/api/room/__tests__/cooperative-turn.test.ts`

**Interfaces:**
- Consumes: `RoomService.submitPlayerAction()`, `calculateTurnReadiness()`, `bundleTurnInputs()`
- Produces: `POST /api/room/[code]/turn` returns `{ success: true, resolved: boolean, turn: RoomTurn, nextRoundNumber?: number }`

- [x] **Step 1: Написать падающий юнит-тест на блокировку повторной отправки и авто-резолвинг**

```ts
// src/app/api/room/__tests__/cooperative-turn.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomService } from "@/lib/room/room-service";
import type { PlayerTurnInput } from "@/lib/room/turn-batcher";

describe("Cooperative Turn Logic", () => {
  it("rejects duplicate submission from the same user in active round", async () => {
    const existingTurn = {
      id: "turn-1",
      room_id: "room-1",
      round_number: 1,
      status: "waiting",
      player_inputs: {
        "user-1": {
          userId: "user-1",
          characterName: "Торин",
          actionText: "Атакую молотом",
          submittedAt: 1000,
        },
      },
    };

    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: existingTurn, error: null }),
              })),
            })),
          })),
        })),
      })),
    };

    const service = new RoomService(mockSupabase as any);
    const input: PlayerTurnInput = {
      userId: "user-1",
      characterName: "Торин",
      actionText: "Изменил решение, стреляю из лука",
      submittedAt: 2000,
    };

    await expect(
      service.submitPlayerAction("room-1", "user-1", input)
    ).rejects.toThrow("Сказанного не вернёшь: вы уже отправили действие в этом раунде");
  });
});
```

- [x] **Step 2: Запустить тест и убедиться, что он падает**

Run: `npx vitest run src/app/api/room/__tests__/cooperative-turn.test.ts`  
Expected: FAIL ("Сказанного не вернёшь...")

- [x] **Step 3: Реализовать блокировку в `RoomService.submitPlayerAction`**

В `src/lib/room/room-service.ts`:
Если `activeTurn.playerInputs[userId]` уже существует и не пустой, выбрасывать ошибку:
`throw new Error("Сказанного не вернёшь: вы уже отправили действие в этом раунде");`

- [x] **Step 4: Добавить проверку авто-резолвинга в `POST /api/room/[code]/turn`**

В `src/app/api/room/[code]/turn/route.ts`:
1. После сохранения `submitPlayerAction`:
2. Вызывать `calculateTurnReadiness(room.participants, updatedTurn.playerInputs)`.
3. Если `readiness.isAllReady === true`:
   - Выполнить резолвинг раунда через внутреннюю вспомогательную функцию `resolveActiveRoomTurn(room, updatedTurn)` (объединение `bundleTurnInputs` + вызов `createClient(model)` + `roomService.resolveRoomTurn`).
   - Вернуть `{ success: true, resolved: true, roundNumber: updatedTurn.roundNumber, nextRoundNumber: updatedTurn.roundNumber + 1 }`.
4. Если не все готовы:
   - Вернуть `{ success: true, resolved: false, turn: updatedTurn }`.

- [x] **Step 5: Запустить тест и убедиться, что он проходит**

Run: `npx vitest run src/app/api/room/__tests__/cooperative-turn.test.ts`  
Expected: PASS

- [x] **Step 6: Коммит**

```bash
git add src/lib/room/room-service.ts src/app/api/room/[code]/turn/route.ts src/app/api/room/__tests__/cooperative-turn.test.ts
git commit -m "feat(room): lock turn resubmission and auto-resolve on party readiness"
```

---

### Task 2: Host Force-Resolve — Завершение раунда с AFK-персонажами

**Files:**
- Modify: `src/app/api/room/[code]/turn/resolve/route.ts`
- Test: `src/app/api/room/__tests__/turn-routes.test.ts`

**Interfaces:**
- Consumes: `RoomService.getRoomByCode()`, `RoomService.getActiveTurn()`, `bundleTurnInputs()`
- Produces: `POST /api/room/[code]/turn/resolve` handles missing player actions as `afkCharacters`.

- [x] **Step 1: Написать тест на принудительную отправку с AFK-игроками**

Проверить, что когда хост вызывает `/turn/resolve`, а игрок 2 не сдал заявку, игрок 2 попадает в `afkCharacters` с описанием «В ожидании/защитная стойка».

- [x] **Step 2: Запустить тест и убедиться в поведении**

Run: `npx vitest run src/app/api/room/__tests__/turn-routes.test.ts`

- [x] **Step 3: Обновить логику резолвинга в `resolve/route.ts`**

Автоматически вычислять:
```ts
const activeParticipants = (room.participants || []).filter((p) => Boolean(p.characterSnapshot));
const pending = activeParticipants.filter((p) => !activeTurn.playerInputs[p.userId]);
const afkCharacters = pending.map((p) => ({
  name: p.characterSnapshot?.name || "Герой",
  className: p.characterSnapshot?.className,
}));
```
Передавать `afkCharacters` в `bundleTurnInputs`.

- [x] **Step 4: Запустить тесты vitest**

Run: `npx vitest run src/app/api/room/__tests__/`  
Expected: All PASS

- [x] **Step 5: Коммит**

```bash
git add src/app/api/room/[code]/turn/resolve/route.ts
git commit -m "feat(room): support host force resolve with afk defensive stances"
```

---

### Task 3: Компонент очереди отряда `PartyTurnBar`

**Files:**
- Create: `src/components/room/PartyTurnBar.tsx`
- Test: `src/components/room/__tests__/PartyTurnBar.test.tsx` (или vitest component/smoke test)

**Interfaces:**
- Props:
  ```ts
  export interface PartyTurnBarProps {
    roomTurn: RoomTurn | null;
    participants: RoomParticipant[];
    currentUserId?: string;
    isHost: boolean;
    resolving: boolean;
    onForceResolve?: () => void;
  }
  ```

- [ ] **Step 1: Создать `src/components/room/PartyTurnBar.tsx`**

1. Чистая светлая тема (`bg-card`, `border-border`, `text-foreground`).
2. Строка заголовка: `⚔️ Раунд {roomTurn?.roundNumber || 1} • Заявки отряда ({readyCount}/{totalCount})`.
3. Список участников:
   - Аватар, Имя героя, Класс.
   - Если сдал заявку (`playerInputs[p.userId]`):
     - Зелёный бейдж `Готов 🟢`.
     - Блок с текстом: `«{playerInputs[p.userId].actionText}»` (курсив, мягкий фон `bg-muted/40`).
   - Если не сдал:
     - Серый бейдж `Обдумывает... ⏳`.
4. Индикатор генерации:
   - Если `resolving`: карточка с вращающимся спиннером:
     `✨ Мастер оценивает действия отряда и описывает события мира...`
5. Кнопка Ведущего:
   - Если `isHost && readyCount > 0 && !isAllReady && !resolving`:
     `<Button variant="outline" size="sm" onClick={onForceResolve}><Zap className="size-3.5 mr-1 text-amber-500" />Отправить ход сейчас (пропустить ожидающих)</Button>`.

- [ ] **Step 2: Проверить компиляцию**

Run: `npx tsc --noEmit`  
Expected: 0 errors

- [ ] **Step 3: Коммит**

```bash
git add src/components/room/PartyTurnBar.tsx
git commit -m "feat(room): create PartyTurnBar component for cooperative turns"
```

---

### Task 4: Интеграция пошагового цикла в `DnDApp.tsx`

**Files:**
- Modify: `src/components/dnd/DnDApp.tsx`

**Interfaces:**
- Consumes: `<PartyTurnBar />`, `GET /api/room/[code]/turn`, `POST /api/room/[code]/turn`, `POST /api/room/[code]/turn/resolve`
- Produces: Intercepts chat input in room mode, locks input after submission, polls turn status.

- [ ] **Step 1: Добавить стейт раунда и флаги отправки в `DnDApp.tsx`**

```tsx
const [activeRoomTurn, setActiveRoomTurn] = useState<RoomTurn | null>(null);
const [submittingTurn, setSubmittingTurn] = useState(false);
const [resolvingTurn, setResolvingTurn] = useState(false);
```

- [ ] **Step 2: Добавить поллинг раунда комнаты в интервал**

В существующий `setInterval` (строки ~730-775):
```tsx
if (activeRoom?.code) {
  try {
    const turnRes = await fetch(`/api/room/${encodeURIComponent(activeRoom.code)}/turn`);
    if (turnRes.ok) {
      const turnData = await turnRes.json();
      if (turnData?.turn) {
        setActiveRoomTurn(turnData.turn);
      }
    }
  } catch {}
}
```

- [ ] **Step 3: Реализовать отправку заявки в сетевом режиме**

Функция `handleSendPartyAction()`:
1. Если `activeRoom && activeCampaign`:
   - Найти своего участника `userParticipant` с `characterSnapshot`.
   - Если `userParticipant` уже есть в `activeRoomTurn?.playerInputs`: показать тост `Сказанного не вернёшь: вы уже отправили действие в этом раунде`.
   - Отправить `POST /api/room/[code]/turn` с `{ actionText: input }`.
   - Очистить инпут.
   - Если ответ `{ resolved: true }`: показать тост `Все игроки готовы! Мастер описывает события...`, обновить историю чата.
   - Иначе: показать тост `Заявка принята! Ожидаем остальных игроков отряда...`.

- [ ] **Step 4: Блокировка поля ввода для сдавшего игрока**

Вычислить:
```tsx
const myActionSubmitted = Boolean(
  user?.id && activeRoomTurn?.playerInputs?.[user.id]
);
const myActionText = myActionSubmitted ? activeRoomTurn?.playerInputs?.[user!.id]?.actionText : "";
```
Если `activeRoom && myActionSubmitted`:
Отображать баннер блокировки:
`✅ Ваш ход в раунде {activeRoomTurn?.roundNumber} принят: "{myActionText}". Ожидаем завершения раунда отрядом...`

- [ ] **Step 5: Встроить `<PartyTurnBar>` над формой ввода чата**

Отрисовывать `<PartyTurnBar>` непосредственно перед `<form onSubmit={handleSubmit} ...>` когда `activeRoom` активен.

- [ ] **Step 6: Реализовать функцию `handleForceResolveTurn` для ДМа**

Вызывает `POST /api/room/[code]/turn/resolve`.
Показывает тост `Ход отправлен Мастеру!`.
Сбрасывает стейт и обновляет чат.

- [ ] **Step 7: Проверить компиляцию и линтер**

Run: `npx tsc --noEmit`  
Run: `npx eslint src/components/dnd/DnDApp.tsx`  
Expected: 0 errors

- [ ] **Step 8: Коммит**

```bash
git add src/components/dnd/DnDApp.tsx
git commit -m "feat(room): integrate cooperative turn party bar and input locking in DnDApp"
```

---

### Task 5: Финальная верификация, актуализация графа и публикация в Git

**Files:**
- All touched files

- [ ] **Step 1: Полный запуск компилятора TypeScript**

Run: `npx tsc --noEmit`  
Expected: 0 errors

- [ ] **Step 2: Запуск всех юнит-тестов комнаты**

Run: `npx vitest run src/lib/room/ src/app/api/room/`  
Expected: All tests pass (100%)

- [ ] **Step 3: Проверка ESLint**

Run: `npx eslint src/components/room/PartyTurnBar.tsx src/components/dnd/DnDApp.tsx src/app/api/room/[code]/turn/route.ts`  
Expected: 0 warnings/errors

- [ ] **Step 4: Актуализация графа знаний Graphify**

Run: `graphify update .`

- [ ] **Step 5: Обязательная отправка изменений в Git (GitHub)**

Run: `$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; git add .; git commit -m "feat(room): complete cooperative party turns with input locking and auto-resolve"; git push origin main`

---

## План верификации

### Автоматические тесты
```bash
npx tsc --noEmit
npx vitest run src/lib/room/ src/app/api/room/
npx eslint src/components/room/PartyTurnBar.tsx src/components/dnd/DnDApp.tsx
```

### Ручная проверка (E2E симуляция)
1. Открыть сетевую комнату стола с двумя участниками (Игрок 1 и Игрок 2).
2. Игрок 1 вводит «Осматриваю рубины в саркофаге» и нажимает «Отправить ход»:
   - Инпут Игрока 1 блокируется с зеленой плашкой «Ваш ход принят».
   - У Игрока 2 в панели раунда сразу появляется карточка Игрока 1 с бейджем `Готов 🟢` и текстом его действия.
3. Попытка повторной отправки Игроком 1 отклоняется («Сказанного не вернеш»).
4. Игрок 2 вводит «Прикрываю Торина щитом» и нажимает «Отправить ход»:
   - Срабатывает автоматический старт (100% готовность).
   - Включается индикатор генерации мира.
   - ИИ-Мастер выдает единый ответ, сплетающий оба действия.
   - Раунд переключается на Раунд 2, поля ввода разблокируются.
5. Проверка кнопки ДМа: если Игрок 2 задерживается, ДМ нажимает «Отправить ход сейчас» -> Мастер реагирует, Игрок 2 ставится в защитную стойку.
