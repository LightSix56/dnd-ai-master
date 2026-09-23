# Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. All subagents MUST run on model Flash (`Model: 'flash'`).

**Goal:** Реализовать использование зелий и расходников прямо из инвентаря в тактическом бою (`Hotbar.tsx`) со стоимостью в 1 Бонусное действие, а также окно инвентаря персонажа в кампании (`CharacterCard.tsx`) с возможностью употребления зелий вне боя и синхронизацией с базой данных.

**Architecture:**
- БД/Спецификация: поле `potions` у `Combatant` в Prisma и типах TypeScript.
- Бэкенд: экшен `drink-potion` в `POST /api/combat/action` (проверка бонусного действия, расчет лечения/баффа, списание зелья, лог боя, синхронизация с `Character.inventory`).
- UI Боя: иконка рюкзака `[🎒]` в хотбаре со счетчиком, меню зелий (Popover) и вкладка зелий. Блокировка кнопки, если бонусное действие уже потрачено.
- UI Кампании: кнопка рюкзака на карточке персонажа, открывающая модальное окно `CharacterInventoryModal` с вкладками зелий и снаряжения.

**Tech Stack:** Next.js, React 19, TypeScript, Tailwind CSS, Radix UI, Prisma (SQLite), Lucide Icons.
**Spec:** `C:\antig\battle+ai\docs\superpowers\specs\2026-09-23-battle-ai-inventory-potions-design.md`

## Global Constraints
- Использование зелья в бою — **СТРОГО БОНУСНОЕ ДЕЙСТВИЕ** (`bonusActionUsed: true`). Если потрачено, блокировать с подсказкой.
- При употреблении зелья вне боя в кампании обновлять `hpCurrent` и `inventory` через `PATCH /api/character`.
- Модель для всех субагентов — строго `Model: 'flash'`.
- Обязательный запуск `graphify update .` после завершения.
- Обязательный git commit и push с очисткой переменных `$env:HTTPS_PROXY=""; $env:HTTP_PROXY="";`.

---

### Task 1: Backend Data Model & Combat Engine Potion Support
**Files:**
- Modify: `C:\antig\battle+ai\prisma\schema.prisma`
- Modify: `C:\antig\battle+ai\src\lib\combat\types.ts`
- Modify: `C:\antig\battle+ai\BATTLE\src\lib\combat\types.ts`
- Modify: `C:\antig\battle+ai\src\lib\combat\serialize.ts`
- Modify: `C:\antig\battle+ai\src\app\api\character\route.ts`
- Modify: `C:\antig\battle+ai\src\lib\combat\generator.ts`
- Modify: `C:\antig\battle+ai\src\app\api\combat\action\route.ts`
- Create test: `C:\antig\battle+ai\scratch\test-potion-action.ts`

**Interfaces:**
- `CombatPotion`: `{ id: string; name: string; nameEn?: string; type: 'heal' | 'buff' | 'utility'; quantity: number; formula?: string; tempHp?: number; buffEffect?: string; description: string; rarity?: string; actionCost: 'bonus_action'; }`
- `Combatant.potions?: CombatPotion[]`
- Action: `POST /api/combat/action` `{ action: 'drink-potion', combatId, combatantId, potionId }`

- [ ] **Step 1:** Обновить `prisma/schema.prisma` (добавить `potions String @default("[]")` в модель `Combatant`) и применить `npx prisma db push --accept-data-loss` + `npx prisma generate`.
- [ ] **Step 2:** Добавить интерфейс `CombatPotion` и поле `potions` в `src/lib/combat/types.ts` и `BATTLE/src/lib/combat/types.ts`.
- [ ] **Step 3:** Обновить `src/lib/combat/serialize.ts` (`hydrateCombatant` парсит `row.potions`, `dehydrateCombatant` сериализует `c.potions`).
- [ ] **Step 4:** Обновить `PATCH /api/character` в `src/app/api/character/route.ts` для сохранения `inventory` и `hpTemp`.
- [ ] **Step 5:** В `src/lib/combat/generator.ts` переносить зелья из `char.inventory` в `combatant.potions` (или давать дефолтные зелья лечения, если пусто).
- [ ] **Step 6:** В `src/app/api/combat/action/route.ts` реализовать обработку `drink-potion` с валидацией `bonusActionUsed`, броском лечения, списанием зелья, логом и сохранением.
- [ ] **Step 7:** Написать и прогнать скрипт верификации `scratch/test-potion-action.ts`.

---

### Task 2: Combat Hotbar & CombatView UI Integration
**Files:**
- Modify: `C:\antig\battle+ai\src\components\combat\Hotbar.tsx`
- Modify: `C:\antig\battle+ai\src\components\combat\CombatView.tsx`
- Sync: `C:\antig\battle+ai\BATTLE\src\components\combat\Hotbar.tsx`

**Interfaces:**
- `HotbarProps` получает `onDrinkPotion?: (potionId: string) => void`
- Индикатор зелий в верхней панели хотбара + всплывающее меню (Popover) + вкладка `🎒 Зелья` в режиме вкладок.
- Кнопка «Выпить» блокируется с понятным сообщением при `combatant.bonusActionUsed === true` или `!isMyTurn`.

- [ ] **Step 1:** В `Hotbar.tsx` добавить иконку рюкзака `[🎒 Рюкзак]` в верхней панели рядом с ресурсами с бейджем количества зелий.
- [ ] **Step 2:** Реализовать всплывающее меню `Popover` со списком доступных зелий, их описанием, типом и кнопкой «Выпить (Бонусное действие)».
- [ ] **Step 3:** Добавить вкладку `🎒 Зелья` в список вкладок хотбара со списком карточек зелий.
- [ ] **Step 4:** В `CombatView.tsx` подключить вызов `doAction('drink-potion', { combatantId: currentCombatant.id, potionId })`.
- [ ] **Step 5:** Проверить анимацию лечения и всплывающее сообщение `toast.success` при употреблении.

---

### Task 3: Campaign Character Card & Inventory Modal
**Files:**
- Create: `C:\antig\battle+ai\src\components\dnd\CharacterInventoryModal.tsx`
- Modify: `C:\antig\battle+ai\src\components\dnd\CharacterCard.tsx`

**Interfaces:**
- `CharacterInventoryModal`: `open: boolean`, `onOpenChange: (open: boolean) => void`, `character: Character`, `onUpdateCharacter?: (updated: Character) => void`
- Вкладки: «Зелья и расходники», «Снаряжение и наборы»
- Кнопка «Выпить» вне боя: восстанавливает HP до максимума, списывает 1 шт., вызывает `PATCH /api/character`, отправляет `BroadcastChannel` событие.

- [ ] **Step 1:** Создать компонент `CharacterInventoryModal.tsx` с дизайном в стиле карточек персонажей (тёплая средневековая стилизация под Tailwind темы проекта).
- [ ] **Step 2:** Реализовать парсер инвентаря и зелий из `character.inventory`.
- [ ] **Step 3:** Добавить кнопки «Выпить» для зелий лечения и баффов с немедленным пересчетом хитов и сохранением через `PATCH /api/character`.
- [ ] **Step 4:** В `CharacterCard.tsx` добавить кнопку рюкзака `[🎒]` в шапку карточки для персонажей игроков, открывающую данный модал.
- [ ] **Step 5:** Добавить отправку `BroadcastChannel('dnd5e_character_sync')` при изменениях инвентаря и HP.

---

### Task 4: Full Verification, Graphify & Git Delivery
- [ ] **Step 1:** Запустить `npx tsc --noEmit` в `C:\antig\battle+ai` и убедиться в 0 ошибок типов.
- [ ] **Step 2:** Запустить `npx tsc --noEmit` в `c:\antig\dnd5e-character-sheet`.
- [ ] **Step 3:** Запустить `graphify update .` в `C:\antig\battle+ai` и `c:\antig\dnd5e-character-sheet`.
- [ ] **Step 4:** Зафиксировать все изменения в Git и отправить в `origin main` с очисткой прокси (`$env:HTTPS_PROXY=""; $env:HTTP_PROXY="";`).
