# Security Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate authentication/authorization bypasses, cross-combat IDORs, SSRF vectors, `eval()`-based XSS, replay side-effect bugs, and insecure defaults across `dnd-ai-master`.

**Architecture:** Introduce `src/lib/security/ssrf.ts` for strict public-HTTPS URL + DNS/IP + redirect validation and `src/lib/security/errors.ts` for production-safe error serialization. Tighten `supabase/client.ts`, `campaign-access.ts`, and `combat-access.ts` to fail closed. Apply route-level auth, ownership, and IDOR checks across all combat, room, campaign, library, preset, chat, and auth endpoints, remove `eval()` in `PresetsModal.tsx`, add security headers in `next.config.ts`, and update legacy unauthenticated tests.

**Tech Stack:** Next.js 16 App Router, TypeScript 5, Prisma, Supabase, Vitest, Node `node:dns/promises` / `node:net` / `node:crypto`.

**Spec:** `docs/superpowers/specs/2026-11-25-security-hardening-design.md`

## Global Constraints

- Strict fail-closed authorization everywhere (`userId === null` campaigns and `campaignId === null` combats are inaccessible to anonymous requests).
- SSRF protection allows public `https://` domains only, blocking private/loopback/link-local/CGNAT/reserved IPv4 & IPv6 addresses both before connect (DNS lookup) and across redirects.
- Zero `eval()` in client or server code.
- No external DB writes inside replayable combat actions before `saveState` succeeds.
- Never run `git push` without explicit user permission.

---

### Task 1: SSRF Protection & URL Validation (`src/lib/security/ssrf.ts`)

**Files:**
- Create: `src/lib/security/ssrf.ts`
- Modify: `src/lib/ai/client.ts`
- Modify: `src/app/api/test-key/route.ts`
- Modify: `src/app/api/models/route.ts`
- Modify: `src/lib/dnd/search.ts`
- Modify: `src/app/api/character/import/route.ts`
- Test: `src/lib/security/__tests__/ssrf.test.ts`

- [ ] **Step 1 (RED):** Write failing tests in `src/lib/security/__tests__/ssrf.test.ts` verifying:
  - Rejects `http://`, `file://`, `ftp://`, URLs with `username:password@`, `localhost`, `127.0.0.1`, `169.254.169.254`, `10.0.0.1`, `192.168.1.1`, `[::1]`, `[fe80::1]`, `[::ffff:127.0.0.1]`.
  - Rejects hostnames whose DNS lookup resolves to a private/loopback/link-local IP.
  - Rejects redirects pointing to private/internal targets in `safeFetch`.
  - Allows public `https://polza.ai/api/v1` resolving to a public IP (e.g. `1.1.1.1`).
- [ ] **Step 2 (Verify RED):** Run `npx vitest run src/lib/security/__tests__/ssrf.test.ts`.
- [ ] **Step 3 (GREEN):** Implement `isForbiddenIp`, `assertSafePublicHttpsUrl`, and `safeFetch` in `src/lib/security/ssrf.ts`. Wire `assertSafePublicHttpsUrl` / `safeFetch` into `src/lib/ai/client.ts`, `src/app/api/test-key/route.ts`, `src/app/api/models/route.ts`, `src/lib/dnd/search.ts` (`fetchPageText`), and add strict `shareCode` validation (`[A-Za-z0-9_-]{4,128}`) in `src/app/api/character/import/route.ts`.
- [ ] **Step 4 (Verify GREEN):** Run `npx vitest run src/lib/security/__tests__/ssrf.test.ts`.

---

### Task 2: Fail-Closed Auth & Access Core (`supabase/client`, `campaign-access`, `combat-access`)

**Files:**
- Modify: `src/lib/supabase/client.ts`
- Modify: `src/lib/auth/campaign-access.ts`
- Modify: `src/lib/room/combat-access.ts`
- Test: `src/lib/auth/__tests__/access-control.test.ts`

- [ ] **Step 1 (RED):** Write failing tests in `src/lib/auth/__tests__/access-control.test.ts`:
  - `getSupabaseAdminClient()` throws when `SUPABASE_SERVICE_ROLE_KEY` is empty/unset (with env restored after test).
  - `checkCampaignAccess` returns `401` when no token/user, `403` when `campaignId` is null/empty, `403` when campaign has `userId: null`.
  - `denyCombatAccess` returns `401` for anonymous requests on combats with `campaignId: null` or `campaign.userId: null`.
  - `checkCombatControl` denies requests without `userId`, denies on internal error (fail-closed), and restricts `apply-damage`, `apply-healing`, `update-combatant`, `update-resources`, `reset-turn`, `end-combat`, `delete-combat`, `add-element`, `remove-element`, `resize-grid`, `expand-grid-direction`, `roll-initiative`, `set-initiative` to room host in multiplayer rooms.
- [ ] **Step 2 (Verify RED):** Run `npx vitest run src/lib/auth/__tests__/access-control.test.ts`.
- [ ] **Step 3 (GREEN):** Update `src/lib/supabase/client.ts`, `src/lib/auth/campaign-access.ts` (SHA-256 hashed cache key, short TTL, strict fail-closed), and `src/lib/room/combat-access.ts`.
- [ ] **Step 4 (Verify GREEN):** Run `npx vitest run src/lib/auth/__tests__/access-control.test.ts`.

---

### Task 3: Combat, Maps, Library & Presets API Hardening + Action IDOR & Potion Replay Fix

**Files:**
- Create: `src/lib/security/errors.ts`
- Modify: `src/app/api/combat/action/route.ts`
- Modify: `src/app/api/combat/create-arena/route.ts`
- Modify: `src/app/api/combat/maps/route.ts`
- Modify: `src/app/api/combat/create/route.ts`
- Modify: `src/app/api/combat/active/route.ts`
- Modify: `src/app/api/library/route.ts`
- Modify: `src/app/api/library/seed/route.ts`
- Modify: `src/app/api/combat/presets/route.ts`
- Test: `src/app/api/combat/__tests__/security-hardening.test.ts`

- [ ] **Step 1 (RED):** Write failing tests in `src/app/api/combat/__tests__/security-hardening.test.ts`:
  - `POST /api/combat/create-arena` returns `404` in production or `401` without auth.
  - `POST /api/combat/maps` returns `401`/`403` without access and rejects `javascript:` / `data:image/svg+xml` `backgroundUrl`.
  - `POST/DELETE /api/library`, `POST /api/library/seed`, `POST/DELETE /api/combat/presets` return `401` without authenticated user, and reject invalid `cr` (like JS code) or deleting `preset-*` templates.
  - `POST /api/combat/action`:
    - `update-combatant`, `update-resources`, `reset-turn`, `remove-combatant`, `remove-element` fail with `404`/`400` if target ID belongs to a different `combatId` (cross-combat IDOR).
    - Blocked while `pendingReaction` is active.
    - `batch-actions` with `drink-potion` followed by `move-combatant` triggering `ReactionPrompt` does NOT call `syncCharacterPotionConsumed` until `reaction-response` completes `saveState`.
- [ ] **Step 2 (Verify RED):** Run `npx vitest run src/app/api/combat/__tests__/security-hardening.test.ts`.
- [ ] **Step 3 (GREEN):** Implement `src/lib/security/errors.ts` (`safeErrorDetails`) and harden all listed routes + `combat/action/route.ts`.
- [ ] **Step 4 (Verify GREEN):** Run `npx vitest run src/app/api/combat/__tests__/security-hardening.test.ts`.

---

### Task 4: Campaign, Room, Chat & Auth Callback Hardening

**Files:**
- Modify: `src/app/api/campaign/delete/route.ts`
- Modify: `src/app/api/room/create/route.ts`
- Modify: `src/app/api/room/[code]/route.ts`
- Modify: `src/app/api/room/[code]/turn/route.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/auth/callback/route.ts`
- Test: `src/app/api/room/__tests__/room-security.test.ts`

- [ ] **Step 1 (RED):** Write failing tests in `src/app/api/room/__tests__/room-security.test.ts`:
  - `POST /api/campaign/delete` rejects unauthenticated (`401`) and ownerless campaign (`403`).
  - `POST /api/room/create` rejects unauthenticated (`401`) even when `campaignId` is provided.
  - `GET /api/room/[code]` requires auth (`401`) and redacts `campaignCharacters` (`notes`, `inventory`, `spells`) for non-members.
  - `GET /api/room/[code]/turn` requires auth (`401`) and returns `403` for non-members.
  - `POST /api/chat` returns `401` when unauthenticated even without `campaignId`.
  - `GET /api/auth/callback` does not reflect `access_token`/`refresh_token` from query string into redirect URL and rejects control-character / protocol-relative `next`.
- [ ] **Step 2 (Verify RED):** Run `npx vitest run src/app/api/room/__tests__/room-security.test.ts`.
- [ ] **Step 3 (GREEN):** Implement changes across the 6 route files.
- [ ] **Step 4 (Verify GREEN):** Run `npx vitest run src/app/api/room/__tests__/room-security.test.ts`.

---

### Task 5: Client XSS (`eval` Removal) & Next.js Security Config

**Files:**
- Create: `src/lib/combat/cr-parser.ts`
- Modify: `src/components/combat/PresetsModal.tsx`
- Modify: `next.config.ts`
- Test: `src/lib/combat/__tests__/cr-parser.test.ts`

- [ ] **Step 1 (RED):** Write failing tests in `src/lib/combat/__tests__/cr-parser.test.ts` for `parseChallengeRating` (`"1/8" -> 0.125`, `"1/4" -> 0.25`, `"1/2" -> 0.5`, `"5" -> 5`, `"alert(1)" -> NaN`).
- [ ] **Step 2 (Verify RED):** Run `npx vitest run src/lib/combat/__tests__/cr-parser.test.ts`.
- [ ] **Step 3 (GREEN):** Implement `parseChallengeRating`, replace `eval(p.cr)` in `PresetsModal.tsx`, and add security headers + `outputFileTracingIncludes` to `next.config.ts`.
- [ ] **Step 4 (Verify GREEN):** Run `npx vitest run src/lib/combat/__tests__/cr-parser.test.ts`.

---

### Task 6: Update Legacy Tests & Full Verification

**Files:**
- Modify: `src/app/api/combat/__tests__/combat-campaign-isolation.test.ts`
- Modify: `src/app/api/combat/__tests__/api-routes.test.ts`
- Modify: `src/app/api/combat/__tests__/combat-id-route.test.ts`
- Modify: `src/app/api/combat/__tests__/complete-route.test.ts`
- Modify: `src/app/api/combat/__tests__/reaction-response.test.ts`
- Modify: `src/app/api/combat/__tests__/import-character-slots-and-stats.test.ts`
- Modify: `src/app/api/room/__tests__/routes.test.ts`
- Modify: `src/app/api/campaign/__tests__/campaign-user-isolation.test.ts` (if affected)

- [ ] **Step 1:** Update legacy test fixtures/headers so tests pass valid authenticated user context (without weakening any security check).
- [ ] **Step 2:** Run full verification:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npx vitest run --no-file-parallelism --testTimeout=60000` (with temporary local SQLite `test.db`, removing `test.db` afterwards)
  - `graphify update .`
- [ ] **Step 3:** Verify `git status` is clean of temporary artifacts (`test.db`) and **do NOT push** (`git push` strictly forbidden per user instruction).
