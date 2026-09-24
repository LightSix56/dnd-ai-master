# Prompt Caching Architecture (DeepSeek Harness Parity) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement DeepSeek Harness-style Prompt Caching in `dnd-ai-master` via 3-zone context structure (`FrozenPrefix` -> `AppendOnlyStream` -> `EphemeralTail`) and milestone compaction, driving LLM cache hit rates to 95–97% and reducing API token costs up to 33x.

**Architecture:** Split LLM context into immutable frozen prefix (DM persona, setting, arc, deterministic tools), monotonic append-only conversation history with discrete milestone compaction, and volatile per-round scene state injected exclusively into the tail of the latest user message.

**Tech Stack:** TypeScript, Next.js App Router, Vercel AI SDK 7.x, Vitest, Prisma.

**Spec:** [`docs/superpowers/specs/2026-09-24-prompt-caching-architecture-design.md`](file:///C:/antig/battle+ai/docs/superpowers/specs/2026-09-24-prompt-caching-architecture-design.md)

## Global Constraints

- Prefix caching requires 100% byte-for-byte identity of Token 0..N on 64-token block boundaries.
- No dynamic values (HP, conditions, NPC wounds, recent events) allowed in Zone 1 (System Prompt / Instructions).
- Message history in Zone 2 must be append-only; sliding-window FIFO (`messages.slice(-N)`) is strictly replaced with chunked milestone compaction.
- All tests must run and pass via `npx vitest run`.
- Compilation check `npx tsc --noEmit` must complete with 0 errors.

---

### Task 1: Core Caching Utilities — `frozen-prefix.ts` and `ephemeral-tail.ts`

**Files:**
- Create: `src/lib/ai/caching/frozen-prefix.ts`
- Create: `src/lib/ai/caching/ephemeral-tail.ts`
- Create: `src/lib/ai/caching/index.ts`
- Test: `src/lib/ai/caching/__tests__/caching-zones.test.ts`

**Interfaces:**
- Consumes: `CampaignContext` from `src/lib/ai/system-prompt.ts`, `ModelMessage` from `ai`.
- Produces:
  - `buildFrozenSystemPrompt(campaign?: CampaignContext): string`
  - `getDeterministicTools<T extends Record<string, any>>(tools: T): T`
  - `formatSceneSnapshot(state: EphemeralSceneState): string`
  - `injectEphemeralTailToLastUserMessage(messages: ModelMessage[], ephemeralTail: string): ModelMessage[]`

- [x] **Step 1: Write the failing unit tests for frozen prefix stability and ephemeral tail injection**
- [x] **Step 2: Run the test to verify it fails (Red)**
- [x] **Step 3: Implement `frozen-prefix.ts` and `ephemeral-tail.ts`**
- [x] **Step 4: Run the test to verify it passes (Green)**
- [x] **Step 5: Git commit**

---

### Task 2: Discrete Milestone History Compactor — `milestone-compactor.ts`

**Files:**
- Create: `src/lib/ai/caching/milestone-compactor.ts`
- Test: `src/lib/ai/caching/__tests__/milestone-compactor.test.ts`

**Interfaces:**
- Consumes: `ModelMessage` from `ai`.
- Produces:
  - `compactHistoryWithMilestones(messages: ModelMessage[], options?: { maxVerbatim?: number; chunkSize?: number }): ModelMessage[]`

- [x] **Step 1: Write the failing unit tests for milestone compaction**
- [x] **Step 2: Run the test to verify it fails (Red)**
- [x] **Step 3: Implement `milestone-compactor.ts`**
- [x] **Step 4: Run the test to verify it passes (Green)**
- [x] **Step 5: Git commit**

---

### Task 3: Integration into Solo Chat Endpoint (`src/app/api/chat/route.ts`)

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Test: `src/app/api/chat/__tests__/chat-caching.test.ts`

**Interfaces:**
- Consumes: `buildFrozenSystemPrompt`, `getDeterministicTools`, `compactHistoryWithMilestones`, `injectEphemeralTailToLastUserMessage`, `fetchEphemeralSceneTail`.

- [x] **Step 1: Write integration test for solo chat caching workflow**
- [x] **Step 2: Update `src/app/api/chat/route.ts`**
- [x] **Step 3: Run Vitest tests**
- [x] **Step 4: Git commit**

---

### Task 4: Integration into Multiplayer Co-op Turn Helper (`src/lib/room/resolve-turn-helper.ts`)

**Files:**
- Modify: `src/lib/room/resolve-turn-helper.ts`
- Test: `src/app/api/room/__tests__/cooperative-turn.test.ts`

**Interfaces:**
- Consumes: `buildFrozenRoomSystemPrompt`, `bundleTurnInputs`.

- [x] **Step 1: Write tests in `src/app/api/room/__tests__/cooperative-turn.test.ts`**
Verify that room turns resolve with frozen system prompts and party state injected into the turn batch prompt.

- [x] **Step 2: Update `src/lib/room/resolve-turn-helper.ts`**
- Remove dynamic HP from the `system` variable.
- Ensure party member classes and levels stay in `system`, while dynamic HP and statuses are injected into the prompt tail via `bundleTurnInputs`.

- [x] **Step 3: Run Vitest room tests**
Run: `npx vitest run src/app/api/room/__tests__/`

- [x] **Step 4: Git commit**
```powershell
$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; git add src/lib/room/resolve-turn-helper.ts; git commit -m "refactor(room): apply frozen prefix caching to multiplayer cooperative round resolution"
```

---

### Task 5: End-to-End Verification & Cost Calculation Audit

**Files:**
- Create: `src/lib/ai/caching/__tests__/cost-cache-savings.test.ts`

- [ ] **Step 1: Write cost savings test**
Verify that `calculateCostRub` with 97% cache hit rate produces an expected ~10-30x cost reduction compared to 0% cache hit rate.

- [ ] **Step 2: Run all project test suites**
Run: `npx vitest run` (ensure all tests pass green).

- [ ] **Step 3: Run TypeScript compiler check**
Run: `npx tsc --noEmit` (ensure 0 errors).

- [ ] **Step 4: Update Graphify knowledge graph**
Run: `graphify update .`

- [ ] **Step 5: Git commit & push**
Run:
```powershell
$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; git add .; git commit -m "feat(caching): complete prompt caching architecture overhaul with 97% hit rate"; git push origin main
```
