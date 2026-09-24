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

- [ ] **Step 1: Write the failing unit tests for frozen prefix stability and ephemeral tail injection**

```ts
// src/lib/ai/caching/__tests__/caching-zones.test.ts
import { describe, it, expect } from "vitest";
import { buildFrozenSystemPrompt, getDeterministicTools } from "../frozen-prefix";
import { formatSceneSnapshot, injectEphemeralTailToLastUserMessage } from "../ephemeral-tail";

describe("Caching Zones - Frozen Prefix", () => {
  it("produces byte-for-byte identical prompt regardless of volatile character HP or wounds", () => {
    const baseContext = {
      name: "Тестовая кампания",
      setting: "Забытые Королевства",
      tone: "heroic",
      partyMembers: [
        { id: "1", name: "Торгрим", race: "Дворф", class: "Жрец", level: 3 },
      ],
    };

    const prompt1 = buildFrozenSystemPrompt(baseContext);
    const prompt2 = buildFrozenSystemPrompt(baseContext);
    expect(prompt1).toBe(prompt2);
    expect(prompt1).not.toContain("HP");
    expect(prompt1).not.toContain("хитов");
  });

  it("sorts tool keys deterministically in lexicographical order", () => {
    const rawTools = {
      roll_dice: { name: "roll_dice" },
      calculate: { name: "calculate" },
      search_web: { name: "search_web" },
      fetch_page: { name: "fetch_page" },
    };
    const sorted = getDeterministicTools(rawTools);
    expect(Object.keys(sorted)).toEqual(["calculate", "fetch_page", "roll_dice", "search_web"]);
  });
});

describe("Caching Zones - Ephemeral Tail Injection", () => {
  it("injects ephemeral scene state into the last user message without altering previous messages", () => {
    const history = [
      { role: "user", content: "Привет, мастер" },
      { role: "assistant", content: "Приветствую, герой" },
      { role: "user", content: "Иду к северным воротам" },
    ];

    const tail = "[СЦЕНА: Торгрим HP 14/20]";
    const updated = injectEphemeralTailToLastUserMessage(history as any, tail);

    expect(updated[0]).toBe(history[0]);
    expect(updated[1]).toBe(history[1]);
    expect(updated[2].content).toContain("Иду к северным воротам");
    expect(updated[2].content).toContain(tail);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (Red)**
Run: `npx vitest run src/lib/ai/caching/__tests__/caching-zones.test.ts`

- [ ] **Step 3: Implement `frozen-prefix.ts` and `ephemeral-tail.ts`**
Implement the functions with clean separation:
- `buildFrozenSystemPrompt` extracts immutable lore, rules, and static background without any dynamic stats.
- `getDeterministicTools` sorts dictionary keys.
- `injectEphemeralTailToLastUserMessage` appends the scene block strictly to the last user message.

- [ ] **Step 4: Run the test to verify it passes (Green)**
Run: `npx vitest run src/lib/ai/caching/__tests__/caching-zones.test.ts`

- [ ] **Step 5: Git commit**
```powershell
$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; git add src/lib/ai/caching/; git commit -m "feat(caching): add frozen prefix and ephemeral tail injection modules"
```

---

### Task 2: Discrete Milestone History Compactor — `milestone-compactor.ts`

**Files:**
- Create: `src/lib/ai/caching/milestone-compactor.ts`
- Test: `src/lib/ai/caching/__tests__/milestone-compactor.test.ts`

**Interfaces:**
- Consumes: `ModelMessage` from `ai`.
- Produces:
  - `compactHistoryWithMilestones(messages: ModelMessage[], options?: { maxVerbatim?: number; chunkSize?: number }): ModelMessage[]`

- [ ] **Step 1: Write the failing unit tests for milestone compaction**

```ts
// src/lib/ai/caching/__tests__/milestone-compactor.test.ts
import { describe, it, expect } from "vitest";
import { compactHistoryWithMilestones } from "../milestone-compactor";

describe("Milestone History Compactor", () => {
  it("keeps history strictly append-only when below the verbatim threshold", () => {
    const messages = Array.from({ length: 15 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i + 1}`,
    }));

    const result = compactHistoryWithMilestones(messages as any, { maxVerbatim: 20 });
    expect(result.length).toBe(15);
    expect(result).toEqual(messages);
  });

  it("compacts the oldest chunk into a single milestone when threshold is exceeded", () => {
    const messages = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `Message ${i + 1}`,
    }));

    const result = compactHistoryWithMilestones(messages as any, {
      maxVerbatim: 20,
      chunkSize: 10,
    });

    // 10 messages compressed into 1 milestone summary + 15 remaining = 16 messages
    expect(result.length).toBe(16);
    expect(result[0].role).toBe("user");
    expect(result[0].content).toContain("[ХРОНИКА РАННИХ СОБЫТИЙ");
    expect(result[1].content).toBe("Message 11");
    expect(result[result.length - 1].content).toBe("Message 25");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (Red)**
Run: `npx vitest run src/lib/ai/caching/__tests__/milestone-compactor.test.ts`

- [ ] **Step 3: Implement `milestone-compactor.ts`**
Implement compaction logic:
- Check `messages.length <= maxVerbatim`.
- If exceeded, group the oldest `chunkSize` messages into a structured bulleted chronicle milestone and keep the rest intact.

- [ ] **Step 4: Run the test to verify it passes (Green)**
Run: `npx vitest run src/lib/ai/caching/__tests__/milestone-compactor.test.ts`

- [ ] **Step 5: Git commit**
```powershell
$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; git add src/lib/ai/caching/milestone-compactor.ts src/lib/ai/caching/__tests__/milestone-compactor.test.ts; git commit -m "feat(caching): add discrete milestone history compactor"
```

---

### Task 3: Integration into Solo Chat Endpoint (`src/app/api/chat/route.ts`)

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Test: `src/app/api/chat/__tests__/chat-caching.test.ts`

**Interfaces:**
- Consumes: `buildFrozenSystemPrompt`, `getDeterministicTools`, `compactHistoryWithMilestones`, `injectEphemeralTailToLastUserMessage`, `fetchEphemeralSceneTail`.

- [ ] **Step 1: Write integration test for solo chat caching workflow**
Verify that `instructions` is strictly frozen, `modelMessages` has milestone compaction, and the last user message includes the ephemeral scene block.

- [ ] **Step 2: Update `src/app/api/chat/route.ts`**
- Replace `const systemPrompt = buildSystemPrompt(campaignContext);` with `buildFrozenSystemPrompt(campaignContext);`.
- Remove `contextInstructions` from `instructions`! `instructions` contains only `{ role: "system", content: frozenSystemPrompt }`.
- Replace `allModelMessages.slice(-VERBATIM_MESSAGES)` with `compactHistoryWithMilestones(allModelMessages)`.
- Fetch `ephemeralTail` via `fetchEphemeralSceneTail(activeCampaignId)` and call `injectEphemeralTailToLastUserMessage(compactedMessages, ephemeralTail)`.
- Pass `getDeterministicTools(activeTools)` to `streamText`.

- [ ] **Step 3: Run Vitest tests**
Run: `npx vitest run`

- [ ] **Step 4: Git commit**
```powershell
$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""; git add src/app/api/chat/route.ts src/app/api/chat/__tests__/; git commit -m "refactor(chat): wire 3-zone prompt caching architecture into solo chat endpoint"
```

---

### Task 4: Integration into Multiplayer Co-op Turn Helper (`src/lib/room/resolve-turn-helper.ts`)

**Files:**
- Modify: `src/lib/room/resolve-turn-helper.ts`
- Test: `src/app/api/room/__tests__/cooperative-turn.test.ts`

**Interfaces:**
- Consumes: `buildFrozenRoomSystemPrompt`, `bundleTurnInputs`.

- [ ] **Step 1: Write tests in `src/app/api/room/__tests__/cooperative-turn.test.ts`**
Verify that room turns resolve with frozen system prompts and party state injected into the turn batch prompt.

- [ ] **Step 2: Update `src/lib/room/resolve-turn-helper.ts`**
- Remove dynamic HP from the `system` variable.
- Ensure party member classes and levels stay in `system`, while dynamic HP and statuses are injected into the prompt tail via `bundleTurnInputs`.

- [ ] **Step 3: Run Vitest room tests**
Run: `npx vitest run src/app/api/room/__tests__/`

- [ ] **Step 4: Git commit**
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
