# Room Streaming, Live Synchronization and Token Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide live DM response streaming to all room participants via Supabase Realtime broadcast, show DM status directly in the chat for everyone, clean up PartyTurnBar, and track/display token usage & cost for room rounds.

**Architecture:** Switch `resolveActiveRoomTurnHelper` to stream generation using `streamText` from `ai`, calculate token usage and cost via `calculateCostRub` and persist `_stats` into `db.chatMessage`. Propagate streaming chunks via Supabase Realtime channel `room:${roomId}` (`dm_stream`). Display dynamic DM status indicator in chat messages for all participants and remove the redundant status banner from PartyTurnBar.

**Tech Stack:** Next.js 15, TypeScript, Supabase Realtime (@supabase/supabase-js), Vercel AI SDK (`ai`), Vitest, Tailwind CSS, Lucide icons, Prisma / SQLite.

**Spec:** [`docs/superpowers/specs/2026-09-25-room-streaming-and-sync-design.md`](file:///c:/antig/battle+ai/docs/superpowers/specs/2026-09-25-room-streaming-and-sync-design.md)

## Global Constraints
- Preserve full backward compatibility with non-streaming and single-player chat (`useChat`).
- Do NOT hammer SQLite or Supabase tables with per-token database writes; use Supabase Realtime Broadcast for ephemeral streaming packets.
- Always sanitize and calculate token cost using `calculateCostRub` from `@/lib/ai/cost`.
- Zero errors in `npx tsc --noEmit` and all Vitest suites must pass.
- Follow anti-slop, clean TypeScript typing, and responsive layout.

---

### Task 1: Подсчёт токенов, стоимости и сохранение `_stats` в `resolve-turn-helper.ts`

**Files:**
- Modify: `src/lib/room/resolve-turn-helper.ts`
- Modify: `src/app/api/room/[code]/turn/resolve/route.ts`
- Test: `src/lib/room/__tests__/room-combat-tool.test.ts`

**Interfaces:**
- Consumes: `calculateCostRub` from `@/lib/ai/cost`, `resolveDmModel` from `@/lib/ai/models`
- Produces: `ResolveActiveRoomTurnResult` with optional `stats: { model: string; usage: any; costRub: number }`

- [ ] **Step 1: Write failing test in `room-combat-tool.test.ts` for stats calculation and persistence**
  Add a test verifying that `resolveActiveRoomTurnHelper` returns token stats and saves `_stats` into `db.chatMessage.create` `toolResults`.
- [ ] **Step 2: Run test to confirm it fails**
  Run `npx vitest run src/lib/room/__tests__/room-combat-tool.test.ts`.
- [ ] **Step 3: Update `resolve-turn-helper.ts`**
  - Extract `usage` from the AI response (`res.usage` or `res.totalUsage`).
  - Calculate `costRub` using `calculateCostRub(aiModel, usage)`.
  - Package `_stats: { model: aiModel, usage, costRub }` into `toolResults` for `db.chatMessage.create`.
  - Return `stats` in `ResolveActiveRoomTurnResult`.
- [ ] **Step 4: Update `/api/room/[code]/turn/resolve/route.ts`**
  - Include `stats: result.stats` in the JSON response.
- [ ] **Step 5: Run tests and verify they pass**
  Run `npx vitest run src/lib/room/__tests__/room-combat-tool.test.ts`.
- [ ] **Step 6: Commit changes**
  `git commit -m "feat(room): compute token usage and cost in room turn resolution"`

---

### Task 2: Потоковый стриминг ответа Мастера в `resolve-turn-helper.ts` и `api/room/[code]/turn/resolve`

**Files:**
- Modify: `src/lib/room/resolve-turn-helper.ts`
- Modify: `src/app/api/room/[code]/turn/resolve/route.ts`

**Interfaces:**
- Consumes: `streamText` from `ai`
- Produces: `onChunk?: (delta: string, fullText: string) => void` and `onStatus?: (status: string) => void` callbacks in options of `resolveActiveRoomTurnHelper`.

- [ ] **Step 1: Add streaming callback support to `ResolveActiveRoomTurnOptions`**
  Define `onChunk?: (chunk: string, accumulated: string) => void` and `onStatus?: (statusText: string) => void`.
- [ ] **Step 2: Implement streaming inside `resolveActiveRoomTurnHelper` using `streamText`**
  - Use `streamText` from `ai` with `tools`, `maxSteps: 3`, `stopWhen: stepCountIs(4)`.
  - Stream chunks via `onChunk`.
  - Extract steps, narrative, usage, and cost on completion.
  - Retain safety fallbacks if stream fails.
- [ ] **Step 3: Support streaming SSE / ReadableStream in `/api/room/[code]/turn/resolve/route.ts` when requested**
  - If request headers or query has `stream=true` (or Accept `text/event-stream`), stream events:
    `event: status`, `event: chunk`, `event: finish`.
  - If standard JSON requested, return final JSON with `dmResponse`, `stats`, `completedTurn`, `nextTurn`.
- [ ] **Step 4: Test turn resolution**
  Run Vitest room tests to ensure backward compatibility and streaming support.
- [ ] **Step 5: Commit changes**
  `git commit -m "feat(room): add streamText support to room turn resolution"`

---

### Task 3: Клиентская подписка на Supabase Realtime `room:${roomId}` (`dm_stream`) и трансляция чанков

**Files:**
- Modify: `src/components/dnd/DnDApp.tsx`

**Interfaces:**
- Consumes: `getSupabaseBrowserClient` from `@/lib/supabase/client`
- Produces: `streamingDmText: string | null`, `dmStatusText: string | null` state in `DnDApp.tsx`

- [ ] **Step 1: Setup Supabase Realtime channel in `DnDApp.tsx` for `activeRoom.id`**
  - Subscribe to `room:${activeRoom.id}` via `getSupabaseBrowserClient()`.
  - Listen to `broadcast` event `dm_stream`:
    - `type === "status"`: set `dmStatusText`.
    - `type === "chunk"`: set `streamingDmText(payload.text)`.
    - `type === "finish"`: update messages with final text and metadata (`_stats`), clear `streamingDmText` and `dmStatusText`, update `campaignStats`.
- [ ] **Step 2: When initiating turn resolution on client, stream and broadcast to room channel**
  - In `handleForceResolveTurn` and `submitPlayerAction` (when `resolved` is triggered):
    - Consume the streaming response.
    - As chunks arrive, call `channel.send({ type: "broadcast", event: "dm_stream", payload: { type: "chunk", text: accumulated, round: roundNumber } })`.
    - On finish, send `finish` event with `stats`.
- [ ] **Step 3: Commit changes**
  `git commit -m "feat(room): real-time broadcast of streaming DM chunks across participants"`

---

### Task 4: Перенос статуса Мастера в чат и очистка `PartyTurnBar.tsx`

**Files:**
- Modify: `src/components/dnd/DnDApp.tsx`
- Modify: `src/components/room/PartyTurnBar.tsx`

**Interfaces:**
- Consumes: `streamingDmText`, `dmStatusText`, `resolvingTurn`, `activeRoomTurn?.status === "resolving"`
- Produces: Unified chat message bubble & animated status indicator inside `ScrollArea` before `messagesEndRef`.

- [ ] **Step 1: In `DnDApp.tsx`, render live DM status & streaming bubble inside the chat message list**
  - Show the status indicator inside the chat scroll area when `isLoading || resolvingTurn || activeRoomTurn?.status === "resolving" || streamingDmText`.
  - If `streamingDmText` is present, render `MessageBubble` with role `"assistant"` and streaming content.
  - If text has not started streaming yet, render animated status:
    `🎲 {dmStatusText || "Мастер оценивает действия отряда и описывает события мира..."}`.
- [ ] **Step 2: In `PartyTurnBar.tsx`, remove the duplicate yellow banner**
  - Remove `{resolving && (<div ...>✨ Мастер оценивает действия отряда...</div>)}` from `CardContent`.
  - Keep readiness grid and action buttons intact.
- [ ] **Step 3: In `DnDApp.tsx`, update `setCampaignStats` on room turn resolution**
  - Add `stats.usage.totalTokens`, `stats.costRub`, etc. to `campaignStats` so the token counter in the top bar accurately reflects multiplayer rounds.
- [ ] **Step 4: Commit changes**
  `git commit -m "refactor(ui): move DM status and live response to chat message list"`

---

### Task 5: Полная верификация, сборка и Git Push

**Files:**
- All touched files

- [ ] **Step 1: Run TypeScript check**
  `npx tsc --noEmit` — must be 0 errors.
- [ ] **Step 2: Run ESLint**
  `npx eslint .` — must be 0 errors.
- [ ] **Step 3: Run Vitest suites**
  `npm run test` or `npx vitest run` — all tests must pass.
- [ ] **Step 4: Update Graphify**
  `graphify update .`
- [ ] **Step 5: Git commit and push**
  `$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; git add .; git commit -m "..."; git push origin main`
