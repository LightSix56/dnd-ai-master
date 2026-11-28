# `dnd-shared` Stage 4 (Feats, Backgrounds, Homebrew Traits, Conditions & Monsters) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. All parallel subagents MUST run on `hydrogen` (`Model: 'inherit'`).

**Goal:** Complete the unification of all remaining D&D 5e (2014) reference catalogs into `dnd-shared` (`./feats`, `./feats-core`, `./backgrounds-core`, `./conditions`, `./monsters`, plus `ALTERNATE_BARBARIAN_TRAITS` in `./homebrew`) and switch both `dnd5e-character-sheet` (`dev`) and `ai_master_n_battle` (`dev`) to consume the final pinned `dnd-shared` SHA (`v1.0.0`).

**Architecture:** `dnd-shared` exports lightweight `-core` modules (`./feats-core`, `./backgrounds-core`, `./conditions`) for `dnd5e-character-sheet`, full `./monsters` strictly for `ai_master_n_battle` (never imported by the sheet), and `ALTERNATE_BARBARIAN_TRAITS` inside `./homebrew`. Both sites keep thin adapters preserving all existing TypeScript exports (`DND_COMPENDIUM_FEATS`, `DND_COMPENDIUM_BACKGROUNDS`, `DND_TRAITS`, `DND_CONDITIONS`, `getAllSRDMonsters`, `getSRDMonster`, `searchSRDMonsters`).

**Tech Stack:** Node.js ESM (`node --test`), Python 3, TypeScript 5, Next.js 16, `tsx --test`, Vitest.

**Spec:** [2026-11-28-dnd-shared-unification-design.md](file:///c:/antig/ai_master_n_battle/docs/superpowers/specs/2026-11-28-dnd-shared-unification-design.md)

## Global Constraints

- `-core` exports (`./feats-core`, `./backgrounds-core`, `./conditions`) MUST NOT contain `combat`, `combatSource`, `masterRecord`, or `monsters`.
- `dnd5e-character-sheet` MUST NEVER import `dnd-shared/monsters`.
- Static JSON imports MUST use `with { type: "json" }` (NO `node:module` `createRequire`).
- Both consumer repos pin `"dnd-shared": "git+https://github.com/LightSix56/dnd-shared.git#<SHA>"` (`0` `git+ssh` entries in `package-lock.json`).
- Both consumer repos push ONLY to `dev` (never `main`); in `ai_master_n_battle`, unrelated uncommitted `src/lib/combat/procgen/*` and `src/app/dev-maps/*` files MUST NOT be staged or modified.
- All parallel subagents MUST run on `hydrogen` (`Model: 'inherit'`).

---

## File Structure

- `C:\antig\dnd-shared`:
  - Create: `scripts/build-stage4.py`, `data/feats-core.json`, `data/backgrounds-core.json`, `data/conditions.json`, `data/monsters.json`, `data/homebrew-traits.json`, `src/feats-core.js`, `src/feats-core.d.ts`, `src/feats.js`, `src/feats.d.ts`, `src/backgrounds-core.js`, `src/backgrounds-core.d.ts`, `src/conditions.js`, `src/conditions.d.ts`, `src/monsters.js`, `src/monsters.d.ts`, `test/stage4.test.js`
  - Modify: `src/homebrew.js`, `src/homebrew.d.ts`, `test/homebrew.test.js`, `package.json` (`1.0.0`)
- `C:\antig\dnd5e-character-sheet` (branch `dev`):
  - Modify: `package.json`, `package-lock.json`, `src/data/compendium/feats.ts`, `src/data/compendium/backgrounds.ts`, `src/data/dnd-traits.ts`, `src/lib/dnd-types.ts` (`DND_CONDITIONS` imported from `dnd-shared/conditions`)
  - Create: `test/dnd-shared-stage4.test.ts`
- `c:\antig\ai_master_n_battle` (branch `dev`):
  - Modify: `package.json`, `package-lock.json`, `src/lib/combat/srd/adapter.ts`
  - Delete: `src/lib/combat/srd/data/monsters.json`, `src/lib/combat/srd/data/conditions.json`

---

### Task 1: `dnd-shared` — Build Feats, Backgrounds, Homebrew Traits, Conditions & Monsters (`v1.0.0`) & Push `<SHA_4>`

**Files:**
- Create: `C:\antig\dnd-shared\scripts\build-stage4.py`
- Create: `C:\antig\dnd-shared\data\{feats-core,backgrounds-core,conditions,monsters,homebrew-traits}.json`
- Create: `C:\antig\dnd-shared\src\{feats-core,feats,backgrounds-core,conditions,monsters}.{js,d.ts}`
- Create: `C:\antig\dnd-shared\test\stage4.test.js`
- Modify: `C:\antig\dnd-shared\src\homebrew.{js,d.ts}`, `test\homebrew.test.js`, `package.json`

**Interfaces:**
- `dnd-shared/feats-core` & `dnd-shared/feats`: `CORE_FEATS` / `FEATS` (112+ entries: 105 feats + 7 core class traits), `findCoreFeat(query)` / `findFeat(query)`
- `dnd-shared/backgrounds-core`: `CORE_BACKGROUNDS`, `findCoreBackground(query)`
- `dnd-shared/conditions`: `CONDITIONS` (15 PHB conditions with `id`, `name`, `nameEn`, `description`, `rulesSummary`, `desc`), `findCondition(query)`
- `dnd-shared/monsters`: `MONSTERS` (325+ SRD monsters), `findMonster(query)`, `searchMonsters(query, filters)`
- `dnd-shared/homebrew`: adds `ALTERNATE_BARBARIAN_TRAITS` (`DndTrait[]` compatible)

- [ ] **Step 1: Write failing tests in `C:\antig\dnd-shared\test\stage4.test.js` and `test\homebrew.test.js`**

Assert:
1. `CORE_FEATS.length >= 112` (105 feats `Черта`/`Расовое` + 7 `Классовое`), zero forbidden keys (`combat`, `combatSource`, `masterRecord`, `monsters`).
2. `CORE_BACKGROUNDS.length >= 15` (all backgrounds from `backgrounds.ts`), `findCoreBackground('Аколит')?.id === 'acolyte'`.
3. `CONDITIONS.length === 15`, each has Russian `name`, `nameEn`, `description`, `rulesSummary`, and `desc`; `findCondition('Ослеплён')?.id === 'blinded'`.
4. `MONSTERS.length >= 320`, `findMonster('Goblin')?.hpMax === 7`, `searchMonsters('', { type: 'dragon' }).length > 20`.
5. `ALTERNATE_BARBARIAN_TRAITS` exported from `dnd-shared/homebrew` with `Ярость`, `Безрассудная атака`, `Неистовство`.

Run: `node --test test/stage4.test.js test/homebrew.test.js` -> Expected: FAIL.

- [ ] **Step 2: Write `scripts/build-stage4.py` and generate all 5 JSON files**

Extract cleanly from:
- `C:\antig\dnd5e-character-sheet\src\data\compendium\feats.ts` -> `data/feats-core.json`
- `C:\antig\dnd5e-character-sheet\src\data\compendium\backgrounds.ts` -> `data/backgrounds-core.json`
- `C:\antig\dnd5e-character-sheet\src\data\dnd-traits.ts` (`ALTERNATE_BARBARIAN_TRAITS`) -> `data/homebrew-traits.json`
- `C:\antig\dnd5e-character-sheet\src\lib\dnd-types.ts` (`DND_CONDITIONS`) + `c:\antig\ai_master_n_battle\src\lib\combat\srd\data\conditions.json` -> `data/conditions.json` (15 paired conditions)
- `c:\antig\ai_master_n_battle\src\lib\combat\srd\data\monsters.json` -> `data/monsters.json`

- [ ] **Step 3: Implement `src/{feats-core,feats,backgrounds-core,conditions,monsters}.{js,d.ts}`, update `src/homebrew.{js,d.ts}` & `package.json` (`1.0.0`)**

Use static `with { type: "json" }` imports. Add `./feats`, `./feats-core`, `./backgrounds-core`, `./conditions`, `./monsters`, and JSON subpaths to `package.json`.

- [ ] **Step 4: Run `node --test test/*.test.js` and `tsc --noEmit --strict --moduleResolution bundler` on all `src/*.d.ts`, commit, push `origin/main`, record `<SHA_4>`**

---

### Task 2: `dnd5e-character-sheet` (`dev`) — Migrate Feats, Backgrounds, Traits & Conditions to `<SHA_4>` [Parallel Agent A, Hydrogen]

**Subagent:** `invoke_subagent` with `Model: 'inherit'` (Hydrogen), `TypeName: 'self'`, `Role: 'Sheet Stage 4 Integrator'`, `Workspace: 'inherit'`.

**Files:**
- Modify: `C:\antig\dnd5e-character-sheet\package.json`, `package-lock.json`, `src/data/compendium/feats.ts`, `src/data/compendium/backgrounds.ts`, `src/data/dnd-traits.ts`, `src/lib/dnd-types.ts`
- Create: `C:\antig\dnd5e-character-sheet\test\dnd-shared-stage4.test.ts`

- [ ] **Step 1: Install `"git+https://github.com/LightSix56/dnd-shared.git#<SHA_4>"` on `dev` (verify 0 `git+ssh`)**
- [ ] **Step 2: Write failing `test/dnd-shared-stage4.test.ts` (RED) verifying `DND_COMPENDIUM_FEATS` (`>= 112`, 105 feats + 7 traits), `DND_COMPENDIUM_BACKGROUNDS`, `ALTERNATE_BARBARIAN_TRAITS`, `DND_CONDITIONS` (15), zero `combat`/`masterRecord`/`monsters` in `-core` imports, and zero `dnd-shared/monsters` imports anywhere in `src/`**
- [ ] **Step 3: Replace hardcoded arrays in `feats.ts` (`CORE_FEATS`), `backgrounds.ts` (`CORE_BACKGROUNDS`), `dnd-traits.ts` (`ALTERNATE_BARBARIAN_TRAITS` from `dnd-shared/homebrew`), and `src/lib/dnd-types.ts` (`DND_CONDITIONS` mapped from `CONDITIONS` in `dnd-shared/conditions`), preserving all exported helper functions (`findFeatByName`, `getFeats`, `getTraits`, `findBackgroundById`, `findBackgroundByName`, `findTraitByName`, `isConditionIncapacitating`, etc.)**
- [ ] **Step 4: Run `npm run typecheck`, `npm run lint`, `npx tsx --test` across Stage 4 + `feats-compendium-adversarial.test.ts`, `alternate-barbarian-traits.test.ts`, `alternate-barbarian-and-scourgeborne.test.ts`, `dnd-shared-core-bundle.test.ts`, `dnd-shared-stage2.test.ts`, `dnd-shared-stage3.test.ts`, and `npm run build`**
- [ ] **Step 5: Run `graphify update .`, commit, and push to `origin dev`**

---

### Task 3: `ai_master_n_battle` (`dev`) — Migrate `srd/adapter.ts` Monsters to `dnd-shared/monsters` (`<SHA_4>`) [Parallel Agent B, Hydrogen]

**Subagent:** `invoke_subagent` with `Model: 'inherit'` (Hydrogen), `TypeName: 'self'`, `Role: 'Master Stage 4 Integrator'`, `Workspace: 'inherit'`.

**Files:**
- Modify: `c:\antig\ai_master_n_battle\package.json`, `package-lock.json`, `src/lib/combat/srd/adapter.ts`
- Delete: `c:\antig\ai_master_n_battle\src\lib\combat\srd\data\monsters.json`, `c:\antig\ai_master_n_battle\src\lib\combat\srd\data\conditions.json`

- [ ] **Step 1: Install `"git+https://github.com/LightSix56/dnd-shared.git#<SHA_4>"` (verify 0 `git+ssh`)**
- [ ] **Step 2: Switch `src/lib/combat/srd/adapter.ts` from `./data/monsters.json` to `MONSTERS` from `dnd-shared/monsters` (preserving `getAllSRDMonsters`, `getSRDMonster`, `searchSRDMonsters`, and `DEFAULT_PRESETS`), and delete `src/lib/combat/srd/data/monsters.json` and `src/lib/combat/srd/data/conditions.json`**
- [ ] **Step 3: Run `npx tsc --noEmit`, `npm run lint`, Vitest suites (`srd-compendium.test.ts`, `shared-spells.test.ts`, `race-registry.test.ts`, `fighter-subclasses.test.ts`, `barbarian.test.ts`, `rogue-archetypes.test.ts`), revert `prisma/schema.prisma`, and run `npm run build`**
- [ ] **Step 4: Run `graphify update .`, stage ONLY Stage 4 files (NEVER `git add .` — leave `procgen/*`, `dev-maps/` untouched!), commit, and push to `origin dev`**

---

### Task 4: Final Cross-Repo Verification & Unification Close-Out

- [ ] **Step 1: Verify clean git status, matching `<SHA_4>` (`v1.0.0`) pin via `git+https://`, zero `git+ssh`, and zero `dnd-shared/monsters` imports in `dnd5e-character-sheet`**
