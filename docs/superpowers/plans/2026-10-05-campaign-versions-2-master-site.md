# Campaign Character Versions — Part 2: Master Site — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The master site creates a per-campaign version of a hero on join, reads every hero sheet live from `public.characters.data`, writes combat results and XP back to that row, and lets the party tell the DM it has levelled up. No sheet snapshots remain.

**Architecture:** One module (`sheet-store`) is the only code that talks to `public.characters`. A Prisma `Character` row for a hero becomes a link (`sheetCharacterId`) plus campaign-only state; a second module (`hero-view`) overlays live sheet values on those rows so existing consumers keep receiving the shape they expect. Heroes without a link (NPCs, companions, solo quick-created heroes) keep using their Prisma columns — those are their only store, not a copy.

**Tech Stack:** Next.js 16 App Router, Prisma, Supabase JS (service role on the server), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-campaign-character-versions-design.md`. Depends on Part 1 (`2026-10-05-campaign-versions-1-db-and-sheet-site.md`): migration 007 must be applied on Supabase before any task here is deployed.

## Global Constraints

- Read `node_modules/next/dist/docs/` before changing route or page APIs (`CLAUDE.md`).
- UI: amber theme from `CLAUDE.md`. Primary buttons `bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-500 hover:to-amber-700 text-amber-50 border border-amber-600/60 shadow-xs`; outline buttons `border border-amber-500/25 dark:border-amber-500/20 bg-background/80 hover:bg-amber-500/10 hover:border-amber-500/40 text-foreground hover:text-amber-800 dark:hover:text-amber-300 shadow-xs`. No default black/grey buttons. No synchronous `localStorage` reads in `useState`.
- Branches: only `main` and `dev`. Work and push on `dev`; `main` only after the user checks the Vercel preview and says so. Pushes go from the user's clone `D:\projects\dnd-ai-master` (the cloud workspace cannot push).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01VLB8WKLBwPmMMZ7KEK2E3i`.
- Checks before a task is done: `npx vitest run <touched test files>`, then `npm test` and `npx tsc --noEmit`. Two failures are pre-existing and unrelated: `parser.test` (missing `scratch/silver-dragon.html`) and an `api-routes` timeout — report them as such, do not fix or hide them. `tsc` must report no new errors in touched files.
- No sheet snapshot anywhere: nothing may write a sheet into `room_participants.character_snapshot` or `Character.notes`, and nothing may fall back to them. When a linked sheet cannot be read, the action fails with a visible error; stale data is never substituted.
- The master site never writes to an original (a `characters` row with `campaign_id IS NULL`), with one exception: quick-created heroes are inserted directly as versions.
- All access to `public.characters` goes through `src/lib/dnd/sheet-store.ts`.
- `Character.notes` keeps its other uses (status tag `[Статус: …]`, chronicler bullets `• …`); only the JSON sheet leaves it.
- User-facing text is Russian. DM note text, verbatim: `Партия прокачала уровень, посмотри их листы заново.`
- Game-state fields written back to the sheet: `hpCurrent`, `hpTemp`, `conditions`, `spellSlots[*].expendedSlots`, `experiencePoints`.

## Review Focus

1. Sheet row deleted or unreadable while the hero is in a campaign → hero shown as «лист недоступен», combat creation refuses with a Russian error; no crash, no default 10/10/10 hero (Task 3 test `overlay marks missing sheet`, Task 6 test `combat refuses hero without sheet`).
2. Same original joined to two campaigns → two distinct version rows; second join to the same campaign reuses the first (Task 2 tests `ensureCampaignVersion is idempotent`, `two campaigns give two versions`).
3. Player picks a version that belongs to another campaign or to another user → 403/400, nothing created (Task 4 test `rejects foreign version`).
4. Combat ends twice / `end-combat` and `complete` both fire → XP awarded once, state written once (Task 7 test `second sync is a no-op`).
5. Room created before a campaign exists (lobby) → participants hold originals; when the campaign starts every participant is switched to a version and the original is untouched (Task 5 test `startRoomCampaign converts originals to versions`).

---

### Task 1: Prisma link fields and types

**Files:**
- Modify: `prisma/schema.prisma` (`Character`, lines 57-105)
- Modify: `prisma/schema.sql` (the `"Character"` table DDL)
- Modify: `src/lib/supabase/types.ts` (`SupabaseCharacterRecord` 50-58)

**Interfaces:**
- Produces: `Character.sheetCharacterId String?` (with `@@index([sheetCharacterId])`), `Character.sheetLevelSeen Int?`.
- Produces: `SupabaseCharacterRecord` gains `revision: number`, `campaign_id: string | null`, `campaign_name: string | null`, `source_character_id: string | null`.

- [ ] **Step 1:** Add the fields; run `node scripts/prepare-prisma-for-env.js && npx prisma generate`.
- [ ] **Step 2:** Run `npx tsc --noEmit` — expected: no new errors.
- [ ] **Step 3: Commit** `feat(db): link campaign heroes to their sheet row`.

### Task 2: `sheet-store`

**Files:**
- Create: `src/lib/dnd/sheet-store.ts`
- Test: `src/lib/dnd/__tests__/sheet-store.test.ts`

**Interfaces:**
- Produces:

```ts
export interface SheetRow {
  id: string; userId: string; name: string;
  sheet: Record<string, any>;          // parsed characters.data, never a string
  portraitUrl: string | null; revision: number;
  campaignId: string | null; campaignName: string | null; sourceCharacterId: string | null;
}
export class SheetUnavailableError extends Error {}
export function loadSheet(id: string, client?: SupabaseClient): Promise<SheetRow | null>;
export function loadSheets(ids: string[], client?: SupabaseClient): Promise<Map<string, SheetRow>>;
export function listUserSheets(userId: string, client?: SupabaseClient): Promise<SheetRow[]>;
export function ensureCampaignVersion(input: { userId: string; characterId: string; campaignId: string; campaignName: string }, client?: SupabaseClient): Promise<SheetRow>;
export function createCampaignHeroSheet(input: { userId: string; campaignId: string; campaignName: string; sheet: Record<string, any> }, client?: SupabaseClient): Promise<SheetRow>;
export function applyGameState(id: string, patch: Record<string, unknown>, client?: SupabaseClient): Promise<number>;   // rpc apply_character_game_state → new revision
export function addExperience(id: string, amount: number, client?: SupabaseClient): Promise<number>;                    // rpc add_character_experience → new total
export function versionRowName(heroName: string, campaignName: string): string;                                         // "Токсин (Встреча)"
```
- `client` defaults to `getSupabaseAdminClient()`. `loadSheet` returns `null` for a missing row and throws `SheetUnavailableError` on a database error. `data` stored as a JSON string is parsed.
- `ensureCampaignVersion` rules: the row `characterId` must belong to `userId` (else throws `SheetUnavailableError('Персонаж не найден')`); if it is already a version of `campaignId` → return it; if it is a version of another campaign → throw; otherwise find a row with `source_character_id = characterId AND campaign_id = campaignId`, or insert one copying `data` and `portrait_url`, `name = versionRowName(sheet.name ?? row.name, campaignName)`. A unique-violation on insert (race) → re-select.

- [ ] **Step 1: Write the failing tests** with an in-memory fake Supabase client (table `characters` as an array; `from().select().eq().maybeSingle()`, `.in()`, `.insert()`, `.rpc()` — follow the fake used in `src/lib/room/__tests__/room-service.test.ts`):
  - `loadSheet parses double-encoded data`;
  - `loadSheet returns null for a missing row and throws SheetUnavailableError on db error`;
  - `ensureCampaignVersion is idempotent` (two calls → one new row, same id);
  - `two campaigns give two versions` and the original's `data` is unchanged;
  - `ensureCampaignVersion rejects a row of another user` and `rejects a version of another campaign`;
  - `version row name is "<hero> (<campaign>)" and sheet.name stays the hero name`;
  - `applyGameState calls rpc apply_character_game_state with the patch`.
- [ ] **Step 2: Run** `npx vitest run src/lib/dnd/__tests__/sheet-store.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expected: PASS.
- [ ] **Step 5: Commit** `feat(sheets): single store for hero sheets in the database`.

### Task 3: `hero-view` — live sheet overlaid on campaign heroes

**Files:**
- Create: `src/lib/dnd/hero-view.ts`
- Test: `src/lib/dnd/__tests__/hero-view.test.ts`

**Interfaces:**
- Consumes: `loadSheets`, `SheetRow` (Task 2); `extractCharacterStats`, `summarizeSheetMechanics` from `import-character.ts`.
- Produces:

```ts
export type HeroView<T> = T & { sheet: Record<string, any> | null; sheetRevision: number | null; sheetMissing: boolean };
export function overlaySheet<T extends { sheetCharacterId?: string | null }>(character: T, row: SheetRow | null | undefined): HeroView<T>;
export function withSheets<T extends { sheetCharacterId?: string | null }>(characters: T[]): Promise<HeroView<T>[]>;
export function loadCampaignHeroes(campaignId: string, where?: Prisma.CharacterWhereInput): Promise<HeroView<Character>[]>;
```
- `overlaySheet` for a linked character with a row: replaces `name`, `race`, `class`, `subclass`, `level`, `background`, `str…cha`, `hpMax`, `hpCurrent`, `hpTemp`, `ac`, `speed`, `experiencePoints` with sheet values (via `extractCharacterStats` and direct fields), sets `sheet`. Linked but no row: fields untouched, `sheet: null`, `sheetMissing: true`. Not linked: `sheet: null`, `sheetMissing: false`.

- [ ] **Step 1: Write the failing tests:** `overlay takes level, hp and abilities from the sheet` (Prisma row level 1 / 10 hp, sheet level 3 / 24 hp → 3 / 24); `overlay marks missing sheet`; `unlinked npc is returned unchanged`; `withSheets issues one loadSheets call for all heroes`.
- [ ] **Step 2: Run** `npx vitest run src/lib/dnd/__tests__/hero-view.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — expected: PASS.
- [ ] **Step 5: Commit** `feat(sheets): overlay live sheet values on campaign heroes`.

### Task 4: Join without snapshots

**Files:**
- Modify: `src/lib/room/room-service.ts` (`joinRoom` 246-464, `mapParticipantFromDb` 65-71), `src/lib/room/types.ts` (37-46, 60), `src/lib/room/validation.ts`
- Modify: `src/app/api/room/[code]/join/route.ts`, `src/app/api/room/[code]/route.ts`, `src/app/api/room/user-characters/route.ts`
- Modify: `src/components/room/CharacterPickerModal.tsx` (join calls 341-351, 455-466; quick-create 368-480)
- Test: `src/lib/room/__tests__/join-versions.test.ts`; update `room-service.test.ts`, `src/app/api/room/__tests__/routes.test.ts`, `campaign-room-binding.test.ts`

**Interfaces:**
- Consumes: Task 2 exports.
- Produces: `JoinRoomInput = { roomId: string; userId: string; characterId: string; isHost?: boolean }` (no snapshot).
- Produces: `POST /api/room/[code]/join` body `{ characterId }` or `{ create: { name, race, className } }` (quick-create; server builds the starter sheet with `getArchetypeAbilityScores` and inserts it with `createCampaignHeroSheet`; allowed only when the room has a campaign).
- Produces: `RoomParticipant.character: { id: string; name: string; level: number; race?: string; className?: string; subclass?: string; portraitUrl?: string | null; missing?: boolean }` — filled on read from `loadSheets`, never stored. `RoomParticipant.characterSnapshot` is removed.
- `joinRoom` flow: load the picked row; reject if not owned by `userId` (`RoomRuleError`, 403 at the route); level check against `starting_level` using the live sheet; name clash check using other participants' live sheets; if the room has `campaign_settings.campaignId` → `ensureCampaignVersion` and use the version id as `character_id`, else use the original id; upsert `room_participants` with `character_snapshot: {}`; if the room has a campaign → upsert the Prisma `Character` link (match by `sheetCharacterId`; create with `name`, `type: 'player'`, `sheetCharacterId`, `sheetLevelSeen: sheet.level`; do not write stats or `notes`).
- «Герои кампании» tab: lists Prisma heroes of the campaign; picking one that has `sheetCharacterId` owned by the user joins with that id; a hero without a link owned by nobody is adopted by creating its sheet through the `create` branch from its Prisma fields.

- [ ] **Step 1: Write the failing tests** (fake Supabase + mocked `db`): `join in a campaign room creates a version and binds it`; `rejoin reuses the version`; `rejects foreign version` (row of another user → `RoomRuleError`); `join in a lobby without campaign binds the original and creates nothing`; `participant upsert never contains a sheet` (assert `character_snapshot` deep-equals `{}`); `level below starting level is rejected using the live sheet`.
- [ ] **Step 2: Run** `npx vitest run src/lib/room/__tests__/join-versions.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** service, routes and picker. `/api/room/user-characters` returns originals plus versions of this room's campaign only (pass `roomCode`), each with `campaignName`; the picker shows versions with a «Версия этой кампании» badge and hides originals that already have one.
- [ ] **Step 4: Run** the room test folders and `npx tsc --noEmit` — expected: PASS, no new type errors (Task 5 fixes the remaining `characterSnapshot` readers; until then leave a temporary `@deprecated characterSnapshot?: never` so the build fails loudly at each reader).
- [ ] **Step 5: Commit** `feat(room): join binds a campaign version, no sheet snapshot`.

### Task 5: Replace every snapshot reader

**Files (all readers listed by the audit):**
- Modify: `src/lib/room/room-service.ts` (`startRoomCampaign` 495-764, `createRoom` 113-143), `src/lib/ai/party-arc-generator.ts:126-134`, `src/lib/room/turn-batcher.ts:110-113`, `src/lib/room/combat-access.ts:110`, `src/lib/room/resolve-turn-helper.ts:54-64, 226-260`, `src/app/api/room/[code]/turn/route.ts:82-83`, `src/app/api/room/[code]/route.ts:41-68`
- Modify (client): `src/hooks/useRoomRealtime.ts:190`, `src/components/dnd/DnDApp.tsx` (887, 947, 1864, 2519, 2573, 3793, 3842), `src/components/room/PartyTurnBar.tsx`, `CoopTurnBar.tsx`, `RoomLobby.tsx`, `RoomCampaignSetupModal.tsx`
- Modify: `scripts/verify-room-connection.ts`
- Test: `src/lib/room/__tests__/start-campaign-versions.test.ts`; update existing room tests that build participants with `characterSnapshot`

**Interfaces:**
- Consumes: `RoomParticipant.character` (Task 4), `ensureCampaignVersion`, `loadSheets`, `withSheets`.
- Produces: `RoomService.listParticipants` / `getRoomByCode` return participants with `character` filled.
- `startRoomCampaign` and `createRoom` with a `campaignId`: for every participant call `ensureCampaignVersion`, update `room_participants.character_id` to the version, create the Prisma link row as in Task 4. The party roster for arc generation is built from live sheets.
- `resolve-turn-helper` party status (HP, temp HP, conditions, AC) comes from `loadCampaignHeroes`, not from participants.
- «Active participant» = has `character_id`. Combatant ownership (`combat-access.ts`) matches `Combatant.characterId` → Prisma `Character.sheetCharacterId` → participant `character_id`, with the name match only as a fallback for unlinked heroes.

- [ ] **Step 1: Write the failing test** `startRoomCampaign converts originals to versions`: two participants bound to originals → after start each `character_id` is a new row with `campaign_id` set, originals' `data` unchanged, two Prisma `Character` rows with `sheetCharacterId` and no JSON in `notes`.
- [ ] **Step 2: Run** `npx vitest run src/lib/room/__tests__/start-campaign-versions.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement**; remove the temporary deprecated field from Task 4. `grep -rn "characterSnapshot\|character_snapshot" src scripts` must return only the SQL column definition in `types.ts` and the `{}` write in `joinRoom`.
- [ ] **Step 4: Run** `npm test` and `npx tsc --noEmit` — expected: only the two known failures; no new type errors.
- [ ] **Step 5: Commit** `refactor(room): read heroes from the database everywhere`.

### Task 6: Sheet consumers read the live sheet

**Files:**
- Modify: `src/lib/ai/campaign-context.ts:9-31`, `src/lib/ai/caching/frozen-prefix.ts` (`dossierFromSheetJson` 46, `sanitizePartyMembers` 87), `src/lib/ai/caching/ephemeral-tail.ts:214-245`
- Modify: `src/lib/combat/generator.ts` (883-888, 1028-1031, 1593, 1677, 1685), `src/lib/combat/character-adapter.ts` (`collectRawAttacks` 208, `extractSpellsFromCharacter` 321)
- Modify: `src/lib/dnd/d20-helper.ts` (`parseCharacterProficiencies` 96, `getSkillBonus`, `getSaveBonus`), `src/components/dnd/D20RollModal.tsx:76`, `src/components/dnd/CharacterCard.tsx:118-126`
- Modify: `src/app/api/campaign/activate/route.ts`, `src/app/api/character/route.ts` (GET), `src/app/api/character/import/route.ts`
- Test: update `sheet-import.test.ts`, `sheet-attacks.test.ts`, `d20-helper.test.ts`, caching tests; add `src/lib/combat/__tests__/encounter-live-sheet.test.ts`

**Interfaces:**
- Consumes: `loadCampaignHeroes`, `withSheets`, `HeroView` (Task 3).
- Produces: `parseCharacterProficiencies(source: { sheet?: Record<string, any> | null; notes?: string | null })` — uses `sheet` when present, the text format of `notes` otherwise (NPCs).
- Produces: `PlayerSummary.sheet: Record<string, any> | null`; the dossier is built from it (`summarizeSheetMechanics(sheet)` + the labelled fields), `notes` contributes only its non-sheet text.
- API responses that return campaign characters to the browser (`/api/campaign/activate`, `/api/character`, `/api/room/[code]`) return `HeroView` objects (fields overlaid, plus `sheet`, `sheetMissing`); client components use `character.sheet`.
- `createTacticalEncounter` loads the party with `loadCampaignHeroes`; a hero with `sheetMissing` aborts creation with `Error('У героя «<имя>» недоступен лист персонажа. Выберите героя заново.')`.
- `/api/character/import` (solo campaigns): creates the version with `createCampaignHeroSheet` (user from the request) and a Prisma link row; `notes` receives only `deriveMemories` text, not the JSON.

- [ ] **Step 1: Write the failing tests:** `dossier uses the live sheet, not notes` (hero with empty `notes` and a `sheet` → dossier contains its skills and attacks); `d20 bonuses come from sheet when present`; `combat refuses hero without sheet`; `combatant hp and attacks come from the live sheet` (Prisma row says 10 hp, sheet says 24 → combatant 24).
- [ ] **Step 2: Run** the touched test files — expected: FAIL.
- [ ] **Step 3: Implement.** Keep `sheetFromNotes` only for the migration in Task 9; mark it `@deprecated` and remove every other caller.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit` — expected: only the two known failures.
- [ ] **Step 5: Commit** `refactor(sheets): dice, combat and DM dossier read the live sheet`.

### Task 7: Write game state and XP back to the sheet

**Files:**
- Create: `src/lib/dnd/hero-state.ts`
- Modify: `src/lib/combat/xp-award.ts:85-97`, `src/app/api/combat/action/route.ts` (111-164, 989-1001), `src/app/api/combat/[id]/complete/route.ts:126-132`, `src/lib/ai/tools.ts` (340, 593), `src/lib/ai/scene-synchronizer.ts:295`, `src/app/api/character/route.ts:276`
- Modify: `prisma/schema.prisma` and `prisma/schema.sql` (`Combat`: add `sheetSyncedAt DateTime?`; the production column already exists from migration 007)
- Test: `src/lib/dnd/__tests__/hero-state.test.ts`, `src/lib/combat/__tests__/combat-sheet-sync.test.ts`

**Interfaces:**
- Consumes: `applyGameState`, `addExperience` (Task 2).
- Produces:

```ts
export function writeHeroState(characterId: string, patch: { hpCurrent?: number; hpTemp?: number; conditions?: string[] }): Promise<void>;
export function grantHeroExperience(characterId: string, amount: number): Promise<number>;
export function combatantToSheetPatch(combatant: Combatant, sheet: Record<string, any>): Record<string, unknown>;
export function syncCombatToSheets(combatId: string): Promise<{ synced: number; skipped: boolean }>;
```
- `writeHeroState` / `grantHeroExperience`: `characterId` is the Prisma id; linked hero → sheet row via `applyGameState` / `addExperience`; unlinked → Prisma columns as today.
- `combatantToSheetPatch`: `hpCurrent`, `hpTemp` from the combatant; `spellSlots` = the sheet's slots with `expendedSlots = totalSlots − remaining` per level, where remaining comes from the combatant's `spells` JSON (`SpellData` in `src/lib/combat/types`), clamped to `0..totalSlots`; `conditions` = combatant condition ids that exist in the sheet site's list (`blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious, exhaustion`), others dropped.
- `syncCombatToSheets`: no-op (`skipped: true`) when `Combat.sheetSyncedAt` is set; otherwise patches every combatant that has a linked `characterId`, then sets `sheetSyncedAt`. A failed patch for one hero does not stop the others and leaves `sheetSyncedAt` null so the next call retries.
- Called from the `end-combat` branch (before `awardCombatVictoryXP`) and from the `complete` route. `awardCombatVictoryXP` uses `grantHeroExperience` and is guarded by the same `sheetSyncedAt` check so XP is not granted twice.

- [ ] **Step 1: Write the failing tests:** `linked hero hp goes to the sheet, unlinked to prisma`; `spell slots are written as expended, clamped`; `unknown conditions are dropped`; `second sync is a no-op` (XP total unchanged after a second call); `one failing hero does not block the others and sync is retried`.
- [ ] **Step 2: Run** the two test files — expected: FAIL.
- [ ] **Step 3: Implement** and switch the six writers listed above to `writeHeroState`.
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit` — expected: only the two known failures.
- [ ] **Step 5: Commit** `feat(combat): write combat results and experience to the hero sheet`.

### Task 8: «Партия прокачалась»

**Files:**
- Create: `src/lib/room/party-leveled.ts`, `src/app/api/room/[code]/party-leveled/route.ts`
- Modify: `src/components/room/PartyTurnBar.tsx` (header group 77-102, props 21-31), `src/components/dnd/DnDApp.tsx` (render 3420-3432; dm_stream listener)
- Test: `src/lib/room/__tests__/party-leveled.test.ts`

**Interfaces:**
- Consumes: `loadCampaignHeroes` (Task 3); `denyCampaignAccess`; `broadcastDmStream` in `room-service.ts`.
- Produces:

```ts
export interface LevelChange { characterId: string; name: string; className: string; fromLevel: number; toLevel: number }
export function findLevelChanges(heroes: HeroView<Character>[]): LevelChange[];          // sheet.level > (sheetLevelSeen ?? sheet.level)
export function buildPartyLeveledNote(changes: LevelChange[]): string;
export function acknowledgePartyLevels(campaignId: string): Promise<{ changes: LevelChange[]; note: string }>;
```
- Note text: `Партия прокачала уровень, посмотри их листы заново.` followed by one line per hero: `Токсин — 2 ур. (Плут), был 1`.
- `GET /api/room/[code]/party-leveled` → `{ changes: LevelChange[], combatActive: boolean }`. `POST` → 409 `{ error: 'Сначала завершите бой.' }` when a combat is active; 409 `{ error: 'Никто из партии ещё не повысил уровень.' }` when `changes` is empty; otherwise stores the note as a `ChatMessage` with `role: 'user'` and content prefixed `[Система] ` (so `buildDmHistory` includes it), sets `sheetLevelSeen` for every hero, broadcasts `{ type: 'party_leveled', note }` on the room channel, returns `{ changes, note }`. Any room participant may call it.
- `PartyTurnBar` gets `levelChanges?: LevelChange[]`, `onPartyLeveled?: () => void`; the button «Партия прокачалась» (primary amber style, `h-8`) is shown when `levelChanges.length > 0` and disabled with title «Сначала завершите бой» while `activeCombat` is set. `DnDApp` polls the GET when the round changes and when the tab regains focus; on the `party_leveled` broadcast all clients show the note in the chat and clear the button.

- [ ] **Step 1: Write the failing tests:** `no changes when levels match`; `detects a hero whose sheet level is above the seen level`; `first sight of a hero (sheetLevelSeen null) is not a change`; `note lists every changed hero`; `acknowledge stores a user-role message and updates sheetLevelSeen`; `post during combat is refused`.
- [ ] **Step 2: Run** `npx vitest run src/lib/room/__tests__/party-leveled.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`, `npx tsc --noEmit` — expected: only the two known failures.
- [ ] **Step 5: Commit** `feat(room): tell the DM the party levelled up`.

### Task 9: Migrate existing heroes, then remove the old storage

**Files:**
- Create: `scripts/migrate-heroes-to-versions.ts`, `scripts/migrations/008_drop_character_snapshot.sql`
- Modify: `src/lib/dnd/import-character.ts` (remove `sheetFromNotes`, the `characterSnapshot` wrapper keys in `unwrapSheet`/`extractCharacterStats`/`isSheetCharacter`), `src/lib/room/room-service.ts` (drop the `character_snapshot: {}` write), `src/lib/supabase/types.ts`, `scripts/migrations/001_create_rooms_schema.sql` (comment only: column removed in 008)
- Test: `src/lib/dnd/__tests__/migrate-heroes.test.ts`

**Interfaces:**
- Produces: `planHeroMigration(input: { hero: Character; campaign: { id: string; name: string; userId: string | null }; participant?: { userId: string; characterId: string } | null; existingRow?: SheetRow | null }): { action: 'link-existing-version' | 'create-version' | 'skip'; reason?: string; sheet?: Record<string, any>; userId?: string; sourceCharacterId?: string | null }` — pure, exported from the script's helper module `src/lib/dnd/hero-migration.ts`.
- Rules: hero already has `sheetCharacterId` → `skip`. Sheet source = JSON found in `hero.notes` (using the old `sheetFromNotes`, moved into the migration module); none → `skip` with reason `нет листа`. Owner = participant's `userId`, else `campaign.userId`; none → `skip`. If the participant's `character_id` row is an original → `create-version` with `sourceCharacterId` = that id and `sheet` = the notes sheet (it carries campaign progress); if it is already a version of this campaign → `link-existing-version`.
- Script: `npx tsx scripts/migrate-heroes-to-versions.ts [--apply]`; without `--apply` prints the plan per hero and changes nothing. With `--apply`: creates versions, sets `sheetCharacterId` / `sheetLevelSeen`, repoints `room_participants.character_id`, strips the JSON sheet from `notes` (keeps status tag and bullets). Re-runnable.
- `008`: `ALTER TABLE public.room_participants DROP COLUMN IF EXISTS character_snapshot;` — to be run by the user only after the preview check in Task 10.

- [ ] **Step 1: Write the failing tests** for `planHeroMigration`: the four rules above plus `nested note-in-note card is unwrapped` (sheet buried three levels deep in `notes`).
- [ ] **Step 2: Run** `npx vitest run src/lib/dnd/__tests__/migrate-heroes.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement** helper and script.
- [ ] **Step 4: Dry run** against production (the user provides the environment or runs it): `npx tsx scripts/migrate-heroes-to-versions.ts` — show the printed plan to the user and wait for their go-ahead before `--apply`.
- [ ] **Step 5:** After `--apply` and the user's confirmation that heroes look right, remove the old code listed under Files, run `npm test` and `npx tsc --noEmit`, commit `chore: remove sheet snapshots and notes-sheet parsing`.

### Task 10: Preview verification and release

- [ ] **Step 1:** Push `dev` from `D:\projects\dnd-ai-master`; wait for the Vercel preview to be Ready.
- [ ] **Step 2:** On the preview, with two accounts: create a room for a campaign, join with one original each → on the sheet site each account shows a new «(<кампания>)» version and the original is unchanged; d20 window shows the version's bonuses; start and finish a combat → HP, slots and XP appear on the version on the sheet site; raise XP to the threshold, level up on the sheet site → button «Партия прокачалась» appears, pressing it adds the note and the next DM answer reflects the new level; the same original joined to a second campaign produces a second version.
- [ ] **Step 3:** Report to the user what was checked and what was not; merge to `main` only on their word; then ask them to run `008`.
