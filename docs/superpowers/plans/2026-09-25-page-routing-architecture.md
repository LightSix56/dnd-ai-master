# Multi-Page Routing Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decompose the monolithic single-page architecture into distinct, stable Next.js routes (`/` for Home Hub, `/room/[code]` for multiplayer table session, `/campaign/[id]` for solo campaign session, `/home` and `/rooms/[code]` aliases) to eliminate chat auto-scroll collisions and provide a clear player/DM experience.

**Architecture:** Next.js App Router with client-side routing (`next/navigation`). Shared state (auth, API keys, models, active character) lives in Zustand (`useDnDStore`) and `localStorage`. `HomeHubView` provides a stable lobby without chat polling or auto-scrolling; `RoomSessionView` isolates the multiplayer cooperative session (`PartyTurnBar`, round chat, combat grid); `SoloCampaignView` isolates the single-player narrative.

**Tech Stack:** Next.js 14+ App Router, React 18, Zustand, Tailwind CSS, Lucide React, Shadcn UI, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-25-page-routing-architecture-design.md`

## Global Constraints

- Never start long-running dev servers (`next dev` / `next start`).
- All subagents must be invoked strictly on Flash model (`Model: 'flash'`).
- Always clear proxy variables (`$env:HTTPS_PROXY=""; $env:HTTP_PROXY="";`) before running git commands or network tests.
- 100% zero-regression on cooperative party turns, combat actions, potion drinking, and character persistence.
- Zero TypeScript errors (`npx tsc --noEmit`).

---

### Task 1: Route Aliases (`/home` and `/rooms/[code]`)

**Files:**
- Create: `src/app/home/page.tsx`
- Create: `src/app/rooms/[code]/page.tsx`
- Create: `src/app/home/__tests__/redirects.test.tsx`

**Interfaces:**
- Consumes: `next/navigation` (`redirect` or `useRouter`)
- Produces: Seamless URL redirection to `/` and `/room/[code]`

- [ ] **Step 1: Write the failing tests for redirects**
Create `src/app/home/__tests__/redirects.test.tsx` verifying that `/home` redirects to `/` and `/rooms/[code]` redirects to `/room/[code]`.
- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run src/app/home/__tests__/redirects.test.tsx`.
- [ ] **Step 3: Implement `/home` and `/rooms/[code]` pages**
Implement `src/app/home/page.tsx` and `src/app/rooms/[code]/page.tsx`.
- [ ] **Step 4: Run tests to verify passing**
Run `npx vitest run src/app/home/__tests__/redirects.test.tsx`.
- [ ] **Step 5: Commit**
`$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; git add src/app/home/ src/app/rooms/; git commit -m "feat(routes): add /home and /rooms/[code] redirect aliases"`

---

### Task 2: Home Hub View (`src/components/home/HomeHubView.tsx` & `src/app/page.tsx`)

**Files:**
- Create: `src/components/home/HomeHubView.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/components/home/__tests__/HomeHubView.test.tsx`

**Interfaces:**
- Consumes: `useDnDStore`, `useRouter`, `ModelPickerModal`, `CreateRoomModal`, `JoinRoomModal`, `CharacterPickerModal`
- Produces: Stable dashboard component on `/` with zero auto-scroll effects and zero chat polling.

- [ ] **Step 1: Write failing component test for HomeHubView**
Verify rendering of "Присоединиться к столу" (room code input), "Создать сетевой стол", "Мои кампании", "Мои персонажи", and settings trigger without any chat polling or scroll side-effects.
- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run src/components/home/__tests__/HomeHubView.test.tsx`.
- [ ] **Step 3: Implement `HomeHubView.tsx`**
Create clean dashboard layout with Shadcn UI cards, responsive grid, room code input, campaign list, and navigation buttons.
- [ ] **Step 4: Update `src/app/page.tsx`**
Render `<HomeHubView />` on the root route.
- [ ] **Step 5: Run tests to verify passing**
Run `npx vitest run src/components/home/__tests__/HomeHubView.test.tsx`.
- [ ] **Step 6: Commit**
`$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; git add src/components/home/ src/app/page.tsx; git commit -m "feat(home): create stable HomeHubView dashboard on root route"`

---

### Task 3: Dedicated Multiplayer Room Session View (`/room/[code]`)

**Files:**
- Create: `src/components/room/RoomSessionView.tsx`
- Modify: `src/app/room/[code]/page.tsx`
- Create: `src/app/room/__tests__/room-page.test.tsx`

**Interfaces:**
- Consumes: `RoomLobby`, `PartyTurnBar`, `CombatView`, `CharacterCard`, `useDnDStore`, room turn APIs
- Produces: Fully dedicated multiplayer session for table participants without DM setup clutter.

- [ ] **Step 1: Write failing test for RoomSessionView / RoomPage**
Verify that `/room/[code]` parses room code, fetches room data, shows `RoomLobby` when waiting, and shows `PartyTurnBar` + round chat when active.
- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run src/app/room/__tests__/room-page.test.tsx`.
- [ ] **Step 3: Implement `RoomSessionView.tsx` & update `src/app/room/[code]/page.tsx`**
Extract and mount the multiplayer table view, keeping all cooperative turns, dice rolling, combat hotbars, and potion drinking functional.
- [ ] **Step 4: Run tests to verify passing**
Run `npx vitest run src/app/room/__tests__/room-page.test.tsx` and all 13 room test suites.
- [ ] **Step 5: Commit**
`$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; git add src/components/room/ src/app/room/; git commit -m "feat(room): mount dedicated RoomSessionView on /room/[code]"`

---

### Task 4: Dedicated Solo Campaign Session View (`/campaign/[id]`)

**Files:**
- Create: `src/components/campaign/SoloCampaignView.tsx`
- Create: `src/app/campaign/[id]/page.tsx`
- Create: `src/app/campaign/__tests__/campaign-page.test.tsx`

**Interfaces:**
- Consumes: `useDnDStore`, solo chat stream, `CombatView`, `CharacterCard`
- Produces: Dedicated solo session with "👥 Открыть стол для друзей" button to convert into a multiplayer room.

- [ ] **Step 1: Write failing test for SoloCampaignView / CampaignPage**
Verify solo narrative loading and transition button to multiplayer room.
- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run src/app/campaign/__tests__/campaign-page.test.tsx`.
- [ ] **Step 3: Implement `SoloCampaignView.tsx` and `src/app/campaign/[id]/page.tsx`**
Wire solo campaign view with back button to `/` and conversion to `/room/[code]`.
- [ ] **Step 4: Run tests to verify passing**
Run `npx vitest run src/app/campaign/__tests__/campaign-page.test.tsx`.
- [ ] **Step 5: Commit**
`$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; git add src/components/campaign/ src/app/campaign/; git commit -m "feat(campaign): create dedicated solo campaign page /campaign/[id]"`

---

### Task 5: Full Regression, Type Verification & Graphify Update

**Files:**
- Touch: all test suites
- Target: `graphify-out/`

- [ ] **Step 1: Run full Vitest regression**
Run `npx vitest run` across the entire project.
- [ ] **Step 2: Run TypeScript compiler**
Run `npx tsc --noEmit` and confirm 0 errors.
- [ ] **Step 3: Update knowledge graph**
Run `graphify update .`.
- [ ] **Step 4: Git commit and push**
Run `$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; git add .; git commit -m "refactor: complete multi-page routing separation across home, room, and campaign"; git push origin main`.
- [ ] **Step 5: Report to User**
Provide concise summary of the new page structure, URLs, and verified guarantees.
