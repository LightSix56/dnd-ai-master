# Prompt Cache Telemetry & Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide 100% transparent prompt cache telemetry by always displaying cache stats under assistant messages, adding a header shortcut to `CostStatsModal`, and normalizing cache token extraction across all AI providers.

**Architecture:** Create robust helper functions `extractCachedTokens` and `extractTokenUsage` in `src/lib/ai/cost.ts` to normalize token usage across AI SDK, OpenAI camelCase, and OpenAI snake_case payloads. Use this helper in `/api/chat` and `/api/room/[code]/turn/resolve`. Always display cache status (`(кеш: X)` when > 0 and `(кеш: 0)` when 0) in `MessageBubble`. Add a persistent cost and cache badge button in the top header that triggers `CostStatsModal`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Lucide icons, Vitest.

---

### Task 1: Prompt cache extraction helper with TDD (`src/lib/ai/cost.ts`)

**Files:**
- Modify: `src/lib/ai/cost.ts`
- Test: `src/lib/ai/__tests__/cost.test.ts`

- [ ] **Step 1: Write the failing unit test**
Create `src/lib/ai/__tests__/cost.test.ts` testing `extractCachedTokens` and `extractTokenUsage` with various provider formats (AI SDK `inputTokenDetails.cacheReadTokens`, OpenAI `prompt_tokens_details.cached_tokens`, OpenAI camelCase `promptTokensDetails.cachedTokens`, and direct `cachedTokens`).

- [ ] **Step 2: Run test to verify failure**
Run `npx vitest run src/lib/ai/__tests__/cost.test.ts` and confirm failure.

- [ ] **Step 3: Implement extraction helpers in `src/lib/ai/cost.ts`**
Implement `extractCachedTokens` and `extractTokenUsage`.

- [ ] **Step 4: Verify test passes**
Run `npx vitest run src/lib/ai/__tests__/cost.test.ts` to confirm 100% pass.

---

### Task 2: Integrate robust token extraction in API routes

**Files:**
- Modify: `src/app/api/chat/route.ts:265-280,425-450`
- Modify: `src/lib/room/resolve-turn-helper.ts:255-275,300-325`

- [ ] **Step 1: Update `src/app/api/chat/route.ts`**
Use `extractTokenUsage` in both non-streaming and streaming `messageMetadata` finish handlers.

- [ ] **Step 2: Update `src/lib/room/resolve-turn-helper.ts`**
Use `extractTokenUsage` in both `streamText` and `generateText` resolution branches.

- [ ] **Step 3: Verify existing tests pass**
Run `npx vitest run src/lib/room/__tests__/room-combat-tool.test.ts`.

---

### Task 3: UI Transparency in `MessageBubble` & Header Trigger (`DnDApp.tsx`)

**Files:**
- Modify: `src/components/dnd/DnDApp.tsx` (Header & `MessageBubble`)

- [ ] **Step 1: Always show cache status in `MessageBubble`**
Update `MessageBubble` in `DnDApp.tsx:4150-4165` to show `(кеш: {formatTokens(metadata.usage.cachedTokens)})` in green when > 0, and `(кеш: 0)` in muted text when 0.

- [ ] **Step 2: Add header badge button for `CostStatsModal`**
In the top navigation bar of `DnDApp.tsx` (near «Настройки»), add a button displaying `~{formatRubles(campaignStats.totalCostRub)}` with a cache hit badge (e.g. `кеш 84%`), which calls `setShowCostModal(true)`.

- [ ] **Step 3: Verify compilation & linting**
Run `npx tsc --noEmit` and ensure 0 TypeScript errors.

---

### Task 4: Full Verification, Graphify & Git Push

- [ ] **Step 1: Run full Vitest test suite**
Run `npm run test` (or `npx vitest run`) and confirm all tests pass.

- [ ] **Step 2: Run ESLint**
Run `npx eslint .` to ensure 0 lint errors.

- [ ] **Step 3: Update knowledge graph**
Run `graphify update .`.

- [ ] **Step 4: Git commit and push**
Clear proxy and execute `git add .`, `git commit -m "feat(ai): transparent prompt cache telemetry and cost stats modal trigger"`, and `git push origin main`.
