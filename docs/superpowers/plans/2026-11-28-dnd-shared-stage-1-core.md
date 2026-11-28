# `dnd-shared` Stage 1 (Core: Spells, Races, Fighter & Scourgeborne) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. All parallel subagents MUST run on `hydrogen` (`Model: 'inherit'` in `invoke_subagent`).

**Goal:** Unify Spells, Races (84 official 2014 races + subraces + wizard `choices`/`category`), Fighter subclasses, and `scourgeborne` homebrew in `dnd-shared`, and switch both `dnd5e-character-sheet` (`dev`) and `ai_master_n_battle` (`dev`) to consume the pinned `dnd-shared` GitHub SHA without breaking UI contracts, tests, or Next.js builds.

**Architecture:** `dnd-shared` owns canonical data plus shared normalization/lookup helpers (`findSpell`, `findCoreSpell`, `findRace`, `findCoreRace`), exposing lightweight `-core` exports (`./core`, `./races-core`) without `combat`/`masterRecord`, full combat exports (`.`, `./races`, `./fighter`), and isolated `./homebrew`. Both consumer websites keep thin local adapters preserving existing TypeScript signatures (`DND_COMPENDIUM_SPELLS`, `DND_COMPENDIUM_RACES`, `findSpellByName`, `findRaceByName`, `findRaceData`, `FIGHTER_SUBCLASSES`) and are updated in parallel once the `dnd-shared` Stage 1 release SHA is pushed.

**Tech Stack:** Node.js ESM (`node --test`), Python 3 (`build-races.py`), TypeScript 5, Next.js 16, React 19, `tsx --test` (`dnd5e-character-sheet`), Vitest (`ai_master_n_battle`).

**Spec:** [2026-11-28-dnd-shared-unification-design.md](file:///c:/antig/ai_master_n_battle/docs/superpowers/specs/2026-11-28-dnd-shared-unification-design.md)

## Global Constraints

- Canonical source for official D&D 5e (2014) content is `dnd.su` (2014 edition; no UA, Plane Shift, PH24).
- All official races, subraces, and features must be present with full Russian names and descriptions.
- `-core` exports MUST NOT contain `combat`, `combatSource`, `masterRecord`, or `monsters`.
- Homebrew (`scourgeborne`) MUST be isolated in `dnd-shared/homebrew` (`isHomebrew: true`) so official `RACES` stays strictly 84 races (`54` Legacy + `30` MPMM).
- Both consumer repos pin `"dnd-shared": "github:LightSix56/dnd-shared#<SHA>"` and commit updated `package-lock.json`.
- Both consumer repos push ONLY to `dev` (never `main`); in `ai_master_n_battle`, unrelated uncommitted `src/lib/combat/procgen/*` and `src/app/dev-maps/*` files MUST NOT be staged or modified.
- All parallel subagents MUST run on `hydrogen` (`Model: 'inherit'`).

---

## File Structure

- `C:\antig\dnd-shared`:
  - Modify: `package.json`, `src/index.js`, `src/index.d.ts`, `src/core.js`, `src/core.d.ts`, `src/races.js`, `src/races.d.ts`, `src/races-core.js`, `src/races-core.d.ts`, `src/fighter.js`, `scripts/build-races.py`, `test/spells.test.js`, `test/races.test.js`
  - Create: `src/load-json.js`, `src/spell-search.js`, `src/race-search.js`, `src/homebrew.js`, `src/homebrew.d.ts`, `scripts/extract-race-sheet-meta.py`, `scripts/race-sheet-meta.json`, `data/homebrew-races.json`, `test/homebrew.test.js`
- `C:\antig\dnd5e-character-sheet` (branch `dev`):
  - Modify: `package.json`, `package-lock.json`, `src/data/compendium/spells/index.ts`, `src/data/compendium/races/index.ts`, `src/data/compendium/race-progression.ts`
  - Delete: `src/data/compendium/spells/cantrips.ts`, `level-1.ts`..`level-9.ts`, `src/data/compendium/races/core.ts`, `multiverse.ts`, `supplements.ts`
- `c:\antig\ai_master_n_battle` (branch `dev`):
  - Modify: `package.json`, `package-lock.json`, `src/lib/combat/races/race-defs.ts`, `src/lib/combat/fighter-subclasses.ts`, `src/lib/combat/srd/adapter.ts`
  - Delete: `src/lib/combat/data/races-2014.json`, `scripts/sync-dnd-shared-races.mjs`, `src/lib/combat/data/fighter-dndsu.json`

---

### Task 1: `dnd-shared` — Cross-Bundler JSON Loader & Unified Spell Search (`SPELL_ALIASES`)

**Files:**
- Create: `C:\antig\dnd-shared\src\load-json.js`
- Create: `C:\antig\dnd-shared\src\spell-search.js`
- Modify: `C:\antig\dnd-shared\src\index.js`
- Modify: `C:\antig\dnd-shared\src\index.d.ts`
- Modify: `C:\antig\dnd-shared\src\core.js`
- Modify: `C:\antig\dnd-shared\src\core.d.ts`
- Modify: `C:\antig\dnd-shared\src\fighter.js`
- Modify: `C:\antig\dnd-shared\test\spells.test.js`

**Interfaces:**
- Produces in `dnd-shared` (`.`): `SPELLS: Spell[]`, `SPELL_ALIASES: Record<string, string>`, `findSpell(query: string, opts?: { fuzzy?: boolean }): Spell | undefined`
- Produces in `dnd-shared/core`: `CORE_SPELLS: CoreSpell[]`, `SPELL_ALIASES: Record<string, string>`, `findCoreSpell(query: string, opts?: { fuzzy?: boolean }): CoreSpell | undefined`

- [ ] **Step 1: Write failing tests in `C:\antig\dnd-shared\test\spells.test.js`**

Add tests for `SPELL_ALIASES`, prefix cleaning (`"заклинание Огненный шар"`), Russian/English synonyms (`"рассеивание магии"` -> `"Развеять магию"`, `"магическая стрела"` -> `"Волшебная стрела"`), and `findCoreSpell` in `dnd-shared/core`:

```js
test("findSpell и findCoreSpell поддерживают SPELL_ALIASES, ё/е и префикс 'заклинание'", async () => {
  const { CORE_SPELLS, findCoreSpell, SPELL_ALIASES } = await import("../src/core.js");
  assert.ok(Object.keys(SPELL_ALIASES).length >= 30);
  const dispel = findSpell("рассеивание магии");
  assert.equal(dispel?.name, "Развеять магию");
  assert.equal(findCoreSpell("заклинание Рассеивание магии")?.id, dispel?.id);
  assert.equal(findCoreSpell("полет")?.name, "Полёт");
  assert.equal(findCoreSpell("Огненный шар", { fuzzy: true })?.nameEn, "Fireball");
  assert.ok(!("combat" in findCoreSpell("Огненный шар")));
  assert.equal(CORE_SPELLS.length, SPELLS.length);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `C:\antig\dnd-shared`: `node --test test/spells.test.js`
Expected: FAIL (`findCoreSpell is not a function` / `SPELL_ALIASES is undefined`).

- [ ] **Step 3: Implement `src/load-json.js`, `src/spell-search.js`, and update `index.*`, `core.*`, `fighter.js`**

Create `C:\antig\dnd-shared\src\load-json.js` using `createRequire(import.meta.url)` (so Next.js 16 Turbopack/Webpack, Node ESM, and `tsx` all load JSON cleanly without import-attribute parser issues):

```js
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export function loadJson(relPath) {
  return require(relPath);
}
```

Create `C:\antig\dnd-shared\src\spell-search.js` containing `SPELL_ALIASES` (copied from `dnd5e-character-sheet/src/data/compendium/spells/index.ts`) and `createSpellFinder(spells)`:

```js
export const SPELL_ALIASES = {
  "защита от добра и зла": "защита от зла и добра",
  "рассеивание магии": "развеять магию",
  "развеять магию": "рассеивание магии",
  "сигнал тревоги": "тревога",
  "обнаружение мыслей": "чтение мыслей",
  "чтение мыслей": "обнаружение мыслей",
  "свобода перемещения": "свобода передвижения",
  "свобода передвижения": "свобода перемещения",
  "высшее восстановление": "улучшенное восстановление",
  "улучшенное восстановление": "высшее восстановление",
  "магическая стрела": "волшебная стрела",
  "исцеление ран": "лечение ран",
  "исцеляющее слово": "лечащее слово",
  "массовое исцеляющее слово": "множественное лечащее слово",
  "массовое исцеление ран": "множественное лечение ран",
  "духовные защитники": "духовные стражи",
  "контрзаклятье": "контрзаклинание",
  "ледяной шторм": "град",
  "гекс": "сглаз",
  "добряника": "ягодка",
  "жир": "осаление",
  "горящие руки": "огненные ладони",
  "громовая волна": "волна грома",
  "медленное падение": "падение пером",
  "полет": "полёт",
  "дверь между измерениями": "пространственная дверь",
  "палящая кара": "обжигающая кара",
  "оглушающая кара": "ошеломляющая кара",
  "магическое око": "магический глаз",
  "невидимый слуга": "невидимый слуга",
  "огненная стрела": "огненный снаряд",
  "мистический выстрел": "мистический заряд",
  "кислотные брызги": "брызги кислоты",
  "жалость к умирающим": "пощада умирающих",
  "танцующие огоньки": "пляшущие огоньки",
  "floating disk": "диск тензера",
  "tiny hut": "хижина леомунда",
  "hideous laughter": "жуткий смех таши",
  "acid arrow": "кислотная стрела мельфа",
  "black tentacles": "чёрные щупальца эварда",
  "arcane hand": "рука бигби",
  "resilient sphere": "упругая сфера отилюка",
  "freezing sphere": "ледяная сфера отилюка",
  "faithful hound": "верный пес морденкайнена",
  "private sanctum": "личное убежище морденкайнена",
  "telepathic bond": "телепатическая связь рэри",
  "secret chest": "потайной сундук леомунда",
  "instant summons": "мгновенное призвание дромиджа",
  "irresistible dance": "неудержимая пляска отто",
};

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/’/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export function createSpellFinder(spells) {
  const byEn = new Map(
    spells.flatMap((s) => [
      [norm(s.nameEn), s],
      ...(s.aliasesEn ?? []).map((n) => [norm(n), s]),
    ])
  );
  const byRu = new Map(spells.map((s) => [norm(s.name), s]));
  const byId = new Map(spells.map((s) => [s.id, s]));
  const byLegacy = new Map(
    spells.flatMap((s) => (s.legacyIds ?? []).map((id) => [id, s]))
  );

  const exact = (q) =>
    byEn.get(q) ?? byRu.get(q) ?? byId.get(q) ?? byLegacy.get(q);

  return function findSpell(query, { fuzzy = false } = {}) {
    if (!query) return undefined;
    const raw = String(query).trim();
    const q = norm(raw);
    if (!q) return undefined;

    const direct = exact(q) ?? byId.get(raw) ?? byLegacy.get(raw);
    if (direct) return direct;

    const cleanQ = q.replace(/^(?:заклинание|заговор)\s+/i, "");
    if (cleanQ !== q) {
      const byClean = exact(cleanQ);
      if (byClean) return byClean;
    }

    const alias = SPELL_ALIASES[q] ?? SPELL_ALIASES[cleanQ];
    if (alias) {
      const byAlias = exact(norm(alias));
      if (byAlias) return byAlias;
    }

    if (!fuzzy) return undefined;
    return spells.find(
      (s) => norm(s.name).includes(q) || norm(s.nameEn).includes(q)
    );
  };
}
```

Update `src/index.js`, `src/core.js`, `src/fighter.js` to use `loadJson`, export `SPELL_ALIASES`, `findSpell`, `findCoreSpell`, and update `src/index.d.ts` and `src/core.d.ts` with matching TypeScript declarations.

- [ ] **Step 4: Run tests to verify pass**

Run in `C:\antig\dnd-shared`: `node --test test/spells.test.js test/fighter.test.js`
Expected: PASS (all tests green).

- [ ] **Step 5: Commit Task 1**

```powershell
git -C C:\antig\dnd-shared add src/load-json.js src/spell-search.js src/index.js src/index.d.ts src/core.js src/core.d.ts src/fighter.js test/spells.test.js
git -C C:\antig\dnd-shared commit -m "feat(spells): add cross-bundler json loader, SPELL_ALIASES, and findCoreSpell"
```

---

### Task 2: `dnd-shared` — Enrich Races (`category`, `choices`) & Unify `findRace` (Legacy vs MPMM)

**Files:**
- Create: `C:\antig\dnd-shared\scripts\extract-race-sheet-meta.py`
- Create: `C:\antig\dnd-shared\scripts\race-sheet-meta.json`
- Create: `C:\antig\dnd-shared\src\race-search.js`
- Modify: `C:\antig\dnd-shared\scripts\build-races.py`
- Modify: `C:\antig\dnd-shared\data\races.json`
- Modify: `C:\antig\dnd-shared\data\races-core.json`
- Modify: `C:\antig\dnd-shared\src\races.js`
- Modify: `C:\antig\dnd-shared\src\races.d.ts`
- Modify: `C:\antig\dnd-shared\src\races-core.js`
- Modify: `C:\antig\dnd-shared\src\races-core.d.ts`
- Modify: `C:\antig\dnd-shared\test\races.test.js`

**Interfaces:**
- Produces in `dnd-shared/races`: `RACES: Race[]`, `findRace(raceQuery: string, subraceQuery?: string, opts?: { preferVariant?: "legacy" | "mpmm"; fuzzy?: boolean }): { race: Race; subrace?: Subrace } | undefined`
- Produces in `dnd-shared/races-core`: `CORE_RACES: CoreRace[]`, `findCoreRace(raceQuery: string, subraceQuery?: string, opts?: { preferVariant?: "legacy" | "mpmm"; fuzzy?: boolean }): { race: CoreRace; subrace?: CoreSubrace } | undefined`
- `Race` & `CoreRace` include `category: "core" | "multiverse" | "setting" | "spelljammer" | "lineage"` and optional `choices?: RaceChoicesConfig`; `Subrace` & `CoreSubrace` include optional `choices?: RaceChoicesConfig`.

- [ ] **Step 1: Write failing tests in `C:\antig\dnd-shared\test\races.test.js`**

Add tests checking:
1. Every one of the 84 races has valid `category` in `["core", "multiverse", "setting", "spelljammer", "lineage"]`.
2. Critical wizard races carry `choices`: `kobold-mpmm` (`isFlexibleASI`, `cantripChoice`), `lizardfolk-mpmm` (`extraSkillsCount: 2`), `autognome` (`toolChoice`), `astral-elf` (`cantripChoice.spellOptions`), `simic-hybrid` (`customFeatureChoice`), `githyanki-mpmm` (`cantripChoice`), `harengon-mpmm` (`sizeChoice: ["Средний", "Маленький"]`), `human.subraces` (`variant-human` has `hasFeat: true, extraSkillsCount: 1`).
3. `findRace("Аасимар", "Защитник")` resolves to `race.id === "aasimar"` (Legacy) and `subrace.id === "protector-aasimar"`, while `findRace("Аасимар (MPMM)")` resolves to `aasimar-mpmm`.
4. `findCoreRace` is exported from `../src/races-core.js` and returns core entries without `combat`.

- [ ] **Step 2: Run test to verify it fails**

Run in `C:\antig\dnd-shared`: `node --test test/races.test.js`
Expected: FAIL (`category` missing, `choices` missing, `findCoreRace` missing, Legacy/MPMM collision fails if MPMM matched first).

- [ ] **Step 3: Snapshot sheet race metadata into `scripts/race-sheet-meta.json` and integrate into `scripts/build-races.py`**

Write `C:\antig\dnd-shared\scripts\extract-race-sheet-meta.py` to read `C:\antig\dnd5e-character-sheet\src\data\compendium\races\{core,multiverse,supplements}.ts` once and save a self-contained `scripts/race-sheet-meta.json` mapping official race IDs (resolving MPMM IDs like `aasimar` -> `aasimar-mpmm`, subrace IDs like `human-variant` -> `variant-human`, `aasimar-protector` -> `protector-aasimar`, etc.) to `{ category, aliases, choices, subraces: { [id]: { aliases, choices } } }`, plus `scourgeborne` exported separately (for Task 3).
Update `scripts/build-races.py`:
- Read `scripts/race-sheet-meta.json` (instead of requiring `../dnd5e-character-sheet` at build time, while still allowing optional CLI override).
- Assign `category` for all 84 races: explicit value from `race-sheet-meta.json`, fallback by `sourceBook`/`editionVariant` (`PH14` → `"core"`, `MPMM` → `"multiverse"`, `VRGR` → `"lineage"`, `SAS` → `"spelljammer"`, others like `GGR`/`RLW`/`MOT`/`WBW`/`SCC`/`SDQ`/`EGW`/`AI`/`FTD`/`TCE`/`VGM`/`MTF`/`POA`/`SCAG`/`LR`/`TP`/`OGA` → `"setting"`).
- Attach `choices` on races and subraces (including `sizeChoice: ["Средний", "Маленький"]` whenever `size === "Средний или Маленький"` and `isFlexibleASI: true` for MPMM races if not already set).
- Run `python scripts/extract-race-sheet-meta.py C:\antig\dnd5e-character-sheet` and `python scripts/build-races.py`.

- [ ] **Step 4: Implement `src/race-search.js` and update `src/races.*` & `src/races-core.*`**

Create `C:\antig\dnd-shared\src\race-search.js` implementing `createRaceFinder(races)` matching `race-defs.ts` collision resolution (exact id/name/nameEn/aliases -> prefix/substring score -> `wantsMpmm` / `preferVariant` tie-breaker -> subrace presence tie-breaker), plus prefix match fallback (`n.startsWith(r.name)` for `"Дворф горный"`). Use `loadJson` in `src/races.js` and `src/races-core.js`, and add `category` + `RaceChoicesConfig` types to `src/races.d.ts` and `src/races-core.d.ts`.

- [ ] **Step 5: Run tests and commit Task 2**

Run in `C:\antig\dnd-shared`: `node --test test/races.test.js`
Expected: PASS (84 races, all `category`/`choices`/Legacy-MPMM assertions green).

```powershell
git -C C:\antig\dnd-shared add scripts/extract-race-sheet-meta.py scripts/race-sheet-meta.json scripts/build-races.py data/races.json data/races-core.json src/race-search.js src/races.js src/races.d.ts src/races-core.js src/races-core.d.ts test/races.test.js
git -C C:\antig\dnd-shared commit -m "feat(races): add category, wizard choices, and Legacy/MPMM collision lookup"
```

---

### Task 3: `dnd-shared` — Add `./homebrew` (`scourgeborne`), Full Package Verification & GitHub Push

**Files:**
- Create: `C:\antig\dnd-shared\data\homebrew-races.json`
- Create: `C:\antig\dnd-shared\src\homebrew.js`
- Create: `C:\antig\dnd-shared\src\homebrew.d.ts`
- Create: `C:\antig\dnd-shared\test\homebrew.test.js`
- Modify: `C:\antig\dnd-shared\package.json`

**Interfaces:**
- Produces in `dnd-shared/homebrew`: `HOMEBREW_RACES: CoreRace[]` (contains `scourgeborne` with `isHomebrew: true`, 4 subraces `scourgeborne-belua`, `scourgeborne-aranea`, `scourgeborne-cervus`, `scourgeborne-vespertilio`)

- [ ] **Step 1: Write failing test `C:\antig\dnd-shared\test\homebrew.test.js`**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { HOMEBREW_RACES } from "../src/homebrew.js";
import { RACES } from "../src/races.js";

test("HOMEBREW_RACES содержит Порождение Бедствия (scourgeborne) с 4 подрасами и флагом isHomebrew", () => {
  const s = HOMEBREW_RACES.find((r) => r.id === "scourgeborne");
  assert.ok(s);
  assert.equal(s.isHomebrew, true);
  assert.equal(s.name, "Порождение Бедствия");
  assert.equal(s.subraces.length, 4);
  assert.deepEqual(
    s.subraces.map((sr) => sr.id),
    ["scourgeborne-belua", "scourgeborne-aranea", "scourgeborne-cervus", "scourgeborne-vespertilio"]
  );
  assert.equal(RACES.some((r) => r.id === "scourgeborne"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `C:\antig\dnd-shared`: `node --test test/homebrew.test.js`
Expected: FAIL (`Cannot find module '../src/homebrew.js'`).

- [ ] **Step 3: Populate `data/homebrew-races.json`, create `src/homebrew.js` + `src/homebrew.d.ts`, export `./homebrew` in `package.json`**

Populate `data/homebrew-races.json` from `extract-race-sheet-meta.py` (with `speeds: { walk: 30 }`, `isHomebrew: true`, `editionVariant: "homebrew"`, `sourceBook: "HB"`, `progression: []`, `subraces` with `speeds: { walk: 40 }` on `scourgeborne-cervus`, `traits` with `combatRelevant: false`).
Add `"./homebrew": { "types": "./src/homebrew.d.ts", "default": "./src/homebrew.js" }` and `"./homebrew-races.json": "./data/homebrew-races.json"` to `package.json`, bump version to `0.6.0`.

- [ ] **Step 4: Run full test suite in `dnd-shared` and push to GitHub**

Run in `C:\antig\dnd-shared`:
```powershell
node --test test/*.test.js
```
Expected: ALL tests in `spells.test.js`, `races.test.js`, `fighter.test.js`, `homebrew.test.js` PASS.

Push to `origin main` (clearing proxy per rules) and record `<SHA_1>`:
```powershell
$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""
git -C C:\antig\dnd-shared add data/homebrew-races.json src/homebrew.js src/homebrew.d.ts test/homebrew.test.js package.json
git -C C:\antig\dnd-shared commit -m "feat(homebrew): export scourgeborne via dnd-shared/homebrew (v0.6.0)"
git -C C:\antig\dnd-shared push origin main
git -C C:\antig\dnd-shared rev-parse HEAD
```

---

### Task 4: `dnd5e-character-sheet` (`dev`) — Integrate Spells & Races (`dnd-shared` `<SHA_1>`) [Parallel Agent A]

**Subagent:** `invoke_subagent` with `Model: 'inherit'` (Hydrogen), `TypeName: 'self'`, `Role: 'Sheet Repo Integrator'`, `Workspace: 'inherit'` (works directly in `C:\antig\dnd5e-character-sheet` on branch `dev`).

**Files:**
- Modify: `C:\antig\dnd5e-character-sheet\package.json` & `package-lock.json`
- Modify: `C:\antig\dnd5e-character-sheet\src\data\compendium\spells\index.ts`
- Modify: `C:\antig\dnd5e-character-sheet\src\data\compendium\races\index.ts`
- Modify: `C:\antig\dnd5e-character-sheet\src\data\compendium\race-progression.ts`
- Delete: `C:\antig\dnd5e-character-sheet\src\data\compendium\spells\cantrips.ts`, `level-1.ts`..`level-9.ts`
- Delete: `C:\antig\dnd5e-character-sheet\src\data\compendium\races\core.ts`, `multiverse.ts`, `supplements.ts`
- Create test: `C:\antig\dnd5e-character-sheet\test\dnd-shared-core-bundle.test.ts`

**Interfaces:**
- Consumes: `dnd-shared/core` (`CORE_SPELLS`, `findCoreSpell`), `dnd-shared/races-core` (`CORE_RACES`, `findCoreRace`), `dnd-shared/homebrew` (`HOMEBREW_RACES`) pinned at `<SHA_1>`.
- Preserves exports: `DND_COMPENDIUM_SPELLS`, `CANTRIPS`, `LEVEL_1_SPELLS`..`LEVEL_9_SPELLS`, `findSpellByName`, `DND_COMPENDIUM_RACES`, `CORE_RACES`, `MULTIVERSE_RACES`, `SUPPLEMENT_RACES`, `findRaceByName`, `DND_RACE_PROGRESSION`, `getRacialHPBonusPerLevel`, `getRacialFeaturesForLevel`.

- [ ] **Step 1: Create `dev` branch from `main` and install `dnd-shared#<SHA_1>`**

```powershell
Set-Location C:\antig\dnd5e-character-sheet
git checkout -b dev
$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""
npm install "github:LightSix56/dnd-shared#<SHA_1>"
```

- [ ] **Step 2: Write failing integration test `test/dnd-shared-core-bundle.test.ts`**

Assert that:
1. `DND_COMPENDIUM_SPELLS.length >= 525` and none of the entries contain `combat`, `combatSource`, or `masterRecord`.
2. `DND_COMPENDIUM_RACES.length >= 85` (84 official + `scourgeborne`), none of the traits contain `combat`, and `findRaceByName("Аасимар (MPMM)")?.id === "aasimar-mpmm"`.
3. `findSpellByName("рассеивание магии")?.name === "Развеять магию"`.

Run: `npx tsx --test test/dnd-shared-core-bundle.test.ts` -> Expected: FAIL before adapter migration.

- [ ] **Step 3: Replace hardcoded spell/race arrays with thin adapters**

1. Update `src/data/compendium/spells/index.ts`:
   - Import `CORE_SPELLS`, `findCoreSpell` from `dnd-shared/core`.
   - Export `DND_COMPENDIUM_SPELLS: DndSpell[] = CORE_SPELLS as unknown as DndSpell[]`.
   - Export `CANTRIPS` and `LEVEL_1_SPELLS`..`LEVEL_9_SPELLS` via `DND_COMPENDIUM_SPELLS.filter(s => s.level === N)`.
   - Implement `findSpellByName(query)` delegating to `findCoreSpell(query, { fuzzy: true })`.
   - Delete `cantrips.ts`, `level-1.ts`..`level-9.ts`.
2. Update `src/data/compendium/races/index.ts`:
   - Import `CORE_RACES as SHARED_CORE_RACES`, `findCoreRace` from `dnd-shared/races-core` and `HOMEBREW_RACES` from `dnd-shared/homebrew`.
   - Map `CoreRace` → `CompendiumRace` (`speed: r.speeds?.walk ?? 30`, `size: r.size === 'Средний или Маленький' ? 'Средний' : r.size`, `subraces` mapping `speed: sr.speeds?.walk`, preserving `choices`, `category`, `aliases`).
   - Export `DND_COMPENDIUM_RACES` (`[...mappedOfficial, ...mappedHomebrew]`), plus `CORE_RACES`, `MULTIVERSE_RACES`, `SUPPLEMENT_RACES` filtered by `category`/`sourceBook` so all imports remain intact.
   - Implement `findRaceByName(name)` delegating across `[...SHARED_CORE_RACES, ...HOMEBREW_RACES]` (or `findCoreRace(name, undefined, { fuzzy: true })?.race` mapped + homebrew check + `n.startsWith` prefix fallback so `'Дворф горный'` -> `'dwarf'`).
   - Delete `races/core.ts`, `races/multiverse.ts`, `races/supplements.ts`.
3. Update `src/data/compendium/race-progression.ts`:
   - Derive `DND_RACE_PROGRESSION: RaceProgressionFeature[]` from `DND_COMPENDIUM_RACES` / `SHARED_CORE_RACES` `progression` entries (keeping `getRacialHPBonusPerLevel` and `getRacialFeaturesForLevel` signatures intact, including Aasimar/Tiefling/Drow entries).

- [ ] **Step 4: Run all checks in `C:\antig\dnd5e-character-sheet`**

Run:
```powershell
npm run typecheck; if ($LASTEXITCODE -eq 0) { npm run lint }; if ($LASTEXITCODE -eq 0) { npm test }; if ($LASTEXITCODE -eq 0) { npm run build }
```
Expected: `tsc --noEmit` 0 errors, `eslint` 0 errors, ALL tests in `test/*.test.ts` PASS (including `races-compendium-adversarial.test.ts`, `alternate-barbarian-and-scourgeborne.test.ts`, `spells-autocomplete-internal.test.ts`, `wizard-engine-adversarial.test.ts`, `dnd-shared-core-bundle.test.ts`), and `next build` succeeds.

- [ ] **Step 5: Update `graphify`, commit, and push to `origin dev`**

```powershell
graphify update .
$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""
git add -A
git commit -m "feat(compendium): migrate spells and races to dnd-shared"
git push -u origin dev
```

---

### Task 5: `ai_master_n_battle` (`dev`) — Integrate `dnd-shared` `<SHA_1>` Races & Fighter [Parallel Agent B]

**Subagent:** `invoke_subagent` with `Model: 'inherit'` (Hydrogen), `TypeName: 'self'`, `Role: 'Master Repo Integrator'`, `Workspace: 'inherit'` (works in `c:\antig\ai_master_n_battle` on branch `dev`).

**Files:**
- Modify: `c:\antig\ai_master_n_battle\package.json` & `package-lock.json`
- Modify: `c:\antig\ai_master_n_battle\src\lib\combat\races\race-defs.ts`
- Modify: `c:\antig\ai_master_n_battle\src\lib\combat\fighter-subclasses.ts`
- Modify: `c:\antig\ai_master_n_battle\src\lib\combat\srd\adapter.ts`
- Delete: `c:\antig\ai_master_n_battle\src\lib\combat\data\races-2014.json`, `c:\antig\ai_master_n_battle\scripts\sync-dnd-shared-races.mjs`, `c:\antig\ai_master_n_battle\src\lib\combat\data\fighter-dndsu.json`

**Interfaces:**
- Consumes: `dnd-shared` (`SPELLS`, `findSpell`), `dnd-shared/races` (`RACES`, `findRace`), `dnd-shared/fighter` (`FIGHTER_DATA`) pinned at `<SHA_1>`.
- Preserves exports: `RACES_2014`, `findRaceData`, `resolveRaceForCharacter`, `FIGHTER_SUBCLASSES`, `FIGHTER_FEATURES`, `fighterSubclassId`, `getAllSRDSpells`, `getAllCombatSpells`, `getSRDSpell`.

- [ ] **Step 1: Update `dnd-shared#<SHA_1>` in `c:\antig\ai_master_n_battle`**

```powershell
Set-Location c:\antig\ai_master_n_battle
$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""
npm install "github:LightSix56/dnd-shared#<SHA_1>"
```

- [ ] **Step 2: Switch `race-defs.ts` and `fighter-subclasses.ts` to `dnd-shared` & remove duplicate JSONs**

1. In `src/lib/combat/races/race-defs.ts`:
   - Replace `import data from "../data/races-2014.json"` with `import { RACES as SHARED_RACES, findRace } from "dnd-shared/races"`.
   - Export `RACES_2014 = SHARED_RACES as unknown as RaceData[]`.
   - Keep `findRaceData` delegating to `findRace` + `RACES` pattern fallback if needed, preserving exact Legacy vs MPMM and subrace rules.
   - Delete `src/lib/combat/data/races-2014.json` and `scripts/sync-dnd-shared-races.mjs`.
2. In `src/lib/combat/fighter-subclasses.ts`:
   - Replace `import data from "./data/fighter-dndsu.json"` with `import { FIGHTER_DATA } from "dnd-shared/fighter"`.
   - Export `FIGHTER_SUBCLASSES = FIGHTER_DATA.subclasses` and `FIGHTER_FEATURES = FIGHTER_DATA.features as FighterFeature[]`.
   - Delete `src/lib/combat/data/fighter-dndsu.json`.
3. In `src/lib/combat/srd/adapter.ts`:
   - Keep `combatSpells("srd" | "expanded")` intact (so `shared-spells.test.ts` stays 100% green), and use `findSpell` for fallback resolution in `getSRDSpell` when exact map miss occurs.

- [ ] **Step 3: Run verification suite in `c:\antig\ai_master_n_battle`**

Run:
```powershell
npx tsc --noEmit; if ($LASTEXITCODE -eq 0) { npm run lint }; if ($LASTEXITCODE -eq 0) { npm run test -- --no-file-parallelism --testTimeout=60000 src/lib/combat/__tests__/shared-spells.test.ts src/lib/combat/__tests__/race-registry.test.ts src/lib/combat/__tests__/races-phb.test.ts src/lib/combat/__tests__/races-volo.test.ts src/lib/combat/__tests__/races-settings.test.ts src/lib/combat/__tests__/races-mpmm.test.ts src/lib/combat/__tests__/fighter-subclasses.test.ts }; git checkout -- prisma/schema.prisma
```
Also run `npm run build` (`next build`) to verify bundling!

- [ ] **Step 4: Update `graphify`, stage ONLY Stage 1 files, commit, and push to `origin dev`**

IMPORTANT: Do NOT use `git add .` — leave unrelated `src/lib/combat/procgen/*` and `src/app/dev-maps/*` untouched!
```powershell
graphify update .
$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""
git add package.json package-lock.json src/lib/combat/races/race-defs.ts src/lib/combat/fighter-subclasses.ts src/lib/combat/srd/adapter.ts src/lib/combat/data/races-2014.json scripts/sync-dnd-shared-races.mjs src/lib/combat/data/fighter-dndsu.json graphify-out/
git commit -m "feat(combat): consume dnd-shared races and fighter subclasses"
git push origin dev
```

---

### Task 6: Final Stage 1 Verification & Stage 2 Handoff

- [ ] **Step 1: Verify clean git state across all 3 repos and matching SHA pin**

Run:
```powershell
git -C C:\antig\dnd-shared rev-parse HEAD
Select-String -Path C:\antig\dnd5e-character-sheet\package.json, c:\antig\ai_master_n_battle\package.json -Pattern "dnd-shared"
git -C C:\antig\dnd-shared status -sb
git -C C:\antig\dnd5e-character-sheet status -sb
git -C c:\antig\ai_master_n_battle status -sb
```
Expected: Both `package.json` files reference the exact same `<SHA_1>` on `LightSix56/dnd-shared`, `dnd-shared` (`main`) and `dnd5e-character-sheet` (`dev`) are clean and pushed, and `ai_master_n_battle` (`dev`) is pushed with only unrelated pre-existing `procgen`/`dev-maps` untouched.

- [ ] **Step 2: Proceed to Stage 2 planning (`writing-plans` for 12 remaining classes + `alt-barbarian`)**

---

## Plan Self-Review

1. **Spec coverage:** Covers Stage 1 from Spec Section 5 (JSON loader compatibility, `SPELL_ALIASES` + `findCoreSpell`, `races-core` `category` + `choices` + `Legacy/MPMM` resolution, `./homebrew` for `scourgeborne`, parallel integration on `dev` for both sites with `hydrogen` subagents, SHA pinning, and verification gates). Stages 2–4 remain queued as separate plans per `writing-plans` Scope Check.
2. **Placeholder scan:** No "TBD", "TODO", or vague steps; exact paths, interfaces, test assertions, and commands included.
3. **Type consistency:** `findCoreSpell`, `findCoreRace`, `HOMEBREW_RACES`, `SPELL_ALIASES`, `FIGHTER_DATA` match across Tasks 1–5.
