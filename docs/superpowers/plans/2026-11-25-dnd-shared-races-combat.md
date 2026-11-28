# D&D 5e (2014) Races & Subraces — `dnd-shared` + Combat Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Спарсить все 84 официальные расы и все их официальные подрасы редакции D&D 5e 2014 с `dnd.su` в общий пакет `dnd-shared` (без хоумбрю, UA и 2024) и последовательно реализовать их боевые механики (минимум до 10 уровня) в боевом движке `ai_master_n_battle` с полным покрытием Vitest-тестами.

**Architecture:** В `C:\antig\dnd-shared` создаётся воспроизводимый Python-парсер `scripts/build-races.py`, который выгружает официальные страницы `/race/` и `/multiverse/race/` (54 Legacy + 30 MPMM с разными `id`), отсекает `tile-HB`/`PH24`/встроенные секции `Unearthed Arcana`, сохраняет полные и лёгкие базы (`data/races.json`, `data/races-core.json`) и экспортирует `RACES` и `findRace()`. В `c:\antig\ai_master_n_battle` добавляются базовые примитивы (`rerollOnes`, условные преимущества на спасброски, проброс расы/подрасы/скоростей/тёмного зрения/вариантов в `Combatant`), декларативный реестр `src/lib/combat/races/` поверх `featureMods` + `registerKit` + `classHooks`, и последовательные модули по группам рас с тестами и проверкой полноты покрытия.

**Tech Stack:** Python 3 (`beautifulsoup4`), Node.js ESM + `node:test`, TypeScript 5, Vitest 5 (`npx vitest run --no-file-parallelism --testTimeout=60000`), React/Next.js 16.

**Spec:** [2026-11-25-dnd-shared-races-combat-design.md](file:///c:/antig/ai_master_n_battle/docs/superpowers/specs/2026-11-25-dnd-shared-races-combat-design.md)

## Global Constraints

- Источник истины: только `dnd.su`, строго редакция **2014** (`PH14`, `POA`, `VGM`, `MTF`, `GGR`, `AI`, `RLW`, `MOT`, `WBW`, `SCC`, `SDQ`, `VRGR`, `TCE`, `OGA`, `LR`, `TP`, `SAS`, `FTD`, `EGW`, `SCAG` + **30** рас `MPMM` с отдельным суффиксом `-mpmm`).
- Строго исключать: `tile-HB`, `HB*`, `UA`, `PSA`/`PSIN` (Plane Shift), `PH24` (2024) и встроенные `Unearthed Arcana` секции на страницах официальных рас.
- Не ломать существующие поля `dnd-shared` (`SPELLS`, `CORE_SPELLS`, `FIGHTER_DATA`) и совместимость имён с `dnd5e-character-sheet`.
- Все броски в боевом движке — строго через `rand()` из `@/lib/rng` (`dice.ts`), без `Math.random()` в новом коде.
- Побочных правок в `prisma/schema.prisma` не коммитить; **ничего не пушить в GitHub** без прямого разрешения пользователя; подагенты запускаются строго на `Model: 'flash'`.
- После изменений кода в `ai_master_n_battle` запускать `npx tsc --noEmit`, `npm run lint`, `npx vitest run ...` и `graphify update .`.

---

### Task 1 (Batch 0): Парсер `dnd.su/race/`, базы `races.json` / `races-core.json` и экспорты в `dnd-shared`

**Files:**
- Create: `C:\antig\dnd-shared\scripts\build-races.py`
- Create: `C:\antig\dnd-shared\data\races.json`
- Create: `C:\antig\dnd-shared\data\races-core.json`
- Create: `C:\antig\dnd-shared\src\races.js`
- Create: `C:\antig\dnd-shared\src\races.d.ts`
- Create: `C:\antig\dnd-shared\src\races-core.js`
- Create: `C:\antig\dnd-shared\src\races-core.d.ts`
- Modify: `C:\antig\dnd-shared\package.json:8-14`
- Modify: `C:\antig\dnd-shared\src\core.js` and `src\core.d.ts` (опционально реэкспорт `CORE_RACES`)
- Test: `C:\antig\dnd-shared\test\races.test.js`

**Interfaces:**
- Consumes: HTTP/кеш страниц `https://dnd.su/race/` (исключая `.tile-HB`) и опциональные алиасы из `C:\antig\dnd5e-character-sheet\src\data\compendium\races\*.ts`.
- Produces: `RACES: Race[]`, `findRace(raceQuery: string, subraceQuery?: string): { race: Race; subrace?: Subrace } | undefined` из `dnd-shared/races`, `CORE_RACES` из `dnd-shared/races-core`.

- [ ] **Step 1: Write failing validation test `test/races.test.js` in `dnd-shared`**

Create `C:\antig\dnd-shared\test\races.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { RACES, findRace } from "../src/races.js";
import { CORE_RACES } from "../src/races-core.js";

test("в библиотеке ровно 84 официальные расы 2014 (54 Legacy + 30 MPMM) с уникальными id", () => {
  assert.equal(RACES.length, 84);
  assert.equal(RACES.filter((r) => r.editionVariant === "mpmm").length, 30);
  assert.equal(RACES.filter((r) => r.editionVariant === "legacy").length, 54);
  assert.equal(new Set(RACES.map((r) => r.id)).size, RACES.length);
});

test("отсутствуют homebrew, UA, Plane Shift и 2024", () => {
  const banned = /homebrew|unearthed arcana|plane shift|ph24|2024|авариэль|гругач/i;
  for (const r of RACES) {
    assert.ok(!banned.test(r.source), `Запрещённый источник у ${r.id}: ${r.source}`);
    assert.ok(!banned.test(r.name), `Запрещённая раса: ${r.name}`);
    for (const s of r.subraces) {
      assert.ok(!banned.test(s.name), `Запрещённая подраса: ${r.id}/${s.name}`);
    }
  }
});

test("у каждой расы и подрасы заполнены базовые поля и черты", () => {
  for (const r of RACES) {
    assert.ok(r.id && r.name && r.nameEn && r.sourceBook && r.dndsuUrl, r.id);
    assert.ok(r.speeds?.walk >= 20, `${r.id}: speed`);
    assert.ok(Array.isArray(r.traits) && r.traits.length > 0, `${r.id}: traits`);
    for (const t of r.traits) {
      assert.ok(t.id && t.name && t.description, `${r.id}/${t.name}`);
      assert.equal(typeof t.combatRelevant, "boolean", `${r.id}/${t.id}`);
    }
    for (const s of r.subraces) {
      assert.ok(s.id && s.name, `${r.id} subrace`);
      assert.ok(Array.isArray(s.traits) && s.traits.length > 0, `${r.id}/${s.id}: traits`);
    }
  }
});

test("Legacy и MPMM разделены разными id и находятся через findRace", () => {
  const aasimarLegacy = findRace("Аасимар", "Защитник");
  const aasimarMpmm = findRace("aasimar-mpmm");
  assert.ok(aasimarLegacy?.race && aasimarLegacy?.subrace);
  assert.equal(aasimarLegacy.race.id, "aasimar");
  assert.ok(aasimarMpmm?.race);
  assert.equal(aasimarMpmm.race.id, "aasimar-mpmm");
  assert.equal(findRace("Эльф", "Высший эльф")?.subrace?.id, "high-elf");
});

test("CORE_RACES повторяет порядок RACES без внутренних боевых метаданных движка", () => {
  assert.deepEqual(CORE_RACES.map((r) => r.id), RACES.map((r) => r.id));
  for (const r of CORE_RACES) {
    for (const t of r.traits) {
      assert.ok(!("combat" in t), `${r.id}/${t.id}: лишнее поле combat в core`);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run in `C:\antig\dnd-shared`: `node --test test/races.test.js`
Expected: FAIL (`Cannot find module '.../src/races.js'`).

- [ ] **Step 3: Write `scripts/build-races.py` (HTML parser + cache + Legacy/MPMM + subrace extractor)**

Inspect DOM details of representative pages (`/race/78-dwarf/`, `/race/79-elf/`, `/race/80-halfling/`, `/race/81-human/`, `/race/82-dragonborn/`, `/race/83-gnome/`, `/race/84-half-elf/`, `/race/85-half-orc/`, `/race/86-tiefling/`, `/race/102-genasi/`, `/race/161-aasimar/`, `/race/223-custom-lineage/`, `/multiverse/race/278-aarakocra/`) and write `C:\antig\dnd-shared\scripts\build-races.py` so it:
1. Caches downloaded HTML in `C:\antig\dnd-shared\.cache\dndsu_race\` (`.cache/` added to `.gitignore`).
2. Filters `a.tile-wrapper.race` where parent does NOT contain `tile-HB`.
3. Identifies `editionVariant = "mpmm"` when `"MPMM"` is in the source class or `/multiverse/race/` (except Spelljammer `SAS` races like `autognome`, `astral-elf`, `giff`, `hadozee`, `plasmoid`, `thri-kreen`, which have URL `/multiverse/race/...` but `tile-SAS`, so check `tile-MPMM` explicitly!).
4. Extracts `name`, `nameEn`, `sourceBook`, `source`, `dndsuUrl`, `size`, `speeds` (`walk`, `fly`, `swim`, `climb`), `darkvision`, `abilityBonuses`, `languages`, `traits`, `subraces`, `choices`, and `progression` (up to level 20, flagged `minLevel`), discarding any section/subrace containing `Unearthed Arcana`, `UA`, `Homebrew`, `Plane Shift`.
5. Generates stable Latin `id`s (`<slug>` for legacy, `<slug>-mpmm` for MPMM) and subrace `id`s (`high-elf`, `wood-elf`, `drow`, `hill-dwarf`, `mountain-dwarf`, `duergar`, `mark-of-warding`, etc.), merges `aliases` from `dnd5e-character-sheet`, classifies `combatRelevant` conservatively (keeping every mechanical/combat/spell/vision/resistance/movement/rest trait `true` and pure lore/age/alignment/names/languages `false`), and writes `data/races.json` + `data/races-core.json`.

- [ ] **Step 4: Write `src/races.js`, `src/races.d.ts`, `src/races-core.js`, `src/races-core.d.ts`, update `package.json`**

Add exports to `C:\antig\dnd-shared\package.json`:
```json
"./races": { "types": "./src/races.d.ts", "default": "./src/races.js" },
"./races-core": { "types": "./src/races-core.d.ts", "default": "./src/races-core.js" },
"./races.json": "./data/races.json",
"./races-core.json": "./data/races-core.json"
```

- [ ] **Step 5: Run scraper and `dnd-shared` test suite**

Run in `C:\antig\dnd-shared`:
```powershell
python scripts/build-races.py C:\antig\dnd5e-character-sheet
npm test
```
Expected: `84` races parsed (`54` legacy + `30` mpmm), all tests in `test/spells.test.js`, `test/fighter.test.js`, `test/races.test.js` PASS.

- [ ] **Step 6: Commit locally in `dnd-shared` (`main`)**

```powershell
git add .gitignore package.json scripts/build-races.py data/races.json data/races-core.json src/races.js src/races.d.ts src/races-core.js src/races-core.d.ts test/races.test.js
git commit -m "feat: add all 84 official 2014 D&D 5e races and subraces from dnd.su"
```
(Do NOT push yet; remember we link `ai_master_n_battle` to local/committed `dnd-shared` or push only when user allows).

---

### Task 2 (Batch 1a): Базовые расовые примитивы в боевом движке (`types.ts`, `dice.ts`, `feature-mods.ts`, `rules.ts`)

**Files:**
- Modify: `src/lib/combat/types.ts:16-68`
- Modify: `src/lib/dnd/dice.ts:154-201`
- Modify: `src/lib/combat/feature-mods.ts:29-77, 154-210`
- Modify: `src/lib/combat/rules.ts:130-165, 463-560, 620-760`
- Test: `src/lib/combat/__tests__/race-primitives.test.ts`

**Interfaces:**
- Consumes: `Combatant`, `Mods`, `rollD20`, `rollSave`
- Produces:
  - `Combatant`: `race?: string; subrace?: string; raceId?: string; subraceId?: string; darkvision?: number; speeds?: { fly?: number; swim?: number; climb?: number; burrow?: number }; racialVariants?: string[];`
  - `rollD20(modifier?: number, advOrAdvantage?: boolean | "normal" | "advantage" | "disadvantage", disadvantage?: boolean, opts?: { rerollOnes?: boolean }): D20Roll`
  - `Mods`: `rerollOnes?: boolean; saveAdvantageConditions?: string[]; magicSaveAdvantage?: boolean; spellSaveAdvantage?: boolean; sleepImmune?: boolean; unarmedDice?: string;`
  - `modRerollOnes(c: Combatant): boolean`
  - `modConditionSaveAdvantage(c: Combatant, opts: { condition?: string; isSpell?: boolean; isMagical?: boolean }, all?: Combatant[]): boolean`

- [ ] **Step 1: Write failing test `src/lib/combat/__tests__/race-primitives.test.ts`**

Test:
1. `rollD20(3, false, false, { rerollOnes: true })`: when `Math.random` yields `0.0` (natural `1`) then `0.6` (natural `13`), final `d20` is `13`, `total` is `16`, `isFumble` is `false`; if `1` rolls twice in a row (`0.0`, `0.0`), keeps second `1` (5e Halfling *Lucky* rule: reroll once only!).
2. `featureMods("race/halfling/lucky", { rerollOnes: true })`: `modRerollOnes(c)` returns `true`.
3. `featureMods("race/elf/fey-ancestry", { saveAdvantageConditions: ["charmed"], sleepImmune: true })`: `rollSave(c, "WIS", 15, { condition: "charmed" })` gets advantage; `rollSave(c, "WIS", 15)` without `condition: "charmed"` does NOT get advantage.
4. `featureMods("race/gnome/cunning", { magicSaveAdvantage: true })` vs `INT`/`WIS`/`CHA` magical saves -> advantage; vs `DEX` -> no advantage unless `spellSaveAdvantage` (`Satyr` / `Yuan-Ti`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/combat/__tests__/race-primitives.test.ts`
Expected: FAIL (new fields/helpers do not exist yet).

- [ ] **Step 3: Implement minimal primitives across `types.ts`, `dice.ts`, `feature-mods.ts`, `rules.ts`**

1. Extend `Combatant` in `src/lib/combat/types.ts`.
2. Add optional `opts?: { rerollOnes?: boolean }` to `rollD20` in `src/lib/dnd/dice.ts` (reroll each die that lands on `1` at most once).
3. Add `rerollOnes`, `saveAdvantageConditions`, `magicSaveAdvantage`, `spellSaveAdvantage`, `sleepImmune` to `Mods` and expose `modRerollOnes`, `modSaveAdvantageForContext` in `src/lib/combat/feature-mods.ts`.
4. Wire `modRerollOnes` into attack rolls (`performAttack` in `engine.ts` / `rules.ts`) and saving throws (`rollSave` in `rules.ts`), and wire `modSaveAdvantageForContext` into `rollSave` (passing `condition` from `applyEffect`/`rollEffectSave` where effects impose a condition like `"charmed"`, `"frightened"`, `"poisoned"`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/combat/__tests__/race-primitives.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit locally**

```powershell
git add src/lib/combat/types.ts src/lib/dnd/dice.ts src/lib/combat/feature-mods.ts src/lib/combat/rules.ts src/lib/combat/engine.ts src/lib/combat/__tests__/race-primitives.test.ts
git commit -m "feat(combat): add racial primitives for Lucky rerollOnes and conditional save advantages"
```

---

### Task 3 (Batch 1b): Реестр рас `src/lib/combat/races/` и тестовый harness

**Files:**
- Create: `src/lib/combat/races/race-defs.ts`
- Create: `src/lib/combat/races/race-combat.ts`
- Create: `src/lib/combat/races/rules-index.ts`
- Create: `src/lib/combat/races/combat-index.ts`
- Modify: `src/lib/combat/rules.ts:33` (import `./races/rules-index`)
- Modify: `src/lib/combat/classes/combat-index.ts` (import `../races/combat-index`)
- Create: `src/lib/combat/__tests__/helpers/race-harness.ts`
- Test: `src/lib/combat/__tests__/race-registry.test.ts`

**Interfaces:**
- Consumes: `RACES`, `findRace` (from `dnd-shared/races` or synced local fallback JSON during local dev prior to npm publish), `featureMods`, `registerKit`, `registerClassModule`, `Calc`, `Rule`, `OptionRule`.
- Produces:
  - `defineRace(raceId: string, rules: RaceRuleDef)`: registers rules for base race and subraces (`race/<raceId>/<traitId>` / `race/<subraceId>/<traitId>`).
  - `resolveRaceForCharacter(ctx: { race?: string; subrace?: string; level: number; profBonus: number; abilityMods: Record<string, number>; sheet?: Record<string, any> }): ResolvedRaceLoadout` (returns `raceId`, `subraceId`, `abilities: CombatAbility[]`, `naturalAttacks: Attack[]`, `resistances: string[]`, `conditionImmunities: string[]`, `darkvision: number`, `speeds`, `innateSpells: Array<{ spellId: string; level: number; usesMax: number; castingAbility: AbilityKey }>`).
  - `raceHero(raceQuery: string, subraceQuery: string | null, id: string, level: number, o?: RaceHeroOptions): Combatant`

- [ ] **Step 1: Write failing test `src/lib/combat/__tests__/race-registry.test.ts`**

Test that `resolveRaceForCharacter` finds Legacy vs MPMM distinct IDs cleanly, extracts `tokens`/`racialVariants` from `sheet.traitsList` / `sheet.featuresTraits`, respects `level` gating (`minLevel <= level`), scales charges/damage up to level 10+, and connects `races/combat-index.ts` into `classHooks` without duplicating class hooks.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/combat/__tests__/race-registry.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `race-defs.ts`, `race-combat.ts`, `rules-index.ts`, `combat-index.ts`, and `race-harness.ts`**

Reuse `class-defs.ts` (`Calc`, `Rule`, `OptionRule`, `CombatAbility`) and `class-kit.ts` (`registerKit`) directly — no duplicated kit engine! Note: ensure `srdCombatAbilities` / `extractAbilitiesFromCharacter` and `raceAbilitiesForHero` share `resolveAbilityUses`.
Link `dnd-shared` from local `C:\antig\dnd-shared` (or check `npm install C:\antig\dnd-shared` only if needed for local resolution — note: do NOT leave a `file:` dependency in `package.json` on commit if `github:LightSix56/dnd-shared#<sha>` is required for Vercel; copy/sync or update `dnd-shared` commit SHA once user permits pushing `dnd-shared`). **Important:** while `dnd-shared` is not yet pushed to GitHub, either keep an intermediate `src/lib/combat/data/races-2014.json` generated from `dnd-shared` or import via alias/sync script `scripts/sync-dnd-shared-races.mjs` so Vercel & CI never fail if GitHub hasn't been pushed yet!

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/combat/__tests__/race-registry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit locally**

```powershell
git add src/lib/combat/races/ src/lib/combat/rules.ts src/lib/combat/classes/combat-index.ts src/lib/combat/__tests__/helpers/race-harness.ts src/lib/combat/__tests__/race-registry.test.ts
git commit -m "feat(combat): add declarative racial rules registry and race test harness"
```

---

### Task 4 (Batch 1c): Проброс рас в создание бойца (`character-adapter.ts`, `generator.ts`, `import-character/route.ts`)

**Files:**
- Modify: `src/lib/combat/character-adapter.ts`
- Modify: `src/lib/combat/generator.ts:930-945` and `Combatant` creation block
- Modify: `src/app/api/combat/import-character/route.ts:183-185, 344-415`
- Test: `src/lib/combat/__tests__/race-adapter.test.ts`

**Interfaces:**
- Consumes: `resolveRaceForCharacter` (`src/lib/combat/races/race-defs.ts`)
- Produces: `Combatant` created via `createPartyCombatants` or `import-character` automatically receives `race`, `subrace`, `raceId`, `subraceId`, `darkvision`, `speeds`, racial `CombatAbility[]`, innate racial spells, natural weapons (if missing), and racial `damageResistances` (without duplicating existing sheet resistances/attacks).

- [ ] **Step 1: Write failing test `src/lib/combat/__tests__/race-adapter.test.ts`**

Verify:
1. Tiefling at level 1 vs 3 vs 5 receives fire resistance, *Thaumaturgy*, *Hellish Rebuke* (2nd-level cast 1/long at lvl 3+), and *Darkness* (1/long at lvl 5+).
2. Dragonborn at level 1 vs 6 gets `2d6` -> `3d6` breath weapon and elemental resistance matching chosen Draconic Ancestry (`red`/`gold` -> `fire`, `silver`/`white` -> `cold`, etc.).
3. Existing character without `race` still works identically with zero regressions.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/combat/__tests__/race-adapter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Wire `resolveRaceForCharacter` into `character-adapter.ts`, `generator.ts`, and `import-character/route.ts`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/combat/__tests__/race-adapter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit locally**

---

### Task 5 (Batch 1d): Все расы PHB 2014 + их официальные подрасы (`core-phb.ts` + `core-phb-combat.ts`)

Covers every PHB base race and every official 2014 subrace attached to those races on `dnd.su` (`PH14`, `SCAG`, `MTF`, `RLW`, `FTD`, `EGW`, zero `UA`):
1. **Human (`human`):** Standard, Variant (+feat/skill), Mark of Finding, Mark of Handling, Mark of Making, Mark of Passage, Mark of Sentinel.
2. **Dwarf (`dwarf`):** Hill (+1 HP/lvl), Mountain, Duergar (`MTF` — Duergar Resilience + *Enlarge/Reduce* lvl 3 + *Invisibility* lvl 5, Sunlight Sensitivity), Mark of Warding (lvl 1/3/5 spells + Warder's Intuition). All Dwarves: Dwarven Resilience (poison resist + save adv).
3. **Elf (`elf`):** High Elf (cantrip), Wood Elf (35 ft, Mask of the Wild), Drow (`Sunlight Sensitivity`, 120 ft darkvision, *Dancing Lights* + *Faerie Fire* lvl 3 + *Darkness* lvl 5), Sea Elf (`MTF` swim 30 ft), Shadar-kai (`MTF` necrotic resist, *Blessing of the Raven Queen* 1/long bonus teleport + all-damage resist from lvl 3), Eladrin (`MTF` *Fey Step* 1/short + seasonal Autumn/Winter/Spring/Summer rider at lvl 3), Mark of Shadow, Pallid Elf (`EGW`, *Light* + *Sleep* lvl 3 + *Invisibility* lvl 5). All Elves: Fey Ancestry (charmed adv + sleep immunity).
4. **Halfling (`halfling`):** Lightfoot, Stout (poison resist + adv), Ghostwise (`SCAG`), Lotusden (`EGW`, *Druidcraft* + *Entangle* lvl 3 + *Spike Growth* lvl 5), Mark of Hospitality, Mark of Healing. All Halflings: Lucky (`rerollOnes`), Brave (`frightened` save adv).
5. **Dragonborn (`dragonborn`):** PHB Metallic/Chromatic Breath Weapon (`2d6` lvl 1 -> `3d6` lvl 6, save DEX or CON, cone 15 / line 5×30 + resistance) + EGtW Draconblood (`Forceful Presence`) & Ravenite (`Vengeful Assault` reaction melee attack when damaged!) + FTD Chromatic (*Chromatic Warding* lvl 5), Metallic (*Metallic Breath Weapon* lvl 5 — Enervating / Repulsion!), Gem (*Gem Flight* lvl 5 + telepathy + psychic/force/radiant/necrotic/thunder resist).
6. **Gnome (`gnome`):** Forest (*Minor Illusion*), Rock, Deep Gnome / Svirfneblin (`MTF`/`EE`, 120 ft darkvision), Mark of Scribing. All Gnomes: Gnome Cunning (`magicSaveAdvantage` on INT/WIS/CHA).
7. **Half-Elf (`half-elf`):** Standard, Half-Elf Variants (`SCAG`: High/Wood/Drow/Aquatic), Mark of Detection, Mark of Storm. Fey Ancestry.
8. **Half-Orc (`half-orc`):** Standard (*Relentless Endurance* `onDrop` to 1 HP + *Savage Attacks* +1 weapon die on crit!), Mark of Finding.
9. **Tiefling (`tiefling`):** PHB Asmodeus + MTF Bloodlines (Baalzebul, Dispater, Fierna, Glasya, Levistus, Mammon, Mephistopheles, Zariel) + SCAG variants (Feral, Devil's Tongue, Hellfire, Winged — fly 30 ft!). Fire resistance + innate spells lvl 1/3/5.

- [ ] **Step 1: Write failing test `src/lib/combat/__tests__/races-phb.test.ts`** covering every combat mechanic listed above (including level 1, 3, 5, 6, 10 scaling, reactions with and without BG3 prompt, crit extra die, breath weapon cones/lines, `onDrop`).
- [ ] **Step 2: Run test to verify fail (`npx vitest run src/lib/combat/__tests__/races-phb.test.ts`)**
- [ ] **Step 3: Implement `src/lib/combat/races/core-phb.ts` and `src/lib/combat/races/core-phb-combat.ts`**
- [ ] **Step 4: Run PHB tests + full typecheck/lint/suite to verify PASS**
- [ ] **Step 5: Commit locally (`dev`)**

---

### Follow-Up Batches (Queued Sequentially After Task 5 Using Output of Task 1 `races.json`)

Once Task 1 produces the exact audited `data/races.json` of all 84 official 2014 races, generate concrete sub-tasks/tests directly from `data/races.json` without guessing IDs:
- **Batch 2 (`legacy-volo-mtf.ts` + `-combat.ts` + `races-volo.test.ts`):** 20 Legacy races from `VGM`/`MTF`/`POA`/`TCE`/`VRGR` (`aasimar` + 3 subraces + lvl 3 transformations, `goliath` Stone's Endurance reaction, `genasi` 4 subraces, `gith` githyanki/githzerai, `goblin` Fury of the Small + Nimble Escape, `bugbear` Surprise Attack + Long-Limbed, `kobold` Pack Tactics + Grovel/Cower/Beg + Sunlight Sensitivity, `lizardfolk`, `orc`, `tabaxi`, `triton`, `yuan-ti-pureblood`, `firbolg`, `kenku`, `hobgoblin`, `aarakocra`, `dhampir`, `hexblood`, `reborn`, `custom-lineage`).
- **Batch 3 (`legacy-settings.ts` + `-combat.ts` + `races-settings.test.ts`):** All 25 remaining Legacy races (`GGR`, `AI`, `RLW`, `MOT`, `WBW`, `SCC`, `SDQ`, `SAS`, `OGA`, `LR`, `TP`).
- **Batch 4 (`mpmm.ts` + `mpmm-combat.ts` + `races-mpmm.test.ts` + `races-completeness.test.ts`):** All 30 `MPMM` races (`*-mpmm`) + global completeness check asserting 100% of every race/subrace trait in `races.json` is either rule-mapped or explicitly `skip`.

---

## Final Verification Gate (After Each Batch)
```powershell
npx tsc --noEmit
npm run lint
npx vitest run --no-file-parallelism --testTimeout=60000
graphify update .
git status -s
```
Ensure `prisma/schema.prisma` remains unmodified (`git checkout -- prisma/schema.prisma` if Vitest touched it).
