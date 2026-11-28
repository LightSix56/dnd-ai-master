# `dnd-shared` Stage 3 (Weapons, Armors, Gear, Tools & Potions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. All parallel subagents MUST run on `hydrogen` (`Model: 'inherit'`).

**Goal:** Unify all 37 official weapons, armors, shields, adventuring gear, tools, magic items, and official potions into `dnd-shared` (`./items` and `./items-core`) and switch both `dnd5e-character-sheet` (`dev`) and `ai_master_n_battle` (`dev`) to consume the pinned `dnd-shared` SHA without breaking OOP potion models, weapon lookup, or SRD combat weapons.

**Architecture:** `dnd-shared` stores canonical `weapons.json` / `weapons-core.json` (37 PHB weapons + optional `combat`/`masterRecord` matching `equipment.json`), `items-core.json` (armors, shields, gear, tools, magic items), and `potions-core.json` (typed JSON specs for healing/buff/utility potions). `dnd5e-character-sheet` wraps these via thin adapters preserving `DND_WEAPONS`, `DND_COMPENDIUM_ITEMS`, `OFFICIAL_POTIONS` (OOP `HealingPotion`/`BuffPotion`/`UtilityPotion`), and all helper functions. `ai_master_n_battle` switches `src/lib/combat/srd/adapter.ts` from `./data/equipment.json` to `dnd-shared/items` and deletes `src/lib/combat/srd/data/equipment.json`.

**Tech Stack:** Node.js ESM (`node --test`), Python 3, TypeScript 5, Next.js 16, `tsx --test`, Vitest.

**Spec:** [2026-11-28-dnd-shared-unification-design.md](file:///c:/antig/ai_master_n_battle/docs/superpowers/specs/2026-11-28-dnd-shared-unification-design.md)

## Global Constraints

- `-core` exports (`dnd-shared/items-core`) MUST NOT contain `combat`, `combatSource`, `masterRecord`, or `monsters`.
- Static JSON imports MUST use `with { type: "json" }` (NO `node:module` `createRequire`).
- All 37 PHB weapons (`DND_WEAPONS.length === 37`) and all official SRD combat weapons (`>= 37`) must match existing sheet & master tests 1:1.
- Both consumer repos pin `"dnd-shared": "git+https://github.com/LightSix56/dnd-shared.git#<SHA>"` (`0` `git+ssh` entries in `package-lock.json`).
- Both consumer repos push ONLY to `dev` (never `main`); in `ai_master_n_battle`, unrelated uncommitted `src/lib/combat/procgen/*` and `src/app/dev-maps/*` files MUST NOT be staged or modified.
- All parallel subagents MUST run on `hydrogen` (`Model: 'inherit'`).

---

## File Structure

- `C:\antig\dnd-shared`:
  - Create: `scripts/build-items.py`, `data/weapons.json`, `data/weapons-core.json`, `data/items-core.json`, `data/potions-core.json`, `src/item-search.js`, `src/items.js`, `src/items.d.ts`, `src/items-core.js`, `src/items-core.d.ts`, `test/items.test.js`
  - Modify: `package.json` (`0.8.0`, `./items`, `./items-core`, `./weapons.json`, `./items-core.json`, `./potions-core.json`)
- `C:\antig\dnd5e-character-sheet` (branch `dev`):
  - Modify: `package.json`, `package-lock.json`, `src/data/dnd-weapons.ts`, `src/data/compendium/items.ts`, `src/data/compendium/potions-data.ts`
  - Create: `test/dnd-shared-stage3.test.ts`
- `c:\antig\ai_master_n_battle` (branch `dev`):
  - Modify: `package.json`, `package-lock.json`, `src/lib/combat/srd/adapter.ts`
  - Delete: `src/lib/combat/srd/data/equipment.json`

---

### Task 1: `dnd-shared` — Build Weapons, Armors/Items & Potions (`./items`, `./items-core`) & Push `<SHA_3>`

**Files:**
- Create: `C:\antig\dnd-shared\scripts\build-items.py`
- Create: `C:\antig\dnd-shared\data\weapons.json`, `data\weapons-core.json`, `data\items-core.json`, `data\potions-core.json`
- Create: `C:\antig\dnd-shared\src\item-search.js`, `src\items.js`, `src\items.d.ts`, `src\items-core.js`, `src\items-core.d.ts`
- Create: `C:\antig\dnd-shared\test\items.test.js`
- Modify: `C:\antig\dnd-shared\package.json`

**Interfaces:**
- Produces in `dnd-shared/items-core`: `CORE_WEAPONS` (37 PHB weapons), `CORE_ITEMS` (armors, shields, gear, tools, magic items, base potions), `CORE_POTIONS` (typed `healing`/`buff`/`utility` specs), `findCoreWeapon(query)`, `findCoreItem(query)`
- Produces in `dnd-shared/items`: `WEAPONS` (37 weapons + `masterRecord` + `combat` matching `equipment.json`), `SRD_WEAPONS` (array matching `SRDWeapon[]` 1:1 in order), `ITEMS` (`CORE_ITEMS`), `POTIONS` (`CORE_POTIONS`), `findWeapon(query)`, `findItem(query)`

- [ ] **Step 1: Write failing test `C:\antig\dnd-shared\test\items.test.js`**

Assert:
1. `CORE_WEAPONS.length === 37` and `WEAPONS.length === 37`, with zero `combat`/`masterRecord`/`combatSource`/`monsters` in `CORE_WEAPONS`, `CORE_ITEMS`, and `CORE_POTIONS`.
2. `SRD_WEAPONS.length >= 37` matching `equipment.json` fields (`id`, `name`, `nameEn`, `kind`, `attackBonus`, `damage`, `rangeNormal`, `finesse`, `versatile`, `actionCost`, `category`).
3. `findCoreWeapon('2 ручных топора')?.name === 'Ручной топор'`, `findCoreWeapon('Длинное копьё')?.damageDice === '1d12'`, `findCoreItem('Кожаный доспех')?.armor?.baseAC === 11`.
4. `CORE_POTIONS.length >= 20` covering `'healing'`, `'buff'`, and `'utility'` kinds with `potion-healing` formula `'2d4+2'`.

Run: `node --test test/items.test.js` -> Expected: FAIL.

- [ ] **Step 2: Write `scripts/build-items.py` and generate `data/{weapons,weapons-core,items-core,potions-core}.json`**

Extract:
- `DND_WEAPONS` from `C:\antig\dnd5e-character-sheet\src\data\dnd-weapons.ts` + `equipment.json` from `c:\antig\ai_master_n_battle\src\lib\combat\srd\data\equipment.json`, pairing all 37 weapons by `nameEn`/`name` so every weapon has both sheet fields (`category`, `damageDice`, `damageType`, `properties`, `finesse`, `versatileDice`, `rangeNormal`, `rangeLong`, `cost`, `weight`, `aliases`, `specialGrip`) AND `masterRecord`/`combat` in `weapons.json` (stripped from `weapons-core.json`).
- `DND_COMPENDIUM_ITEMS` (armors, shields, potions, magic items, gear, tools) from `C:\antig\dnd5e-character-sheet\src\data\compendium\items.ts`.
- `OFFICIAL_POTIONS` from `C:\antig\dnd5e-character-sheet\src\data\compendium\potions-data.ts` (`HealingPotion` -> `kind: "healing"`, `BuffPotion` -> `kind: "buff"`, `UtilityPotion` -> `kind: "utility"`).

- [ ] **Step 3: Implement `src/item-search.js`, `src/items.*`, `src/items-core.*`, update `package.json` (`0.8.0`)**

Use static `with { type: "json" }` imports. Add `./items`, `./items-core`, `./weapons.json`, `./items-core.json`, `./potions-core.json` to `package.json`.

- [ ] **Step 4: Run `node --test test/*.test.js` and `tsc --noEmit` on all `.d.ts` files, commit, push to `origin/main`, and record `<SHA_3>`**

---

### Task 2: `dnd5e-character-sheet` (`dev`) — Migrate `dnd-weapons.ts`, `items.ts`, `potions-data.ts` to `<SHA_3>` [Parallel Agent A, Hydrogen]

**Subagent:** `invoke_subagent` with `Model: 'inherit'` (Hydrogen), `TypeName: 'self'`, `Role: 'Sheet Stage 3 Integrator'`, `Workspace: 'inherit'`.

**Files:**
- Modify: `C:\antig\dnd5e-character-sheet\package.json`, `package-lock.json`, `src/data/dnd-weapons.ts`, `src/data/compendium/items.ts`, `src/data/compendium/potions-data.ts`
- Create: `C:\antig\dnd5e-character-sheet\test\dnd-shared-stage3.test.ts`

- [ ] **Step 1: Install `"git+https://github.com/LightSix56/dnd-shared.git#<SHA_3>"` on `dev` (verify 0 `git+ssh`)**
- [ ] **Step 2: Write failing `test/dnd-shared-stage3.test.ts` (RED) checking `DND_WEAPONS` (37), `DND_COMPENDIUM_ITEMS`, `OFFICIAL_POTIONS` OOP instances (`instanceof HealingPotion`/`BuffPotion`/`UtilityPotion`), and zero `combat`/`masterRecord`/`monsters` in `dnd-shared/items-core`**
- [ ] **Step 3: Replace hardcoded arrays in `src/data/dnd-weapons.ts`, `src/data/compendium/items.ts`, and `src/data/compendium/potions-data.ts` with adapters over `dnd-shared/items-core`, preserving all helpers (`weaponToCompendiumItem`, `findWeaponByName`, `detectWeaponCategoryPlaceholder`, `getDefaultWeaponForCategory`, `getWeaponsByCategory`, `canToggleWeaponGrip`, `getWeaponDamageDiceForGrip`, `findItemByName`, `getArmorItems`, `getWeaponItems`, and `itemRegistry.registerPotion(...)`)**
- [ ] **Step 4: Run `npm run typecheck`, `npm run lint`, `npx tsx --test` on Stage 3 + `weapons-catalog.test.ts`, `inventory-oop-and-potions.test.ts`, `inventory-ui-and-manager.test.ts`, `background-equipment-granting.test.ts`, `dnd-shared-core-bundle.test.ts`, `dnd-shared-stage2.test.ts`, and `npm run build`**
- [ ] **Step 5: Run `graphify update .`, commit, and push to `origin dev`**

---

### Task 3: `ai_master_n_battle` (`dev`) — Migrate `srd/adapter.ts` Weapons to `dnd-shared/items` (`<SHA_3>`) [Parallel Agent B, Hydrogen]

**Subagent:** `invoke_subagent` with `Model: 'inherit'` (Hydrogen), `TypeName: 'self'`, `Role: 'Master Stage 3 Integrator'`, `Workspace: 'inherit'`.

**Files:**
- Modify: `c:\antig\ai_master_n_battle\package.json`, `package-lock.json`, `src/lib/combat/srd/adapter.ts`
- Delete: `c:\antig\ai_master_n_battle\src\lib\combat\srd\data\equipment.json`

- [ ] **Step 1: Install `"git+https://github.com/LightSix56/dnd-shared.git#<SHA_3>"` (verify 0 `git+ssh`)**
- [ ] **Step 2: Switch `src/lib/combat/srd/adapter.ts` from `./data/equipment.json` to `SRD_WEAPONS` from `dnd-shared/items` (preserving `getAllSRDWeapons`, `getSRDWeapon`, `searchSRDWeapons`, `srdWeaponToAttackDefinition`, and `ATTACK_LIBRARY`) and delete `src/lib/combat/srd/data/equipment.json`**
- [ ] **Step 3: Run `npx tsc --noEmit`, `npm run lint`, Vitest suites (`srd-compendium.test.ts`, `shared-spells.test.ts`, `fighter-subclasses.test.ts`, `barbarian.test.ts`, `rogue-archetypes.test.ts`), revert `prisma/schema.prisma`, and run `npm run build`**
- [ ] **Step 4: Run `graphify update .`, stage ONLY Stage 3 files (NEVER `git add .` — leave `procgen/*`, `dev-maps/` untouched!), commit, and push to `origin dev`**

---

### Task 4: Cross-Repo Stage 3 Verification

- [ ] **Step 1: Verify clean git status and identical `<SHA_3>` pin via `git+https://` in both consumer repos on `dev`**
