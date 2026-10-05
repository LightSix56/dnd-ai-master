# Campaign Character Versions — Part 1: Database and Sheet Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `public.characters` can hold per-campaign versions of a character, and the sheet site shows them, saves without overwriting what the master site wrote, and gates level-up by experience for campaign versions.

**Architecture:** Additive SQL migration (new columns, a revision trigger, two service-only functions). The sheet site keeps its single-active-sheet model; it learns the row's `revision`, sends it on save, and on a conflict takes game-state fields from the server and keeps the player's other edits. A campaign version is an ordinary row with `campaign_id` set.

**Tech Stack:** Supabase Postgres, Next.js 16, React 19, TypeScript, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-05-campaign-character-versions-design.md` (in the `dnd-ai-master` repo). Part 2 (master site) is `2026-10-05-campaign-versions-2-master-site.md`.

**Repositories:** SQL lives in `dnd-ai-master` (`D:\projects\dnd-ai-master`, cloud copy `/home/claude/dnd-ai-master`). All other tasks are in the sheet site, `D:\projects\dnd5e-character-sheet`, reachable only on the user's computer.

## Global Constraints

- Sheet site rules from its `AGENTS.md` apply: read `node_modules/next/dist/docs/` before touching Next APIs; parchment theme only (`.parchment-btn`, `.parchment-btn-secondary`, colours `#F5E6C8`, `#3D2012`, `#8B6914`, `#C9A84C`); vector icons from `src/components/dnd-icons.tsx`, no emoji icons; no early `return null` before hooks; never start `next dev`.
- Before reporting any sheet-site task done: `npx tsc --noEmit` (0 errors), `npx eslint .` (0 errors), `npm run test:adversarial` (green).
- Sheet site branches: work on a branch named `dev` (create from `main` if absent); never push to `main` without the user's explicit go-ahead after they check the Vercel preview. This overrides the "push origin main" line in `AGENTS.md`.
- `dnd-ai-master`: only branches `main` and `dev`; push `dev` only.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01VLB8WKLBwPmMMZ7KEK2E3i`.
- The migration is run by the user by hand in the Supabase SQL editor. It must be re-runnable and must not use temp tables (the editor drops them between statements).
- `characters.data` may be a JSON string stored inside jsonb (double-encoded). Every SQL function that touches `data` must normalise it first.
- User-facing text is Russian.
- A campaign version's `campaign_id`, `campaign_name`, `source_character_id` are never accepted from the browser.
- XP thresholds (level → minimum XP), D&D 5e: 1:0, 2:300, 3:900, 4:2700, 5:6500, 6:14000, 7:23000, 8:34000, 9:48000, 10:64000, 11:85000, 12:100000, 13:120000, 14:140000, 15:165000, 16:195000, 17:225000, 18:265000, 19:305000, 20:355000.
- Game-state fields (owned by the master site during play): `hpCurrent`, `hpTemp`, `conditions`, `concentration`, `experiencePoints`, `deathSaveSuccesses`, `deathSaveFailures`, `hitDiceSpent`, and `spellSlots[*].expendedSlots`.

## Review Focus

1. Player levels up on the sheet while the master writes combat results to the same row → the level-up must survive and the combat XP must not be lost (Task 4 test `merge keeps local level-up and server xp`).
2. Old client (cached JS) saves without `expectedRevision` → save still works, last-write-wins, no 500 (Task 3 test `POST without expectedRevision updates`).
3. Row whose `data` is double-encoded → `apply_character_game_state` normalises it instead of failing (Task 1 verification query).
4. Spell slot keys arrive as strings (`"1"`) after JSON round trip and the server's `expendedSlots` exceeds the local `totalSlots` → clamp, no negative free slots (Task 4 test `merge clamps expended slots`).
5. Version whose original was deleted (`source_character_id` null or absent from the list) → still listed as its own card with the campaign badge, not hidden (Task 6 test `orphan version stays visible`).

---

### Task 1: SQL migration 007

**Files:**
- Create: `dnd-ai-master/scripts/migrations/007_character_campaign_versions.sql`
- Create (identical copy): `dnd5e-character-sheet/supabase-campaign-versions.sql`

**Interfaces:**
- Produces, on `public.characters`: `source_character_id uuid NULL REFERENCES public.characters(id) ON DELETE SET NULL`, `campaign_id text NULL`, `campaign_name text NULL`, `revision integer NOT NULL DEFAULT 0`.
- Produces: `public.apply_character_game_state(p_id uuid, p_patch jsonb) RETURNS integer` (new revision) — sets `data = normalised(data) || p_patch` (top-level key merge).
- Produces: `public.add_character_experience(p_id uuid, p_amount integer) RETURNS integer` (new total XP) — atomic increment of `data.experiencePoints`, treating a missing value as 0.
- Produces on Prisma table `"Character"`: `"sheetCharacterId" text NULL`, `"sheetLevelSeen" integer NULL`, index on `"sheetCharacterId"`.
- Produces on Prisma table `"Combat"`: `"sheetSyncedAt" timestamp(3) NULL`.

- [ ] **Step 1: Write the migration.** All statements idempotent (`ADD COLUMN IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS`). Contents:
  - the four columns above;
  - `CREATE UNIQUE INDEX IF NOT EXISTS characters_source_campaign_uidx ON public.characters (source_character_id, campaign_id) WHERE source_character_id IS NOT NULL AND campaign_id IS NOT NULL`;
  - `CREATE INDEX IF NOT EXISTS characters_campaign_idx ON public.characters (campaign_id) WHERE campaign_id IS NOT NULL`;
  - trigger function `public.bump_character_revision()` with `NEW.revision = COALESCE(OLD.revision, 0) + 1`, trigger `bump_revision BEFORE UPDATE ON public.characters FOR EACH ROW`;
  - trigger function `public.protect_character_campaign_fields()`: when `auth.role() <> 'service_role'`, on UPDATE restore `campaign_id`, `campaign_name`, `source_character_id` from `OLD`; on INSERT force them to NULL. Trigger `protect_campaign_fields BEFORE INSERT OR UPDATE`;
  - the two functions, `SECURITY DEFINER`, `SET search_path = public`; `REVOKE ALL ... FROM PUBLIC, anon, authenticated`; `GRANT EXECUTE ... TO service_role`. Normalisation: `CASE WHEN jsonb_typeof(data) = 'string' THEN (data #>> '{}')::jsonb ELSE data END`. Both raise an exception when the row does not exist;
  - the `"Character"` columns and index, and the `"Combat"` column;
  - header comment in Russian in the style of `004_room_read_policies.sql`: what it does, that it is safe to re-run, that nothing is deleted.

- [ ] **Step 2: Add a verification block** at the end of the file, commented out, for the user to run after applying:

```sql
-- SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='characters'
--   AND column_name IN ('source_character_id','campaign_id','campaign_name','revision');
-- ожидается 4 строки
```

- [ ] **Step 3: Dry-run locally.** If `psql`/Postgres is available in the workspace, apply the file twice to a scratch database that has a minimal `characters` table (columns from `dnd5e-character-sheet/supabase-schema.sql` lines 36-44, without the `auth.users` FK) and a `"Character"` table; then insert one row with `data = to_jsonb('{"hpCurrent":5}'::text)` and check `SELECT apply_character_game_state(id, '{"hpCurrent":3}')` leaves `data->>'hpCurrent' = '3'` and `revision = 1`. If Postgres cannot be installed, state that the migration was not executed anywhere and ask the user to run it on Supabase before Task 3 is deployed.

- [ ] **Step 4: Commit** in `dnd-ai-master` (`feat(sql): campaign versions of characters, revision counter`) and copy the file into the sheet repo (committed with Task 3).

- [ ] **Step 5: Hand-off to the user.** Tell the user to run the file in Supabase and paste the result of the verification query. Do not start Task 3's deployment until they confirm.

### Task 2: XP thresholds (sheet site)

**Files:**
- Create: `src/lib/xp-thresholds.ts`
- Test: `test/xp-thresholds.test.ts`

**Interfaces:**
- Produces: `XP_THRESHOLDS: readonly number[]` (index = level, index 0 unused = 0), `xpRequiredForLevel(level: number): number`, `canLevelUpWithXp(level: number, xp: number): boolean`, `xpMissingForNextLevel(level: number, xp: number): number`.

- [ ] **Step 1: Write the failing test**

```ts
test('thresholds match D&D 5e', () => {
  assert.equal(xpRequiredForLevel(2), 300);
  assert.equal(xpRequiredForLevel(5), 6500);
  assert.equal(xpRequiredForLevel(20), 355000);
});
test('level-up allowed only at threshold', () => {
  assert.equal(canLevelUpWithXp(1, 299), false);
  assert.equal(canLevelUpWithXp(1, 300), true);
  assert.equal(canLevelUpWithXp(20, 999999), false);
  assert.equal(xpMissingForNextLevel(1, 120), 180);
  assert.equal(xpMissingForNextLevel(1, 500), 0);
  assert.equal(xpMissingForNextLevel(20, 0), 0);
});
test('garbage input is treated as zero xp / level 1', () => {
  assert.equal(canLevelUpWithXp(NaN as number, undefined as unknown as number), false);
});
```

- [ ] **Step 2: Run** `npx tsx --test test/xp-thresholds.test.ts` — expected: FAIL, module not found.
- [ ] **Step 3: Implement** the four exports; non-finite inputs coerce to level 1 / xp 0.
- [ ] **Step 4: Run** the same command — expected: PASS.
- [ ] **Step 5: Commit** `feat(xp): D&D 5e experience thresholds`.

### Task 3: Characters API — new columns, conditional save, guarded delete

**Files:**
- Modify: `src/app/api/characters/route.ts` (select lists at lines 21, 95, 123, 185; POST update branch 89-108; DELETE 196-216)
- Create: `src/lib/character-save.ts` (pure helpers, so the logic is testable without Next)
- Test: `test/character-save-conflict.test.ts`

**Interfaces:**
- Produces: `CHARACTER_COLUMNS = 'id, name, data, portrait_url, created_at, updated_at, revision, campaign_id, campaign_name, source_character_id'` and `CHARACTER_META_COLUMNS` (same without `data`).
- Produces: `parseExpectedRevision(value: unknown): number | null` — integers ≥ 0 only, anything else → `null`.
- Produces HTTP contract:
  - `GET /api/characters` → rows with `CHARACTER_COLUMNS`; `GET /api/characters?id=<uuid>` → `{ character }` for that one row or 404.
  - `POST` body may include `expectedRevision`. When it is a number and the row exists with a different revision → **409** `{ error: 'Лист изменился на сервере', conflict: true, character: <row with CHARACTER_COLUMNS> }`. When absent → update as today. Success → `{ character: <CHARACTER_META_COLUMNS> }`.
  - `DELETE` hitting foreign-key error code `23503` → **409** `{ error: 'Этот персонаж участвует в комнате. Сначала закройте комнату или выберите в ней другого героя.' }`.
  - Body fields `campaign_id`, `campaign_name`, `source_character_id`, `revision` are ignored on insert and update.

- [ ] **Step 1: Write the failing tests** for `parseExpectedRevision` (`0 → 0`, `7 → 7`, `'7' → null`, `-1 → null`, `1.5 → null`, `undefined → null`) and for a pure `decideSaveOutcome({ expectedRevision, updatedRow, currentRow })` returning `'updated' | 'conflict' | 'insert'`:
  - `updatedRow` present → `'updated'`;
  - no `updatedRow`, `currentRow` present, `expectedRevision` a number → `'conflict'`;
  - no `updatedRow`, no `currentRow` → `'insert'`;
  - test name `POST without expectedRevision updates`: `expectedRevision: null`, `updatedRow` present → `'updated'`.
- [ ] **Step 2: Run** `npx tsx --test test/character-save-conflict.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** helpers and wire the route: the update query adds `.eq('revision', expectedRevision)` only when `parseExpectedRevision` returns a number; when the update returns no row, re-select by `id` + `user_id` to tell conflict from "not found → insert". Add the `?id=` branch to GET. Map `23503` in DELETE.
- [ ] **Step 4: Run** the test file and `npm run test:adversarial` — expected: PASS. Note: `test/supabase-characters-api.test.ts` requires `.env.local`; if it is absent, report that file as skipped, not as passing.
- [ ] **Step 5: Commit** `feat(api): revision-aware character save, campaign columns` (include `supabase-campaign-versions.sql`).

### Task 4: Conflict merge (pure)

**Files:**
- Create: `src/lib/campaign-merge.ts`
- Test: `test/campaign-merge.test.ts`

**Interfaces:**
- Produces: `GAME_STATE_FIELDS` (the list from Global Constraints, without `spellSlots`), `mergeServerGameState(local: CharacterData, server: Partial<CharacterData>): CharacterData`.
- Rule: every `GAME_STATE_FIELDS` key present on `server` replaces the local value; `spellSlots` keeps local `totalSlots` and takes `expendedSlots` from the server per level, clamped to `0..totalSlots`; levels missing on the server keep local values; everything else stays local. Exception: when `local.level > server.level` (player levelled up meanwhile) `hpCurrent`, `hpTemp`, `hitDiceSpent` and `spellSlots` stay local — level-up already set them — while `experiencePoints` and `conditions` still come from the server.

- [ ] **Step 1: Write the failing tests**

```ts
test('server game state wins, sheet edits stay', () => {
  const local = { ...base, equipment: 'new sword', hpCurrent: 20, experiencePoints: 0 };
  const merged = mergeServerGameState(local, { hpCurrent: 7, experiencePoints: 150, conditions: ['poisoned'] });
  assert.equal(merged.equipment, 'new sword');
  assert.equal(merged.hpCurrent, 7);
  assert.equal(merged.experiencePoints, 150);
  assert.deepEqual(merged.conditions, ['poisoned']);
});
test('merge clamps expended slots', () => {
  const local = { ...base, spellSlots: { 1: { totalSlots: 2, expendedSlots: 0 } } };
  const merged = mergeServerGameState(local, { spellSlots: { '1': { totalSlots: 4, expendedSlots: 3 } } as any });
  assert.deepEqual(merged.spellSlots[1], { totalSlots: 2, expendedSlots: 2 });
});
test('merge keeps local level-up and server xp', () => {
  const local = { ...base, level: 2, hpCurrent: 18, hpMax: 18 };
  const merged = mergeServerGameState(local, { level: 1, hpCurrent: 3, experiencePoints: 320 } as any);
  assert.equal(merged.level, 2);
  assert.equal(merged.hpCurrent, 18);
  assert.equal(merged.experiencePoints, 320);
});
test('server without game fields changes nothing', () => {
  assert.deepEqual(mergeServerGameState(base, {}), base);
});
```
(`base = createDefaultCharacter()` with `name: 'Тест'`.)

- [ ] **Step 2: Run** `npx tsx --test test/campaign-merge.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expected: PASS.
- [ ] **Step 5: Commit** `feat(sync): merge server game state into local sheet`.

### Task 5: Sheet page — carry revision, resolve conflicts, refresh on return

**Files:**
- Modify: `src/app/page.tsx` (`saveToCloud` 416-491, `loadCloudCharacter` 1862-1886, login sync 530-602, refs near 361-373)
- Modify: `src/lib/cloud-sync-state.ts` (`CloudSyncMeta`)
- Test: `test/cloud-sync-and-request-guards.test.ts` (extend)

**Interfaces:**
- Consumes: Task 3 HTTP contract; `mergeServerGameState` (Task 4).
- Produces: `CloudSyncMeta.cloudRevision: number | null`; page state `activeCampaign: { campaignId: string; campaignName: string | null } | null` (set whenever a cloud row is applied; `null` for originals and local sheets) — used by Tasks 6 and 7.

- [ ] **Step 1: Write the failing test** in the existing file: `readSyncMeta` returns `cloudRevision: null` for stored meta that lacks the key, and round-trips `cloudRevision: 4`.
- [ ] **Step 2: Run** `npx tsx --test test/cloud-sync-and-request-guards.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement.**
  - `cloudRevisionRef` beside `cloudCharIdRef`; set from the row in `loadCloudCharacter`, in the `use-cloud` login branch, and from every successful save response; cleared in `unlinkCloudCharacter`.
  - `saveToCloud` sends `expectedRevision: cloudRevisionRef.current ?? undefined` when updating an existing id.
  - 409 with `conflict: true`: `merged = mergeServerGameState(char, normalizeCharacterData(response.character.data))`; `setChar(merged)`; set `cloudRevisionRef` to the returned revision; set `pendingCloudSaveRef` so the existing `finally` re-trigger saves again; do not surface an error. Guard: at most 3 consecutive conflict retries, then show the normal error status.
  - `activeCampaign` set from `campaign_id` / `campaign_name` of the applied row.
  - New effect on `visibilitychange` → visible: when a cloud row is linked and sync meta is not dirty, `GET /api/characters?id=`; if its `revision` differs from `cloudRevisionRef`, apply it through the same path as `loadCloudCharacter` (no modal, no toast other than «Лист обновлён после игры»).
- [ ] **Step 4: Run** `npx tsc --noEmit`, `npx eslint .`, `npm run test:adversarial` — expected: 0 errors, green.
- [ ] **Step 5: Commit** `feat(sync): revision-aware cloud save and refresh on return`.

### Task 6: Character list — versions under their original

**Files:**
- Create: `src/lib/character-grouping.ts`
- Modify: `src/components/tools/CharacterGridModal.tsx` (`SavedCharacter` 18-26, `allCharacters`/`filteredCharacters` memos ~436-480, grid map 624-~840)
- Test: `test/character-grouping.test.ts`

**Interfaces:**
- Produces: `SavedCharacter` gains `revision?`, `campaign_id?`, `campaign_name?`, `source_character_id?`.
- Produces: `groupCharacterVersions(list: SavedCharacter[]): Array<{ original: SavedCharacter; versions: SavedCharacter[] }>` — an original followed by its versions sorted by `campaign_name`; a version whose original is not in the list becomes its own group (`original` = that version, `versions` = `[]`); input order of originals preserved.

- [ ] **Step 1: Write the failing tests:** `versions follow their original`, `orphan version stays visible`, `search hit on a version keeps its original in the group` (grouping is applied after filtering by re-adding the original when only a version matched), `local-active entry is never treated as a version`.
- [ ] **Step 2: Run** `npx tsx --test test/character-grouping.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** the helper and render: the original's card unchanged; each version rendered as a card directly after it with a badge «Кампания: {campaign_name ?? 'без названия'}» in the style of the existing «Облако» badge and a left indent/connector on `sm:` and wider. Header count keeps counting all rows. The version card's name shows `data.name` (the hero's name), not the row name with the suffix.
- [ ] **Step 4: Run** the three checks from Global Constraints — expected: green.
- [ ] **Step 5: Commit** `feat(list): show campaign versions under their original`.

### Task 7: Level-up gate for campaign versions

**Files:**
- Modify: `src/components/sheet/pages/MainSheetPage.tsx` (level block 246-254, XP input 286, props 98/148)
- Modify: `src/app/page.tsx` (`handleLevelUp` 1154, `MainSheetPage` props ~2322, modal render 2037-2043)
- Test: `test/level-up-campaign-gate.test.ts`

**Interfaces:**
- Consumes: `canLevelUpWithXp`, `xpMissingForNextLevel` (Task 2); `activeCampaign` (Task 5).
- Produces: `levelUpGate(char: Pick<CharacterData,'level'|'experiencePoints'>, campaign: { campaignName: string | null } | null): { allowed: boolean; reason: string | null }` exported from `src/lib/xp-thresholds.ts`. `campaign === null` → `{ allowed: level < 20, reason: null }`.
- Reason text when blocked by XP: `До ${level + 1} уровня не хватает ${missing} опыта`.

- [ ] **Step 1: Write the failing tests:** original at level 1 with 0 XP → allowed; version at level 1 with 299 XP → not allowed, reason `До 2 уровня не хватает 1 опыта`; version with 300 XP → allowed; version at level 20 → not allowed, reason `null`.
- [ ] **Step 2: Run** `npx tsx --test test/level-up-campaign-gate.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement.** `MainSheetPage` gets prop `campaign: { campaignName: string | null } | null`; the «+» button is disabled per `levelUpGate` and its `title` shows the reason; the reason is also shown as a small line under the level block. For campaign versions the «Очки опыта» input is read-only with title «Опыт начисляет мастер». `handleLevelUp` returns early when the gate says no. A one-line banner under the sheet header for versions: «Версия для кампании «{campaignName}». Оригинал не меняется.»
- [ ] **Step 4: Run** the three checks from Global Constraints — expected: green.
- [ ] **Step 5: Commit** `feat(levelup): campaign versions need enough experience`.

### Task 8: Preview verification and release

- [ ] **Step 1:** Push the sheet site `dev` branch; confirm the Vercel preview builds (Ready).
- [ ] **Step 2:** In Supabase, mark one test character as a version by hand (service role, SQL editor): set `campaign_id = 'test'`, `campaign_name = 'Проверка'`, `source_character_id = <its original>`. On the preview check: it appears under the original; XP input read-only; «+» disabled below 300 XP and enabled at 300 (set `data.experiencePoints` via `SELECT add_character_experience(...)`); with the sheet open, run `SELECT apply_character_game_state('<id>', '{"hpCurrent":1}')`, edit equipment on the sheet, and confirm after save that both the equipment edit and `hpCurrent = 1` are in the row.
- [ ] **Step 3:** Report results to the user with what was and was not checked. Merge `dev` → `main` only after the user says so. Remove the test version row afterwards.
