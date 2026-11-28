# `dnd-shared` Stage 2 (13 Classes, 118+ Subclasses, Progression, Spells & Full Homebrew) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. All parallel subagents MUST run on `hydrogen` (`Model: 'inherit'`).

**Goal:** Move all 13 official D&D 5e (2014) classes, all official subclasses (115 existing + `banneret`, `graviturgy`, `lunar-sorcery` = 118+), class progression (1–20), subclass expanded spell lists, Warlock choices, and all remaining homebrew (`alt-barbarian`, `barbarian-exploits`, `mousefolk`, `ratfolk`) into `dnd-shared`, then switch both `dnd5e-character-sheet` (`dev`) and `ai_master_n_battle` (`dev`) to consume the pinned `dnd-shared` SHA.

**Architecture:** `dnd-shared` exposes `./classes` (`CLASSES`, `SUBCLASSES`, `findClass`, `findSubclass` for combat adapters), `./classes-core` (`CORE_CLASSES`, `CLASS_PROGRESSION`, `SUBCLASS_EXPANDED_SPELLS`, `SUBCLASS_FULL_CLASS_SPELLS`, `WARLOCK_INVOCATIONS`, `WARLOCK_PACT_BOONS`, `GENIE_KINDS`, `WARLOCK_MYSTIC_ARCANUM_SPELLS`), and `./homebrew` (`HOMEBREW_RACES`, `HOMEBREW_CLASSES`, `HOMEBREW_CLASS_PROGRESSION`, `BARBARIAN_EXPLOITS`), using static `import ... with { type: "json" }`. Both consumer sites keep thin adapters preserving existing TypeScript signatures and function exports.

**Tech Stack:** Node.js ESM (`node --test`), Python 3, TypeScript 5, Next.js 16, `tsx --test` (`dnd5e-character-sheet`), Vitest (`ai_master_n_battle`).

**Spec:** [2026-11-28-dnd-shared-unification-design.md](file:///c:/antig/ai_master_n_battle/docs/superpowers/specs/2026-11-28-dnd-shared-unification-design.md)

## Global Constraints

- Canonical source for official D&D 5e (2014) content is `dnd.su` (2014 edition; no UA, Plane Shift, PH24).
- All official classes, subclasses, and features must be present with full Russian names and descriptions (`banneret`, `graviturgy`, and `lunar-sorcery` included).
- `-core` exports MUST NOT contain `combat`, `combatSource`, `masterRecord`, or `monsters`.
- Homebrew (`scourgeborne`, `mousefolk`, `ratfolk`, `alt-barbarian`, `barbarian-exploits`) MUST stay isolated in `dnd-shared/homebrew` (`isHomebrew: true`) so official `CLASSES` stays strictly 13 classes and `RACES` stays strictly 84 races.
- Static JSON imports MUST use `with { type: "json" }` (NO `node:module` `createRequire`).
- Both consumer repos pin `"dnd-shared": "git+https://github.com/LightSix56/dnd-shared.git#<SHA>"` (`0` `git+ssh` entries in `package-lock.json`).
- Both consumer repos push ONLY to `dev` (never `main`); in `ai_master_n_battle`, unrelated uncommitted `src/lib/combat/procgen/*` and `src/app/dev-maps/*` files MUST NOT be staged or modified.
- All parallel subagents MUST run on `hydrogen` (`Model: 'inherit'`).

---

## File Structure

- `C:\antig\dnd-shared`:
  - Create: `scripts/build-classes.py`, `data/classes.json`, `data/classes-core.json`, `data/class-progression.json`, `data/class-spells.json`, `data/warlock-choices.json`, `data/homebrew-classes.json`, `src/classes.js`, `src/classes.d.ts`, `src/classes-core.js`, `src/classes-core.d.ts`, `src/class-search.js`, `test/classes.test.js`
  - Modify: `data/homebrew-races.json`, `src/homebrew.js`, `src/homebrew.d.ts`, `test/homebrew.test.js`, `package.json`
- `C:\antig\dnd5e-character-sheet` (branch `dev`):
  - Modify: `package.json`, `package-lock.json`, `src/data/compendium/classes.ts`, `src/data/compendium/class-progression.ts`, `src/data/compendium/class-spells.ts`, `src/data/compendium/warlock-choices.ts`, `src/data/compendium/barbarian-exploits.ts`, `src/data/compendium/races/index.ts`, `test/fighter-subclasses.test.ts`, `test/wizard-subclasses.test.ts`, `test/sorcerer-subclasses.test.ts`
  - Delete: `src/data/compendium/races/local-homebrew.ts`
  - Create: `test/dnd-shared-stage2.test.ts`
- `c:\antig\ai_master_n_battle` (branch `dev`):
  - Modify: `package.json`, `package-lock.json`, `src/lib/combat/class-defs.ts`
  - Delete: `src/lib/combat/data/class-subclasses.json`, `scripts/import-sheet-classes.mjs`

---

### Task 1: `dnd-shared` — Build Official 13 Classes, 118+ Subclasses, Progression, Spells & Warlock Choices

**Files:**
- Create: `C:\antig\dnd-shared\scripts\build-classes.py`
- Create: `C:\antig\dnd-shared\data\classes.json`, `data\classes-core.json`, `data\class-progression.json`, `data\class-spells.json`, `data\warlock-choices.json`
- Create: `C:\antig\dnd-shared\src\class-search.js`, `src\classes.js`, `src\classes.d.ts`, `src\classes-core.js`, `src\classes-core.d.ts`
- Create: `C:\antig\dnd-shared\test\classes.test.js`
- Modify: `C:\antig\dnd-shared\package.json`

**Interfaces:**
- Produces in `dnd-shared/classes`: `CLASSES: ClassData[]` (13 official classes), `SUBCLASSES: FlatSubclassData[]` (with `classId`, `className`, `id`, `name`, `nameEn`, `source`, `features` preserving exact feature names expected by `ai_master_n_battle/src/lib/combat/classes/{barbarian,rogue}.ts`), `findClass(query)`, `findSubclass(classId, query)`
- Produces in `dnd-shared/classes-core`: `CORE_CLASSES: CoreClass[]`, `CLASS_PROGRESSION: Record<string, ClassLevelProgression>`, `SUBCLASS_EXPANDED_SPELLS: Record<string, string[]>`, `SUBCLASS_FULL_CLASS_SPELLS: Record<string, string>`, `WARLOCK_INVOCATIONS`, `WARLOCK_PACT_BOONS`, `GENIE_KINDS`, `WARLOCK_MYSTIC_ARCANUM_SPELLS`, `findCoreClass(query)`, `findCoreSubclass(classId, query)`

- [ ] **Step 1: Write failing test `C:\antig\dnd-shared\test\classes.test.js`**

Verify:
1. `CLASSES.length === 13` (no `alt-barbarian`), all 13 official classes present.
2. `SUBCLASSES.length >= 118`, including Fighter `banneret` (`Рыцарь Пурпурного дракона`), Wizard `graviturgy`, and Sorcerer `lunar-sorcery`.
3. Every class, subclass, and feature has non-empty `id`/`name`/`description` with no leftover HTML tags.
4. `CORE_CLASSES` has constructor fields (`emoji`, `role`, `hitDieSize`, `primaryAbility`, `savingThrowProfs`, `startingEquipment`, `recommendedScores`, `subclasses`) and no `combat` fields.
5. `CLASS_PROGRESSION` has all 13 official class keys; `WARLOCK_INVOCATIONS.length >= 45`; `SUBCLASS_EXPANDED_SPELLS` and `SUBCLASS_FULL_CLASS_SPELLS` are populated.

Run: `node --test test/classes.test.js` -> Expected: FAIL (`Cannot find module '../src/classes.js'`).

- [ ] **Step 2: Write `scripts/build-classes.py` and generate `data/classes*.json`, `data/class-progression.json`, `data/class-spells.json`, `data/warlock-choices.json`**

Build self-contained JSON datasets from `C:\antig\dnd5e-character-sheet\src\data\compendium\{classes,class-progression,class-spells,warlock-choices}.ts` (excluding `alt-barbarian`), plus:
- Fighter `banneret` (`Рыцарь Пурпурного дракона`) merged from `data/fighter.json` (preserving `classes.ts` features for all other 9 fighter subclasses so `fighter-subclasses.test.ts` stays compatible while gaining `banneret` = 10 subclasses).
- Wizard `graviturgy` (`Гравитургия` / `Магия гравитургии`, EGW) and Sorcerer `lunar-sorcery` (`Лунное чародейство`, DSQ) parsed from `https://dnd.su/class/` (with full Russian feature descriptions for levels 2/6/10/14 and 1/6/14/18; if `dnd.su` is unreachable, verify or fail loudly — do not invent descriptions!).
- Preserve exact `feature.name` strings on all 115 existing subclasses so `ai_master_n_battle`'s `barbarian.ts` and `rogue.ts` lookups do not break.

- [ ] **Step 3: Implement `src/class-search.js`, `src/classes.*`, `src/classes-core.*`, and update `package.json`**

Use static `import ... with { type: "json" }` everywhere. Add `./classes`, `./classes-core`, `./classes.json`, `./classes-core.json` to `package.json`.

- [ ] **Step 4: Run tests and TypeScript check, then commit locally**

Run in `C:\antig\dnd-shared`:
`node --test test/*.test.js` and `npx tsc --noEmit --skipLibCheck --target es2022 --module esnext src/classes.d.ts src/classes-core.d.ts`
Commit locally (`feat(classes): add 13 official classes, 118+ subclasses, progression, and warlock choices`).

---

### Task 2: `dnd-shared` — Consolidate All Homebrew (`mousefolk`, `ratfolk`, `alt-barbarian`, `barbarian-exploits`) & Push `<SHA_2>`

**Files:**
- Modify: `C:\antig\dnd-shared\data\homebrew-races.json`
- Create: `C:\antig\dnd-shared\data\homebrew-classes.json`
- Modify: `C:\antig\dnd-shared\src\homebrew.js`, `src\homebrew.d.ts`, `test\homebrew.test.js`, `package.json`

**Interfaces:**
- Produces in `dnd-shared/homebrew`: `HOMEBREW_RACES` (`scourgeborne`, `mousefolk`, `ratfolk`), `HOMEBREW_CLASSES` (`alt-barbarian` with 19 subclasses), `HOMEBREW_CLASS_PROGRESSION` (`Альтернативный варвар`), `BARBARIAN_EXPLOITS` (all Savage Exploits).

- [ ] **Step 1: Add failing tests in `C:\antig\dnd-shared\test\homebrew.test.js`**

Assert `HOMEBREW_RACES` contains `scourgeborne`, `mousefolk` (3 subraces, `speed: 20`, `size: 'Крошечный'`), `ratfolk` (`SIL: -2`), `HOMEBREW_CLASSES` contains `alt-barbarian` (19 subclasses), `HOMEBREW_CLASS_PROGRESSION['Альтернативный варвар']` exists, and `BARBARIAN_EXPLOITS.length > 0` across degrees `1..5`, while `RACES.length === 84` and `CLASSES.length === 13`.

Run: `node --test test/homebrew.test.js` -> Expected: FAIL.

- [ ] **Step 2: Populate `data/homebrew-races.json` and `data/homebrew-classes.json`, update `src/homebrew.*` and `package.json` (`0.7.0`)**

Use static `with { type: "json" }` imports. Ensure `mousefolk` (`field-mouse` with `speeds: { walk: 30 }`) and `ratfolk` (`abilityBonuses: { ЛОВ: 2, ИНТ: 1, СИЛ: -2 }`, `aliases: ["Крысолюд"]`) match all assertions of `test/races-mousefolk-ratfolk.test.ts`.

- [ ] **Step 3: Run full `node --test` and `tsc --noEmit`, commit, and push `dnd-shared` to `origin/main`**

Clear proxy (`$env:HTTPS_PROXY=""; $env:HTTP_PROXY=""`), commit, push `origin main`, and record `<SHA_2>`.

---

### Task 3: `dnd5e-character-sheet` (`dev`) — Migrate Classes, Progression, Spells, Warlock Choices & Homebrew to `<SHA_2>` [Parallel Agent A, Hydrogen]

**Subagent:** `invoke_subagent` with `Model: 'inherit'` (Hydrogen), `TypeName: 'self'`, `Role: 'Sheet Stage 2 Integrator'`, `Workspace: 'inherit'`.

**Files:**
- Modify: `C:\antig\dnd5e-character-sheet\package.json`, `package-lock.json`
- Modify: `src\data\compendium\classes.ts`, `class-progression.ts`, `class-spells.ts`, `warlock-choices.ts`, `barbarian-exploits.ts`, `races\index.ts`
- Delete: `src\data\compendium\races\local-homebrew.ts`
- Modify tests: `test\fighter-subclasses.test.ts` (9 -> 10 with `banneret`), `test\wizard-subclasses.test.ts` (12 -> 13 with `graviturgy`), `test\sorcerer-subclasses.test.ts` (7 -> 8 with `lunar-sorcery`)
- Create test: `test\dnd-shared-stage2.test.ts`

- [ ] **Step 1: Install `"git+https://github.com/LightSix56/dnd-shared.git#<SHA_2>"` on `dev` (verify 0 `git+ssh` in `package-lock.json`)**
- [ ] **Step 2: Write failing `test/dnd-shared-stage2.test.ts` (RED) asserting 14 classes (13 official + `alt-barbarian`), `banneret`, `graviturgy`, `lunar-sorcery`, `mousefolk`/`ratfolk` from `dnd-shared/homebrew`, and zero `combat` fields**
- [ ] **Step 3: Replace hardcoded data in `classes.ts`, `class-progression.ts`, `class-spells.ts`, `warlock-choices.ts`, `barbarian-exploits.ts`, `races/index.ts` with thin adapters over `dnd-shared/classes-core` + `dnd-shared/homebrew`, preserving all exported helper functions; delete `local-homebrew.ts`**
- [ ] **Step 4: Update subclass counts in `fighter-subclasses.test.ts`, `wizard-subclasses.test.ts`, `sorcerer-subclasses.test.ts` for the newly complete official subclasses**
- [ ] **Step 5: Run `npm run typecheck`, `npm run lint`, `npx tsx --test` on Stage 2 + existing class/race/wizard/levelup suites, and `npm run build`**
- [ ] **Step 6: Run `graphify update .`, commit, and push to `origin dev`**

---

### Task 4: `ai_master_n_battle` (`dev`) — Migrate `class-defs.ts` to `dnd-shared/classes` (`<SHA_2>`) [Parallel Agent B, Hydrogen]

**Subagent:** `invoke_subagent` with `Model: 'inherit'` (Hydrogen), `TypeName: 'self'`, `Role: 'Master Stage 2 Integrator'`, `Workspace: 'inherit'`.

**Files:**
- Modify: `c:\antig\ai_master_n_battle\package.json`, `package-lock.json`, `src\lib\combat\class-defs.ts`
- Delete: `c:\antig\ai_master_n_battle\src\lib\combat\data\class-subclasses.json`, `c:\antig\ai_master_n_battle\scripts\import-sheet-classes.mjs`

- [ ] **Step 1: Install `"git+https://github.com/LightSix56/dnd-shared.git#<SHA_2>"` (verify 0 `git+ssh` in `package-lock.json`)**
- [ ] **Step 2: Switch `src/lib/combat/class-defs.ts` from `./data/class-subclasses.json` to `SUBCLASSES` from `dnd-shared/classes`, and delete `class-subclasses.json` + `scripts/import-sheet-classes.mjs`**
- [ ] **Step 3: Run `npx tsc --noEmit`, `npm run lint`, Vitest suites (`barbarian.test.ts`, `rogue-archetypes.test.ts`, `rogue-tasha.test.ts`, `fighter-subclasses.test.ts`, `class-features.test.ts`, `srd-compendium.test.ts`), revert `prisma/schema.prisma` (`git checkout -- prisma/schema.prisma`), and run `npm run build`**
- [ ] **Step 4: Run `graphify update .`, stage ONLY Stage 2 files (NEVER `git add .` — leave `procgen/*`, `dev-maps/` untouched!), commit, and push to `origin dev`**

---

### Task 5: Cross-Repo Stage 2 Verification

- [ ] **Step 1: Verify clean git status and identical `<SHA_2>` pin via `git+https://` in both consumer repos on `dev`**
