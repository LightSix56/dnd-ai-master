# Security Hardening Design (`dnd-ai-master`)

**Date:** 2026-11-25  
**Scope:** End-to-end security hardening across authentication, authorization/access control, IDOR prevention, SSRF protection, XSS elimination, error sanitization, security headers, and transactional safety.

## Global Constraints

1. **Strict fail-closed authorization:** No unauthenticated access to campaigns, combats, rooms, or mutating endpoints. Ownerless campaigns (`userId = null`) and combats without `campaignId` are inaccessible to anonymous callers.
2. **SSRF protection (Public HTTPS + DNS/IP filter):** User/AI-supplied URLs (`baseURL`, `fetch_page`) must use `https://`, reject credentials/localhost/private/link-local/metadata IPs before connecting (via DNS lookup) and across redirects.
3. **No `eval()` / unsafe dynamic execution:** Remove `eval()` in UI components (`PresetsModal.tsx`).
4. **Transactional integrity:** No external DB side effects inside replayable combat actions before `saveState` completes.
5. **No `git push`:** Do not push changes without explicit user permission.

## Architecture & Changes

### 1. Core Auth & Access Control
- `src/lib/supabase/client.ts`:
  - `getSupabaseAdminClient()` must throw an explicit configuration error if `SUPABASE_SERVICE_ROLE_KEY` is missing, rather than silently falling back to `supabaseAnonKey`.
- `src/lib/auth/campaign-access.ts`:
  - `checkCampaignAccess(request, campaignId)`: require valid `userId` (`401` if missing); return `403` if `campaignId` is missing or campaign has `userId === null` (fail-closed, no anonymous ownerless access).
  - `denyCombatAccess(request, combatId)`: if `combatId` is provided and combat exists with `campaignId === null`, require authenticated `userId` (`401`) and deny non-owners (`403`), never allow anonymous access.
  - Hash `Authorization` header (SHA-256) as key in `userCache` instead of keeping raw JWTs in memory. Keep `ownerCache`/`roomCache` TTL short (5s) or bypass cache for destructive/membership mutations.
- `src/lib/room/combat-access.ts`:
  - Reject unauthenticated requests (`if (!userId) return "Требуется авторизация."`).
  - Fail closed on unexpected errors in `catch` (return access-denied message instead of `null`).
  - Expand `ACTOR_FIELD` / host-only actions so `apply-damage`, `apply-healing`, `update-combatant`, `update-resources`, `reset-turn`, `death-save`, `add-from-library`, `end-combat`, `delete-combat`, `add-combatant`, `remove-combatant`, `add-party-member`, `add-element`, `remove-element`, `resize-grid`, `expand-grid-direction`, `roll-initiative`, `set-initiative`, `reposition-combatant`, `dm-move` cannot be executed by unauthorized room guests against another player's hero or the combat state.

### 2. SSRF Protection (`src/lib/security/ssrf.ts`)
- Export `assertSafePublicHttpsUrl(rawUrl: string): Promise<URL>` and `safeFetch(input: string | URL, init?: RequestInit, maxRedirects?: number): Promise<Response>`.
- Enforce `https:` scheme only, no `username`/`password` in URL, reject `localhost`, `*.local`, `*.internal`, `*.localhost`, and direct private/reserved IPv4/IPv6 literals.
- Resolve hostname via `node:dns/promises` (`lookup(hostname, { all: true })`) and reject if any resolved address is loopback, private (RFC1918), link-local (`169.254.0.0/16`, `fe80::/10`), CGNAT (`100.64.0.0/10`), multicast/unspecified/reserved, or IPv4-mapped IPv6 targeting those ranges.
- Follow redirects manually (`redirect: "manual"`, up to 3 hops), re-validating every `Location` target via `assertSafePublicHttpsUrl`.
- Integrate into:
  - `src/lib/ai/client.ts` (validate `baseURL` before `fetch` in `customFetch`)
  - `src/app/api/test-key/route.ts`
  - `src/app/api/models/route.ts`
  - `src/lib/dnd/search.ts` (`fetchPageText`)

### 3. API Route Hardening & IDOR Fixes
- `src/app/api/combat/create-arena/route.ts`: disable in `NODE_ENV === "production"` (404) unless explicitly enabled, require authenticated user + `campaignId` + `denyCampaignAccess`, and scope `endActiveCombats({ campaignId })` to that campaign only.
- `src/app/api/combat/maps/route.ts`: require `denyCombatAccess(req, combatId)` and `404` if combat missing; validate grid bounds (`5..100`), element coordinates, and safe `backgroundUrl` (`/maps/...`, `procgen://...`, or validated `https://`).
- `src/app/api/combat/create/route.ts` & `src/app/api/combat/active/route.ts`: require authenticated user (`401` if `!userId`); remove anonymous fallback to arbitrary active combats.
- `src/app/api/combat/action/route.ts`:
  - Fix cross-combat IDOR in `update-combatant`, `update-resources`, `reset-turn`, `remove-combatant`, `remove-element` by verifying the target record belongs to `combatId` (`where: { id, combatId }`) and checking `pendingReaction` (block mutations while reaction prompt is active).
  - Fix replay side-effect bug in `batch-actions`: defer `syncCharacterPotionConsumed` calls until after `saveState(combatId, state)` succeeds so a `ReactionPrompt` replay never double-consumes potions.
- `src/app/api/library/route.ts`, `src/app/api/library/seed/route.ts`, `src/app/api/combat/presets/route.ts`:
  - `library/seed`: require `ADMIN_SECRET` bearer match (or allow only in non-production with authenticated user).
  - `library` (`POST`, `DELETE`) and `presets` (`POST`, `DELETE`): require authenticated user (`401`), validate payload fields strictly, forbid modifying/deleting built-in `preset-*` templates, and require `ADMIN_SECRET` or explicit admin/non-prod guard for shared global mutations (wait: verify UI callers of `library` and `presets` `POST`/`DELETE`!).
- `src/app/api/campaign/delete/route.ts`: require `401` if `!user`, `403` if `!existing.userId || existing.userId !== user.id`.
- `src/app/api/room/create/route.ts`: require authenticated `user` (`401` if `!user`), remove synthetic `host_campaign_${campaignId}` fallback.
- `src/app/api/room/[code]/route.ts` & `src/app/api/room/[code]/turn/route.ts`: require authenticated user on `GET`; return full `campaignCharacters` / `notes` / `inventory` / `turn` only to room host/participants (or `403` for non-members on `turn` GET and redacted preview for room join).
- `src/app/api/auth/callback/route.ts`: remove query-string `access_token`/`refresh_token` reflection into redirect fragment; keep strict relative `safeNext` check (rejecting control characters/backslash/protocol-relative) and PKCE `exchangeCodeForSession`.
- `src/app/api/chat/route.ts`: require authenticated user even when `activeCampaignId` is absent (`401` if `!userId`).
- Sanitize 500 error responses across hardened routes so internal error details/stack/SQL strings are logged server-side only and not leaked in JSON `details` in production.

### 4. Client XSS, Next.js Config & Headers
- `src/components/combat/PresetsModal.tsx`: replace `eval(p.cr)` with a safe fraction/number parser (`parseChallengeRating`).
- `next.config.ts`: add security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`), and add `outputFileTracingIncludes` for `src/data/compendium/monsters/**/*`.

### 5. Test Updates & Verification
- Update legacy tests (`combat-campaign-isolation.test.ts`, `api-routes.test.ts`, `campaign-user-isolation.test.ts`, etc.) to pass authenticated user context.
- Add dedicated unit/integration tests for SSRF blocking, `campaign-access` / `combat-access` fail-closed rules, cross-combat IDOR, `batch-actions` potion replay safety, `create-arena`/`maps`/`library`/`presets`/`delete`/`room` auth checks, and `parseChallengeRating`.
