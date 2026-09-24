# Multiplayer Network Infrastructure & Gameplay Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate network authorization failures ("Отсутствует заголовок авторизации"), repair guest player campaign/chat history synchronization, and prevent turn resolution race conditions in multiplayer co-op sessions.

**Architecture:**
- **1-Click / Auto Guest Authentication:** Server-side guest token issuance via Supabase Admin (`/api/auth/guest-login`), eliminating unauthenticated drops for players joining via shared room links (`/room/[code]`).
- **Initial Story & Chat Auto-Hydration:** `startRoomCampaign` writes opening narrative to both `db.chatMessage` and initial `room_turns.dm_response`, and `RoomLobby` correctly reads `arc.premise` / `arc.act.summary` (fixing property mismatches with `PartyAwareAct1`).
- **Atomic Concurrency Lock on Turn Resolution:** `lockTurnForResolving` compare-and-swap mechanism in `room-service.ts` to ensure only one concurrent worker triggers AI narrative generation when all party members submit actions.
- **Realtime / Polling Hybrid Fallback:** Ensures `useRoomRealtime` seamlessly receives updates even when Postgres replication or WebSocket drops occur on mobile or restrictive networks.

**Tech Stack:** Next.js 15, TypeScript, Supabase Auth & Realtime, Prisma ORM, Vitest, AI SDK 7.

---

### Task 1: 1-Click Guest Authentication & Client Auth Guard

**Files:**
- Create: `src/app/api/auth/guest-login/route.ts`
- Modify: `src/hooks/useSupabaseAuth.ts`
- Modify: `src/components/room/CharacterPickerModal.tsx`
- Modify: `src/components/dnd/DnDApp.tsx`
- Test: `src/app/api/auth/__tests__/guest-login.test.ts`

- [ ] **Step 1: Write unit test for guest login endpoint**
- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement `/api/auth/guest-login` route using Supabase Admin client**
- [ ] **Step 4: Add `signInAsGuest` to `useSupabaseAuth.ts`**
- [ ] **Step 5: Add auto-guest authentication fallback in `CharacterPickerModal` and `DnDApp`**
- [ ] **Step 6: Run tests and verify they pass**
- [ ] **Step 7: Commit changes**

---

### Task 2: Opening Story & Campaign Chat Synchronization for Guests

**Files:**
- Modify: `src/lib/room/room-service.ts` (`startRoomCampaign`)
- Modify: `src/components/room/RoomLobby.tsx`
- Modify: `src/components/dnd/DnDApp.tsx`
- Test: `src/app/api/room/__tests__/start-campaign.test.ts`

- [ ] **Step 1: Write test verifying opening narrative persistence in `startRoomCampaign`**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Update `startRoomCampaign` in `room-service.ts` to insert opening narrative into `db.chatMessage` and initial `room_turns`**
- [ ] **Step 4: Fix `RoomLobby.tsx` to read `(room.storyArc)?.premise` and `(room.storyArc)?.act?.summary`**
- [ ] **Step 5: Run tests and verify they pass**
- [ ] **Step 6: Commit changes**

---

### Task 3: Atomic Concurrency Lock on Turn Resolution

**Files:**
- Modify: `src/lib/room/room-service.ts` (`lockTurnForResolving`, `unlockTurnFromResolving`)
- Modify: `src/app/api/room/[code]/turn/route.ts`
- Test: `src/lib/room/__tests__/turn-service.test.ts`

- [ ] **Step 1: Write test verifying atomic lock on turn resolution**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement `lockTurnForResolving` and `unlockTurnFromResolving` in `RoomService`**
- [ ] **Step 4: Update `POST /api/room/[code]/turn` to guard AI generation with `lockTurnForResolving`**
- [ ] **Step 5: Run tests and verify they pass**
- [ ] **Step 6: Commit changes**

---

### Task 4: Realtime Reliability & Polling Fallback in `useRoomRealtime`

**Files:**
- Modify: `src/hooks/useRoomRealtime.ts`
- Test: `src/hooks/__tests__/useRoomRealtime.test.ts`

- [ ] **Step 1: Ensure background polling interval keeps lobby and turn status fresh even if Realtime drops**
- [ ] **Step 2: Verify compilation and tests**
- [ ] **Step 3: Commit changes**

---

### Task 5: Full Regression Testing, Graph Update, and Git Push

- [ ] **Step 1: Run full Vitest suite (`npx vitest run`)**
- [ ] **Step 2: Run TypeScript compile check (`npx tsc --noEmit`)**
- [ ] **Step 3: Run `graphify update .`**
- [ ] **Step 4: Git add, commit, and push origin main**
