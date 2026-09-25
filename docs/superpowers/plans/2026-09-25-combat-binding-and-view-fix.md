# Combat Persistence, API Route and URL Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure tactical combats reliably load on click without "Активного боя нет" errors, players/enemies have all attacks and abilities on the grid, combat is tied to room and campaign, and combat supports direct URL routing (`?view=combat`).

**Architecture:** 
1. Create `src/app/api/combat/[id]/route.ts` with `GET` handler returning hydrated combat with all combatants (attacks, abilities, spells, potions), mapElements, and logs.
2. Update `src/app/api/combat/active/route.ts` to support `roomCode`/`code` lookup fallback.
3. Update `CombatView.tsx` loading logic with fallback from `combatId` to `campaignId`.
4. Update `DnDApp.tsx` with `openCombatView` and `closeCombatView` that synchronize `?view=combat` in URL and auto-open on page refresh.

**Tech Stack:** Next.js 15 App Router, Prisma ORM, TypeScript, React 19, Vitest.

---

### Task 1: Create `src/app/api/combat/[id]/route.ts` with TDD

**Files:**
- Create: `src/app/api/combat/[id]/route.ts`
- Test: `src/app/api/combat/__tests__/combat-id-route.test.ts`

- [ ] **Step 1: Write unit test for GET `/api/combat/[id]`**
Write test asserting that GET `/api/combat/[id]` returns 200 with hydrated combat, combatants, attacks, and abilities, and 404 when combat does not exist.

- [ ] **Step 2: Run test to verify failure (RED)**
Run `npx vitest run src/app/api/combat/__tests__/combat-id-route.test.ts`.

- [ ] **Step 3: Implement `src/app/api/combat/[id]/route.ts`**
Fetch combat by id from `db.combat`, include relations, serialize with `hydrateCombat`.

- [ ] **Step 4: Verify test passes (GREEN)**
Run `npx vitest run src/app/api/combat/__tests__/combat-id-route.test.ts`.

---

### Task 2: CombatView fallback and active combat room resolution

**Files:**
- Modify: `src/components/combat/CombatView.tsx:415-445`
- Modify: `src/app/api/combat/active/route.ts:50-70`

- [ ] **Step 1: Update `src/components/combat/CombatView.tsx`**
Enhance `loadCombat` to try `combatId`, then fall back to `campaignId` if `combatId` fails, preventing the false "Активного боя нет" modal.

- [ ] **Step 2: Update `src/app/api/combat/active/route.ts`**
Support `roomCode` query param to resolve `campaignId` via `RoomService.getRoomByCode`.

- [ ] **Step 3: Verify with existing combat tests**
Run `npx vitest run src/lib/combat/`.

---

### Task 3: URL Synchronization and Direct Battle Link in `DnDApp.tsx`

**Files:**
- Modify: `src/components/dnd/DnDApp.tsx:220-250,2550-2560,3150-3165,3720-3745`

- [ ] **Step 1: Add `openCombatView` and `closeCombatView` helpers**
Sync `?view=combat` to `window.location` using `replaceState`.

- [ ] **Step 2: Add initial URL listener**
Check `?view=combat` on mount and set `showCombatView(true)`.

- [ ] **Step 3: Wire up banner and button clicks**
Connect all combat buttons ("Перейти к сетке боя", "Сетка боя", header "Бой") to `openCombatView`.

---

### Task 4: Verification, Lint & Git Push

- [ ] **Step 1: Type check**
Run `npx tsc --noEmit`.

- [ ] **Step 2: ESLint**
Run `npx eslint` on modified files.

- [ ] **Step 3: Full test suite**
Run `npx vitest run`.

- [ ] **Step 4: Update Graphify**
Run `graphify update .`.

- [ ] **Step 5: Git commit and push**
Clear proxy and push to GitHub `main`.
