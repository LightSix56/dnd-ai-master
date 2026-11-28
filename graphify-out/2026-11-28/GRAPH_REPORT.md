# Graph Report - ai_master_n_battle  (2026-11-28)

## Corpus Check
- 3504 files · ~2,325,986 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4138 nodes · 12243 edges · 182 communities (134 shown, 42 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 180 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a2caf3ec`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cn
- engine.ts
- class-kit.ts
- package.json
- CombatView.tsx
- fighter-combat.ts
- race-combat.ts
- bot.ts
- dependencies
- Combatant
- vitest
- supabase/client.ts
- rules.ts
- performAttack
- manual-combat-runner.ts
- procgen/index.ts
- party-leveled.ts
- race-adapter.test.ts
- library-data.ts
- dm-context.test.ts
- Field
- core-phb.ts
- MonsterManifestEntry
- story-arc.ts
- maps/types.ts
- d20-helper.ts
- fake-supabase.ts
- import-character.ts
- ssrf.ts
- Attack
- CombatGrid.tsx
- race-defs.ts
- AI Dungeon Master — D&D 5e Solo
- sheet-store.ts
- render-map.ts
- tools.ts
- Hotbar.tsx
- react
- Review Focus
- reactions.ts
- generateEncounter
- monsters/types.ts
- legacy-settings.ts
- DnDApp
- TacticalMapPreset
- cave.ts
- use-toast.ts
- import-character/route.ts
- archetype-solver.ts
- alert-dialog.tsx
- core-phb-combat.ts
- setup-params.ts
- party-arc-generator.ts
- fighter-subclasses.ts
- formation.ts
- abilityByKey
- class-features.ts
- MapElement
- bestiary-resolver.ts
- sheet-attacks.ts
- loot-generator.ts
- compilerOptions
- Query
- Версии персонажа для кампаний и единый лист для двух сайтов
- Дизайн: Парсинг базы 2014 (`dnd-shared`) и адаптация всех официальных рас и подрас под боевой движок
- Review Focus
- Supabase
- components.json
- layout.tsx
- barbarian-combat.ts
- Review Focus
- canonical-biomes.ts
- Review Focus
- Writing Guidelines for Postgres References
- Решение
- File Structure
- CharacterCard.tsx
- import-foundry-class-features.py
- distanceFt
- Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)
- Дизайн: Объединение всех справочников D&D 5e (2014) в общую библиотеку `dnd-shared`
- room-service.ts
- Review Focus
- Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness
- Architecture Design: Multi-Page Routing Architecture
- Cell
- combat/types.ts
- Global Constraints
- Global Constraints
- Архитектурный дизайн: Синхронизация комнаты, живой стриминг ответов Мастера и учёт токенов
- Процедурные карты боя: пещера
- class-defs.ts
- Section Definitions
- Глобальные ограничения
- Global Constraints
- Changelog
- Changelog
- encounter-generator.test.ts
- callback/route.ts
- Архитектура
- generator.ts
- AI Dungeon Master — сайт мастера
- Global Constraints
- Global Constraints
- Global Constraints
- Architecture & Changes
- generator-lvl1-matrix.test.ts
- supabase/types.ts
- Global Constraints
- Multiplayer Network Infrastructure & Gameplay Resilience Implementation Plan
- chart.tsx
- File Structure
- evaluateArithmetic
- Supabase Postgres Best Practices
- Combat Persistence, API Route and URL Binding Implementation Plan
- Prompt Cache Telemetry & Visibility Implementation Plan
- character-adapter.ts
- network-banner.js
- prepare-prisma-for-env.js
- redirects.test.tsx
- bot-tactics.test.ts
- ReactionScope
- multiattack.test.ts
- data/README.md
- encounter-generator.ts
- Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою
- import-dndsu-fighter.py
- vercel.json
- advanced-full-text-search.md
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- conn-limits.md
- conn-pooling.md
- conn-prepared-statements.md
- data-batch-inserts.md
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- lock-deadlock-prevention.md
- lock-short-transactions.md
- lock-skip-locked.md
- monitor-explain-analyze.md
- monitor-pg-stat-statements.md
- monitor-vacuum-analyze.md
- query-composite-indexes.md
- query-covering-indexes.md
- query-index-types.md
- query-missing-indexes.md
- query-partial-indexes.md
- schema-constraints.md
- schema-data-types.md
- schema-foreign-key-indexes.md
- schema-lowercase-identifiers.md
- schema-partitioning.md
- schema-primary-keys.md
- security-privileges.md
- security-rls-basics.md
- security-rls-performance.md
- _template.md
- eslint.config.mjs
- .mcp.json
- postcss.config.mjs
- devDependencies
- c
- open-map-service.ts
- zones.ts
- biome-matcher.ts
- spawn-director.ts
- aoe-templates.ts
- DnDApp.tsx
- combat-access.ts
- form.tsx
- LibraryItemEditorModal
- gen-dungeon.ts
- LibraryManagerModal

## God Nodes (most connected - your core abstractions)
1. `cn()` - 236 edges
2. `vitest` - 181 edges
3. `Combatant` - 140 edges
4. `CombatState` - 109 edges
5. `react` - 91 edges
6. `RoomService` - 81 edges
7. `distanceFt()` - 77 edges
8. `dealDamage()` - 71 edges
9. `EngineError` - 69 edges
10. `db` - 69 edges

## Surprising Connections (you probably didn't know these)
- `checkAllTables()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/check-supabase-rooms.ts → src/lib/supabase/client.ts
- `inspectCharactersSchema()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-characters.ts → src/lib/supabase/client.ts
- `inspectData()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-data.ts → src/lib/supabase/client.ts
- `listCharacters()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/list-chars.ts → src/lib/supabase/client.ts
- `listUsers()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/list-users.ts → src/lib/supabase/client.ts

## Import Cycles
- 3-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/fighter-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 3-file cycle: `src/lib/combat/classes/barbarian-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/classes/barbarian-combat.ts`
- 3-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/classes/rogue-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 4-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/race-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 4-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/classes/barbarian-combat.ts -> src/lib/combat/class-kit.ts`
- 4-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/classes/rogue-combat.ts -> src/lib/combat/class-kit.ts`
- 4-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/core-phb-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 4-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/legacy-settings-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 4-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/legacy-volo-mtf-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 4-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/mpmm-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 5-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/race-combat.ts -> src/lib/combat/class-kit.ts`
- 5-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/core-phb-combat.ts -> src/lib/combat/races/race-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 5-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/legacy-settings-combat.ts -> src/lib/combat/races/race-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 5-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/legacy-volo-mtf-combat.ts -> src/lib/combat/races/race-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 5-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/mpmm-combat.ts -> src/lib/combat/races/race-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 5-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/core-phb-combat.ts -> src/lib/combat/class-kit.ts`
- 5-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/legacy-settings-combat.ts -> src/lib/combat/class-kit.ts`
- 5-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/legacy-volo-mtf-combat.ts -> src/lib/combat/class-kit.ts`
- 5-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/mpmm-combat.ts -> src/lib/combat/class-kit.ts`

## Communities (182 total, 42 thin omitted)

### Community 0 - "cn"
Cohesion: 0.02
Nodes (128): cmdk, input-otp, @radix-ui/react-accordion, @radix-ui/react-context-menu, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-menubar, @radix-ui/react-navigation-menu (+120 more)

### Community 1 - "engine.ts"
Cohesion: 0.07
Nodes (88): assertNoPendingReaction(), ConflictError, dispatchAction(), errorResponse(), executeAction(), loadedVersion, loadState(), respond() (+80 more)

### Community 2 - "class-kit.ts"
Cohesion: 0.13
Nodes (18): FeatureOpts, HitResolution, MODULES, registerClassModule(), SneakInfo, ActionCtx, ActionRule, KITS (+10 more)

### Community 3 - "package.json"
Cohesion: 0.02
Nodes (82): name, private, version, @ai-sdk/react, bun-types, class-variance-authority, clsx, date-fns (+74 more)

### Community 4 - "CombatView.tsx"
Cohesion: 0.08
Nodes (56): lucide-react, @radix-ui/react-slot, sonner, BestiaryBrowser(), BestiaryBrowserProps, CR_OPTIONS, CREATURE_TYPES, CombatViewProps (+48 more)

### Community 5 - "fighter-combat.ts"
Cohesion: 0.07
Nodes (70): spendAbilityUse(), abilityName(), ACTIONS, addDamage(), alive(), alliesOf(), applyArrowToTarget(), armHandler() (+62 more)

### Community 6 - "race-combat.ts"
Cohesion: 0.13
Nodes (51): fireConditionStart(), log(), removeConditions(), result(), runStance(), StanceRule, strikeWith(), usedThisTurn() (+43 more)

### Community 7 - "bot.ts"
Cohesion: 0.07
Nodes (91): GET(), alliesOf(), bestAttack(), BotArchetype, BotStep, BotTurnResult, determineFacingTowards(), evaluateTargetScore() (+83 more)

### Community 8 - "dependencies"
Cohesion: 0.03
Nodes (75): dependencies, ai, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, cmdk, date-fns (+67 more)

### Community 9 - "Combatant"
Cohesion: 0.06
Nodes (23): Props, RoleSelectorModalProps, ClassModule, DMAssistAction, evaluateCombatPacing(), PacingEvaluation, PacingThreatLevel, shouldTriggerEncounterRelief() (+15 more)

### Community 10 - "vitest"
Cohesion: 0.05
Nodes (69): @prisma/client, vitest, DELETE(), GET(), PATCH(), POST(), GET(), POST() (+61 more)

### Community 11 - "supabase/client.ts"
Cohesion: 0.08
Nodes (33): checkAllTables(), inspectCharactersSchema(), inspectData(), listCharacters(), listUsers(), GET(), guestHits, guestRateLimited() (+25 more)

### Community 12 - "rules.ts"
Cohesion: 0.07
Nodes (63): CombatantDetails(), featureConditionImmunity(), attackMatches(), auraRadius(), CONDITION_MODS, conscious(), FEATURE_MODS, has() (+55 more)

### Community 13 - "performAttack"
Cohesion: 0.07
Nodes (75): classRules, SUBCLASSES, subclassRuleKeys(), kitHandles(), endTurn(), performAttack(), useAbility(), modResistance() (+67 more)

### Community 14 - "manual-combat-runner.ts"
Cohesion: 0.09
Nodes (29): createHeroes(), ensureDir(), initCombat(), initDragonCombat(), loadSession(), main(), printStatus(), saveState() (+21 more)

### Community 15 - "procgen/index.ts"
Cohesion: 0.08
Nodes (42): Tile(), buildAreaZones(), BIOME_NAMES, DECOR_CELL, LIQUID, PROCGEN_BIOMES, resolveProcgenBiome(), STEMS (+34 more)

### Community 16 - "party-leveled.ts"
Cohesion: 0.16
Nodes (22): failure(), GET(), POST(), resolveCampaign(), GET(), POST(), resolveRoom(), RouteProps (+14 more)

### Community 17 - "race-adapter.test.ts"
Cohesion: 0.22
Nodes (14): unregisterClassModule(), unregisterFeatureMod(), defineRace(), unregisterRace(), dehydrateCombatant(), {
  combatantCreateMock,
  combatFindUniqueMock,
  campaignFindUniqueMock,
  spellLibraryFindManyMock,
  abilityLibraryFindManyMock,
}, registerDragonbornRules(), registeredFeatureKeys (+6 more)

### Community 18 - "library-data.ts"
Cohesion: 0.06
Nodes (59): dnd-shared, LibraryAbility, LibrarySpell, EditableLibraryItem, AbilityItem, AttackItem, SpellItem, PresetsModalProps (+51 more)

### Community 19 - "dm-context.test.ts"
Cohesion: 0.09
Nodes (29): { mockStreamText }, buildDmHistory(), CHRONICLE_HEADER, COMPACT_BLOCK, DmHistory, formatChronicleMessage(), isServiceStub(), MAX_VERBATIM_SAFETY (+21 more)

### Community 20 - "Field"
Cohesion: 0.11
Nodes (36): blurField(), boxPass(), Field, sampleGrid(), SUB, valueNoise(), gaps(), generateCityLayout() (+28 more)

### Community 21 - "core-phb.ts"
Cohesion: 0.09
Nodes (20): Calc, conditionMods(), Calc, ALL_ANCESTRIES, CHROMATIC_COLORS, DragonAncestrySpec, eladrinSeason, FTD_REPLACED_BASE (+12 more)

### Community 22 - "MonsterManifestEntry"
Cohesion: 0.11
Nodes (17): dragons, manifest, MANIFEST_PATH, raw, BossMinionsCandidate, PackCandidate, TacticalCandidate, GenerateEncounterOptions (+9 more)

### Community 23 - "story-arc.ts"
Cohesion: 0.03
Nodes (125): ai, @ai-sdk/openai, zod, main(), main(), main(), main(), streamTurn() (+117 more)

### Community 24 - "maps/types.ts"
Cohesion: 0.18
Nodes (15): MapPresetsModal(), GeneratedMapElement, BiomeType, MapTagQuery, SpawnZoneDefinition, UniversalVTT, UVTTLight, UVTTPoint (+7 more)

### Community 25 - "d20-helper.ts"
Cohesion: 0.10
Nodes (31): zustand, CharacterInventoryModalProps, D20RollModal(), executeRoll(), handleAttackRoll(), handleCustomRoll(), handleSaveRoll(), handleSkillRoll() (+23 more)

### Community 26 - "fake-supabase.ts"
Cohesion: 0.07
Nodes (34): setup(), sheetRow(), state, CombatantRow, combatantToSheetPatch(), count(), endActiveCombats(), parseJson() (+26 more)

### Community 27 - "import-character.ts"
Cohesion: 0.08
Nodes (42): fetchSharedCharacter(), maxDuration, POST(), ShareFetchError, SHEET_BASE_URL, AUTH, handleCreateAndSelect(), buildDossier() (+34 more)

### Community 28 - "ssrf.ts"
Cohesion: 0.19
Nodes (17): GET(), maxDuration, maxDuration, POST(), FEATURED_MODELS, assertSafePublicHttpsUrl(), FORBIDDEN_HOSTNAMES, ipv4ToInt() (+9 more)

### Community 29 - "Attack"
Cohesion: 0.13
Nodes (19): TestEnemy, WeaponProfile, BEAST_FORMS, BeastForm, getBeastFormById(), MergedRaceCombatantData, MergeRaceInput, ClassKit (+11 more)

### Community 30 - "CombatGrid.tsx"
Cohesion: 0.07
Nodes (42): CombatEffectsLayer(), CombatEffectsLayerProps, CombatGrid(), getCellFromEvent(), handleGlobalMouseMove(), handleGlobalMouseUp(), handleSvgClick(), handleSvgMouseMove() (+34 more)

### Community 31 - "race-defs.ts"
Cohesion: 0.13
Nodes (21): findRaceData(), matchSubrace(), MENTAL_ABILITY_SPECS, norm(), normalizeUses(), RaceData, RaceHeroContext, RaceProgressionData (+13 more)

### Community 32 - "AI Dungeon Master — D&D 5e Solo"
Cohesion: 0.06
Nodes (34): AI Dungeon Master — D&D 5e Solo, AI забывает персонажей, API-ключ не работает, "Cannot find module 'xxx'", "Database is readonly" / "SQLite error", "Port 3000 is already in use", Быстрые кнопки, Ввод ключа в приложении (+26 more)

### Community 33 - "sheet-store.ts"
Cohesion: 0.07
Nodes (52): @supabase/supabase-js, GET(), createClient(), applyHeroSheetWrite(), HeroWriteSplit, liveHeroRows(), liveNestedHeroes(), num() (+44 more)

### Community 34 - "render-map.ts"
Cohesion: 0.12
Nodes (29): COLORS, DevMaps(), loadImage(), BackgroundSource, loadImage(), loadTextures(), rendered, renderUrl() (+21 more)

### Community 35 - "tools.ts"
Cohesion: 0.09
Nodes (29): advanceActTool, calculateTool, campaignContextSchema, characterUpdatesSchema, createCharacterTool, dmTools, fetchPageTool, formatAct() (+21 more)

### Community 36 - "Hotbar.tsx"
Cohesion: 0.08
Nodes (22): @radix-ui/react-popover, AOE_SHAPE, COST_LABEL, COST_STYLE, CostKind, damageSummary(), DEFAULT_SPELL_ACCENT, diceText() (+14 more)

### Community 37 - "react"
Cohesion: 0.05
Nodes (44): @radix-ui/react-avatar, react, testAuth(), CampaignPage(), RoomBattlePage(), RoomPage(), SupabaseAuthModal(), SupabaseAuthModalProps (+36 more)

### Community 38 - "Review Focus"
Cohesion: 0.08
Nodes (24): Execution Handoff, Global Constraints, Review Focus, Self-review, Task 1: Нормализатор параметров, Task 2: Колонка `startingSituation`, Task 3: Соло API: `POST /api/campaign` и `PATCH /api/campaign`, Task 4: Сетевой старт: маршрут и `room-service` (+16 more)

### Community 39 - "reactions.ts"
Cohesion: 0.13
Nodes (19): scoped(), storage, Store, askReaction(), Candidate, context(), ContextProvider, isPlayerReactor() (+11 more)

### Community 40 - "generateEncounter"
Cohesion: 0.23
Nodes (8): main(), createCombatantStub(), generateEncounter(), calculateAwardedXP(), awardCombatVictoryXP(), AwardCombatXPResult, CR_TO_XP_TABLE, enemyXP()

### Community 41 - "monsters/types.ts"
Cohesion: 0.12
Nodes (26): cheerio, DAMAGE_TYPE_MAP, normalizeDamageType(), parseAbilities(), parseAction(), parseCR(), parseDamageTypes(), ParseMeta (+18 more)

### Community 42 - "legacy-settings.ts"
Cohesion: 0.08
Nodes (24): mentions(), featureMods(), buildDragonOptions(), ELADRIN_SEASONS, astralCantripChosen(), hasAnyAstralCantrip(), registerNaturalAC(), registerShifterMod() (+16 more)

### Community 43 - "DnDApp"
Cohesion: 0.07
Nodes (14): DnDApp(), createCampaign(), handleGenerateStory(), startArcGeneration(), getMessageError(), getMessageText(), AutoScrollChatOptions, shouldAutoScrollChat() (+6 more)

### Community 44 - "TacticalMapPreset"
Cohesion: 0.32
Nodes (3): mapRegistry, MapManifestEntry, TacticalMapPreset

### Community 45 - "cave.ts"
Cohesion: 0.12
Nodes (23): addNiches(), buildFloor(), buildWater(), CaveLayout, Chamber, ChamberShape, clamp(), connectChambers() (+15 more)

### Community 46 - "use-toast.ts"
Cohesion: 0.12
Nodes (25): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle (+17 more)

### Community 47 - "import-character/route.ts"
Cohesion: 0.19
Nodes (20): ABILITY_RU_TO_EN, DAMAGE_TYPE_RU, detectActionCost(), detectWeapon(), LEGACY_ABILITY_NAMES, parseBonus(), parseDamageString(), POST() (+12 more)

### Community 48 - "archetype-solver.ts"
Cohesion: 0.24
Nodes (16): inferBacklineRole(), isFrontlineCandidate(), RANGED_KEYWORDS, resolveArchetype(), solveBossMinions(), solveGreedyFallback(), solveHorde(), SolveOptions (+8 more)

### Community 49 - "alert-dialog.tsx"
Cohesion: 0.09
Nodes (20): @radix-ui/react-alert-dialog, react-day-picker, AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader() (+12 more)

### Community 50 - "core-phb-combat.ts"
Cohesion: 0.15
Nodes (28): alive(), alliesOf(), dcBy(), friendly(), hostilesOf(), inReach(), rollOf(), saves() (+20 more)

### Community 51 - "setup-params.ts"
Cohesion: 0.10
Nodes (35): CampaignSetupForm(), baseProps(), StartingSituation, buildNewCampaignPayload(), CampaignSubmitResult, clampLevel(), defaultCampaignSetup(), DEFAULTS (+27 more)

### Community 52 - "party-arc-generator.ts"
Cohesion: 0.19
Nodes (13): buildPartyAct1Prompt(), CombatDifficultyConfig, extractJson(), extractPartyRosterFromParticipants(), generatePartyAwareAct1(), getCombatDifficultyConfig(), PartyArcGenerationParams, partyAwareAct1Schema (+5 more)

### Community 53 - "fighter-subclasses.ts"
Cohesion: 0.08
Nodes (30): ARCANE_SHOT_POOL, PSIONIC_POOL, SUPERIORITY_POOL, arcaneShot(), buildDefinition(), dcOf(), FEATURE_RULES, FIGHTER_FEATURES (+22 more)

### Community 54 - "formation.ts"
Cohesion: 0.19
Nodes (18): bySizeDesc(), centroid(), closeContact(), clusterAround(), footprint(), FormationInput, FormationResult, FORMATIONS (+10 more)

### Community 55 - "abilityByKey"
Cohesion: 0.29
Nodes (10): featureReady(), sweepStances(), abilityByKey(), defense(), saveFailed(), saveFailed(), saveFailed(), allyCountSaveRescueFailed() (+2 more)

### Community 56 - "class-features.ts"
Cohesion: 0.06
Nodes (43): ACTIVATION_COST, ALWAYS_POOL, CLASS_PATTERNS, damageTypeOf(), ENGINE_ACTIONS, engineActionValues(), evaluateFormula(), featureUses() (+35 more)

### Community 57 - "MapElement"
Cohesion: 0.15
Nodes (12): OpenBattlemap, cityStreetPreset, gladiatorArenaPreset, ALL_PRESETS, getPresetByBiome(), getPresetById(), PRESETS_BY_BIOME, PRESETS_BY_ID (+4 more)

### Community 58 - "bestiary-resolver.ts"
Cohesion: 0.35
Nodes (9): GET(), createMonsterDefinitionFromManifest(), loadDefaultManifest(), loadMonsterDefinition(), CANONICAL_ALIASES, cleanQuery(), findMonsterInManifest(), isPlaceholderAttackList() (+1 more)

### Community 59 - "sheet-attacks.ts"
Cohesion: 0.18
Nodes (20): ABILITY_ALIASES, abilityScore(), accessoryBonuses(), damageString(), fmt(), hasTwoWeaponFightingStyle(), itemBonuses(), mod() (+12 more)

### Community 60 - "loot-generator.ts"
Cohesion: 0.15
Nodes (17): BOSS_POTION_ITEM, BOSS_SCROLL_ITEM, CR_TO_XP, generateCombatLoot(), getXpForCr(), parseEnemyCr(), rollDice(), THEMATIC_BIOME_DROPS (+9 more)

### Community 61 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 62 - "Query"
Cohesion: 0.12
Nodes (3): nextId(), Query, readPath()

### Community 63 - "Версии персонажа для кампаний и единый лист для двух сайтов"
Cohesion: 0.11
Nodes (17): 1. Версия кампании — строка в `characters`, 2. Вход в комнату, 3. Чтение листа сайтом мастера, 4. Бой, 5. Опыт и прокачка, 6. «Партия прокачалась», 7. Сайт листа, 8. Уже идущие комнаты (+9 more)

### Community 64 - "Дизайн: Парсинг базы 2014 (`dnd-shared`) и адаптация всех официальных рас и подрас под боевой движок"
Cohesion: 0.12
Nodes (16): 1. Контекст и цель, 2.1. Что включается, 2.2. Что строго исключается, 2. Источник истины и фильтрация контента, 3.1. Единый принцип хранения сущностей, 3.2. Схема записи расы и подрасы (`Race` / `Subrace`), 3.3. Экспорты `dnd-shared`, 3. Архитектура общего пакета `dnd-shared` (+8 more)

### Community 65 - "Review Focus"
Cohesion: 0.14
Nodes (13): Campaign Character Versions — Part 2: Master Site — Implementation Plan, Global Constraints, Review Focus, Task 10: Preview verification and release, Task 1: Prisma link fields and types, Task 2: `sheet-store`, Task 3: `hero-view` — live sheet overlaid on campaign heroes, Task 4: Join without snapshots (+5 more)

### Community 66 - "Supabase"
Cohesion: 0.11
Nodes (15): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Debugging, Making and Committing Schema Changes (+7 more)

### Community 67 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 68 - "layout.tsx"
Cohesion: 0.14
Nodes (13): nextConfig, SECURITY_HEADERS, next, next-themes, geistMono, geistSans, metadata, AuthFetchBridge() (+5 more)

### Community 69 - "barbarian-combat.ts"
Cohesion: 0.07
Nodes (25): modOf(), CLEAVER_TYPES, auraAction(), BEAST_ATTACKS, beastForm(), ENV_NAMES, isNaturalWeapon(), rageDash() (+17 more)

### Community 70 - "Review Focus"
Cohesion: 0.17
Nodes (11): Campaign Character Versions — Part 1: Database and Sheet Site — Implementation Plan, Global Constraints, Review Focus, Task 1: SQL migration 007, Task 2: XP thresholds (sheet site), Task 3: Characters API — new columns, conditional save, guarded delete, Task 4: Conflict merge (pure), Task 5: Sheet page — carry revision, resolve conflicts, refresh on return (+3 more)

### Community 71 - "canonical-biomes.ts"
Cohesion: 0.11
Nodes (17): astralRiftPreset, banditCampPreset, bridgeChasmPreset, CANONICAL_PRESETS_EXTENDED, castleCourtyardPreset, desertDunesPreset, docksHarborPreset, foundryForgePreset (+9 more)

### Community 72 - "Review Focus"
Cohesion: 0.17
Nodes (11): Global Constraints, Review Focus, Task 1: Общее ядро: типы, биомы, ссылки, разметка, зоны, Task 2: Лава и общий набор проверок биомов, Task 3: Подземелье и таверна, Task 4: Природа, Task 5: Город, Task 6: Рисовальщик всех биомов (+3 more)

### Community 73 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 74 - "Решение"
Cohesion: 0.18
Nodes (10): Зачем, Зоны появления, Обводка стен, Общий план карты, Отрисовка, Процедурные карты для основных биомов и обводка стен, Разметка, Решение (+2 more)

### Community 75 - "File Structure"
Cohesion: 0.22
Nodes (8): `dnd-shared` Stage 2 (13 Classes, 118+ Subclasses, Progression, Spells & Full Homebrew) Implementation Plan, File Structure, Global Constraints, Task 1: `dnd-shared` — Build Official 13 Classes, 118+ Subclasses, Progression, Spells & Warlock Choices, Task 2: `dnd-shared` — Consolidate All Homebrew (`mousefolk`, `ratfolk`, `alt-barbarian`, `barbarian-exploits`) & Push `<SHA_2>`, Task 3: `dnd5e-character-sheet` (`dev`) — Migrate Classes, Progression, Spells, Warlock Choices & Homebrew to `<SHA_2>` [Parallel Agent A, Hydrogen], Task 4: `ai_master_n_battle` (`dev`) — Migrate `class-defs.ts` to `dnd-shared/classes` (`<SHA_2>`) [Parallel Agent B, Hydrogen], Task 5: Cross-Repo Stage 2 Verification

### Community 76 - "CharacterCard.tsx"
Cohesion: 0.16
Nodes (15): @radix-ui/react-progress, abilityMod(), CharacterCard(), getRelationTier(), modStr(), RelationTier, typeColors, typeLabels (+7 more)

### Community 77 - "import-foundry-class-features.py"
Cohesion: 0.22
Nodes (14): activity(), by_identifier(), consumption(), formula_of(), ident_of(), key_of(), load(), Формула урона/лечения Foundry -> строка вида '2d8 + @mod (+6 more)

### Community 78 - "distanceFt"
Cohesion: 0.09
Nodes (29): defineClass(), isOwnTurn(), bolsterTarget(), requireFoe(), castSaveDisadvantage(), cellFree(), contest(), creatureDown() (+21 more)

### Community 79 - "Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)"
Cohesion: 0.15
Nodes (12): 1. Контекст и проблема, 2. Цели и ключевые требования, 3. Архитектура и поток данных, 4.1. `POST /api/room/[code]/turn`, 4.2. `POST /api/room/[code]/turn/resolve`, 4.3. `GET /api/room/[code]/turn`, 4. Спецификация API и сервисов, 5.1. `PartyTurnBar` (`src/components/room/PartyTurnBar.tsx`) (+4 more)

### Community 80 - "Дизайн: Объединение всех справочников D&D 5e (2014) в общую библиотеку `dnd-shared`"
Cohesion: 0.11
Nodes (17): 1. Цель и ключевые ограничения, 2.1. Официальный контент D&D 5e (2014), 2.2. Хоумбрю в `dnd-shared/homebrew`, 2. Источник истины и политика по хоумбрю, 3.1. Карта сабпат-экспортов (`package.json`), 3.2. Контракты поиска и совместимость с Next.js 16 / `tsx`, 3. Архитектура пакета `dnd-shared`, 4.1. `dnd5e-character-sheet` (ветка `dev`) (+9 more)

### Community 81 - "room-service.ts"
Cohesion: 0.06
Nodes (49): DELETE(), GET(), maxDuration, POST(), GET(), maxDuration, POST(), handleSubmit() (+41 more)

### Community 82 - "Review Focus"
Cohesion: 0.20
Nodes (9): Global Constraints, Review Focus, Task 1: Генератор случайных чисел и субклеточные поля, Task 2: План пещеры из заготовленных частей, Task 3: Разметка, зоны и `generateProcgenMap`, Task 4: Подключение к созданию боя, Task 5: Текстуры и отрисовка в браузере, Task 6: Архив старых карт и визуальная проверка (+1 more)

### Community 83 - "Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness"
Cohesion: 0.17
Nodes (11): 1.1. Механика работы KV-кэша DeepSeek (Prefix Caching), 1.2. Диагностика текущего состояния `dnd-ai-master` (Cache Hit ~0%), 1. Контекст и проблема, 2. Архитектура: Модульная 3-зонная модель контекста, 3.1. `src/lib/ai/caching/frozen-prefix.ts`, 3.2. `src/lib/ai/caching/ephemeral-tail.ts`, 3.3. `src/lib/ai/caching/milestone-compactor.ts`, 3. Компоненты и интерфейсы (+3 more)

### Community 84 - "Architecture Design: Multi-Page Routing Architecture"
Cohesion: 0.17
Nodes (11): 1. Problem Statement & Motivation, 2.1 Route Map, 2. Target Routing Architecture, 3.1 `HomeHubView` (`src/components/home/HomeHubView.tsx`), 3.2 `RoomSessionView` (`src/components/room/RoomSessionView.tsx`), 3.3 `SoloCampaignView` (`src/components/campaign/SoloCampaignView.tsx`), 3.4 Shared State & Context, 3. Component Architecture & Decomposition (+3 more)

### Community 85 - "Cell"
Cohesion: 0.22
Nodes (8): DoorRoute, FiringPosition, CastContext, MoveOutcome, ShoveOutcome, ToggleDoorOutcome, PathResult, Cell

### Community 86 - "combat/types.ts"
Cohesion: 0.06
Nodes (50): PendingRecord, GET(), Props, crToProfBonus(), formatCR(), getAttackStem(), MONSTER_TYPE_RU, MonsterAdapterOptions (+42 more)

### Community 87 - "Global Constraints"
Cohesion: 0.20
Nodes (9): D&D 5e (2014) Races & Subraces — `dnd-shared` + Combat Engine Implementation Plan, Final Verification Gate (After Each Batch), Follow-Up Batches (Queued Sequentially After Task 5 Using Output of Task 1 `races.json`), Global Constraints, Task 1 (Batch 0): Парсер `dnd.su/race/`, базы `races.json` / `races-core.json` и экспорты в `dnd-shared`, Task 2 (Batch 1a): Базовые расовые примитивы в боевом движке (`types.ts`, `dice.ts`, `feature-mods.ts`, `rules.ts`), Task 3 (Batch 1b): Реестр рас `src/lib/combat/races/` и тестовый harness, Task 4 (Batch 1c): Проброс рас в создание бойца (`character-adapter.ts`, `generator.ts`, `import-character/route.ts`) (+1 more)

### Community 88 - "Global Constraints"
Cohesion: 0.18
Nodes (10): Global Constraints, Task 1: Backend Turn API — Блокировка повторной отправки и авто-резолвинг, Task 2: Host Force-Resolve — Завершение раунда с AFK-персонажами, Task 3: Компонент очереди отряда `PartyTurnBar`, Task 4: Интеграция пошагового цикла в `DnDApp.tsx`, Task 5: Финальная верификация, актуализация графа и публикация в Git, Автоматические тесты, План верификации (+2 more)

### Community 89 - "Архитектурный дизайн: Синхронизация комнаты, живой стриминг ответов Мастера и учёт токенов"
Cohesion: 0.18
Nodes (10): 1. Контекст и цели, 2.1. Стриминг и Realtime-шина (Supabase Realtime Broadcast), 2.2. Завершение генерации и персистентность (Persistence & Fallback), 2. Архитектура и поток данных (Data Flow), 3.1. Лента сообщений чата (`DnDApp.tsx`), 3.2. Нижняя панель действий (`PartyTurnBar.tsx`), 3.3. Блок расхода токенов и стоимости (`MessageBubble.tsx`), 3. Изменения компонентов интерфейса (+2 more)

### Community 90 - "Процедурные карты боя: пещера"
Cohesion: 0.20
Nodes (9): Зачем, Модуль `src/lib/combat/procgen/`, Отрисовка в браузере, Подключение к бою, Процедурные карты боя: пещера, Решение, Старые карты, Тесты (+1 more)

### Community 91 - "class-defs.ts"
Cohesion: 0.17
Nodes (17): buildDefinition(), calcOf(), classAbilityDefinitions(), CLASSES, FeatureRule, findSubclass(), norm(), optionChosen() (+9 more)

### Community 92 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 93 - "Глобальные ограничения"
Cohesion: 0.22
Nodes (8): Глобальные ограничения, Задача 1: Манифест заклинаний и типы зон, Задача 2: Механика и повторные действия «Раскалённого металла» (Heat Metal), Задача 3: Создание динамических зон заклинаний и их жизненный цикл при концентрации, Задача 4: Интеграция зон в перемещение (`moveCombatant`), начало хода (`startTurn`) и воспламенение паутины, Задача 5: Действие освобождения («Освободиться из пут / паутины») тратой Действия, Задача 6: Высшая невидимость (Greater Invisibility) и полный регрессионный прогон, План реализации: Динамические зоны заклинаний, повторные действия и механики 5e

### Community 94 - "Global Constraints"
Cohesion: 0.22
Nodes (8): Global Constraints, Security Hardening Implementation Plan, Task 1: SSRF Protection & URL Validation (`src/lib/security/ssrf.ts`), Task 2: Fail-Closed Auth & Access Core (`supabase/client`, `campaign-access`, `combat-access`), Task 3: Combat, Maps, Library & Presets API Hardening + Action IDOR & Potion Replay Fix, Task 4: Campaign, Room, Chat & Auth Callback Hardening, Task 5: Client XSS (`eval` Removal) & Next.js Security Config, Task 6: Update Legacy Tests & Full Verification

### Community 95 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 96 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 97 - "encounter-generator.test.ts"
Cohesion: 0.38
Nodes (3): mockManifest, dungeonPrisonPreset, forestAmbushPreset

### Community 98 - "callback/route.ts"
Cohesion: 0.40
Nodes (3): @supabase/ssr, GET(), sanitizeRelativeRedirect()

### Community 99 - "Архитектура"
Cohesion: 0.22
Nodes (8): 1. Зоны заклинаний (`MapElement` с `isSpellZone: true`), 2. Повторные действия (`Heat Metal` и др.), 3. Действие освобождения (`Escape Action`), 4. Исправление `spells.json`, 5. Высшая невидимость (`Greater Invisibility`), Архитектура, Дизайн: Динамические зоны заклинаний, повторные действия и механики 5e, Цель

### Community 100 - "generator.ts"
Cohesion: 0.12
Nodes (17): extractSpellsFromCharacter(), sheetConditionsForCombat(), Formation, FORMATION_LABELS, CLASS_DEFAULT_SAVING_THROWS, EnvironmentType, generateTacticalMap(), PartyCharacter (+9 more)

### Community 101 - "AI Dungeon Master — сайт мастера"
Cohesion: 0.15
Nodes (12): AI Dungeon Master — сайт мастера, Git, This is NOT the Next.js you know, Архитектура, Боевые карты, Гидратация, Движение и атаки по возможности, Дизайн (простая чёрно-белая тема shadcn/ui) (+4 more)

### Community 102 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Prompt Caching Architecture (DeepSeek Harness Parity) Implementation Plan, Task 1: Core Caching Utilities — `frozen-prefix.ts` and `ephemeral-tail.ts`, Task 2: Discrete Milestone History Compactor — `milestone-compactor.ts`, Task 3: Integration into Solo Chat Endpoint (`src/app/api/chat/route.ts`), Task 4: Integration into Multiplayer Co-op Turn Helper (`src/lib/room/resolve-turn-helper.ts`), Task 5: End-to-End Verification & Cost Calculation Audit

### Community 103 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Multi-Page Routing Architecture Implementation Plan, Task 1: Route Aliases (`/home` and `/rooms/[code]`), Task 2: Home Hub View (`src/components/home/HomeHubView.tsx` & `src/app/page.tsx`), Task 3: Dedicated Multiplayer Room Session View (`/room/[code]`), Task 4: Dedicated Solo Campaign Session View (`/campaign/[id]`), Task 5: Full Regression, Type Verification & Graphify Update

### Community 104 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Room Streaming, Live Synchronization and Token Tracking Implementation Plan, Task 1: Подсчёт токенов, стоимости и сохранение `_stats` в `resolve-turn-helper.ts`, Task 2: Потоковый стриминг ответа Мастера в `resolve-turn-helper.ts` и `api/room/[code]/turn/resolve`, Task 3: Клиентская подписка на Supabase Realtime `room:${roomId}` (`dm_stream`) и трансляция чанков, Task 4: Перенос статуса Мастера в чат и очистка `PartyTurnBar.tsx`, Task 5: Полная верификация, сборка и Git Push

### Community 105 - "Architecture & Changes"
Cohesion: 0.22
Nodes (8): 1. Core Auth & Access Control, 2. SSRF Protection (`src/lib/security/ssrf.ts`), 3. API Route Hardening & IDOR Fixes, 4. Client XSS, Next.js Config & Headers, 5. Test Updates & Verification, Architecture & Changes, Global Constraints, Security Hardening Design (`dnd-ai-master`)

### Community 106 - "generator-lvl1-matrix.test.ts"
Cohesion: 0.33
Nodes (5): applyFormation(), BLOCKING, cases, party, SIZE_CELLS

### Community 107 - "supabase/types.ts"
Cohesion: 0.25
Nodes (7): PartyBond, RoomParticipantRecord, RoomRecord, RoomStatus, RoomTurnRecord, SupabaseCharacterRecord, TurnStatus

### Community 109 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Global Constraints, Task 1: Backend Data Model & Combat Engine Potion Support, Task 2: Combat Hotbar & CombatView UI Integration, Task 3: Campaign Character Card & Inventory Modal, Task 4: Full Verification, Graphify & Git Delivery, Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою — Implementation Plan

### Community 110 - "Multiplayer Network Infrastructure & Gameplay Resilience Implementation Plan"
Cohesion: 0.29
Nodes (6): Multiplayer Network Infrastructure & Gameplay Resilience Implementation Plan, Task 1: 1-Click Guest Authentication & Client Auth Guard, Task 2: Opening Story & Campaign Chat Synchronization for Guests, Task 3: Atomic Concurrency Lock on Turn Resolution, Task 4: Realtime Reliability & Polling Fallback in `useRoomRealtime`, Task 5: Full Regression Testing, Graph Update, and Git Push

### Community 111 - "chart.tsx"
Cohesion: 0.23
Nodes (10): recharts, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 112 - "File Structure"
Cohesion: 0.18
Nodes (10): `dnd-shared` Stage 1 (Core: Spells, Races, Fighter & Scourgeborne) Implementation Plan, File Structure, Global Constraints, Plan Self-Review, Task 1: `dnd-shared` — Cross-Bundler JSON Loader & Unified Spell Search (`SPELL_ALIASES`), Task 2: `dnd-shared` — Enrich Races (`category`, `choices`) & Unify `findRace` (Legacy vs MPMM), Task 3: `dnd-shared` — Add `./homebrew` (`scourgeborne`), Full Package Verification & GitHub Push, Task 4: `dnd5e-character-sheet` (`dev`) — Integrate Spells & Races (`dnd-shared` `<SHA_1>`) [Parallel Agent A] (+2 more)

### Community 113 - "evaluateArithmetic"
Cohesion: 0.83
Nodes (4): evaluateArithmetic(), primary(), product(), sum()

### Community 114 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 115 - "Combat Persistence, API Route and URL Binding Implementation Plan"
Cohesion: 0.33
Nodes (5): Combat Persistence, API Route and URL Binding Implementation Plan, Task 1: Create `src/app/api/combat/[id]/route.ts` with TDD, Task 2: CombatView fallback and active combat room resolution, Task 3: URL Synchronization and Direct Battle Link in `DnDApp.tsx`, Task 4: Verification, Lint & Git Push

### Community 116 - "Prompt Cache Telemetry & Visibility Implementation Plan"
Cohesion: 0.33
Nodes (5): Prompt Cache Telemetry & Visibility Implementation Plan, Task 1: Prompt cache extraction helper with TDD (`src/lib/ai/cost.ts`), Task 2: Integrate robust token extraction in API routes, Task 3: UI Transparency in `MessageBubble` & Header Trigger (`DnDApp.tsx`), Task 4: Full Verification, Graphify & Git Push

### Community 117 - "character-adapter.ts"
Cohesion: 0.18
Nodes (18): classifyArmorItem(), collectRawAttacks(), DAMAGE_TYPE_RU, dedupeStringsCaseInsensitive(), detectActionCost(), detectArmorType(), detectWeapon(), extractAttacksFromCharacter() (+10 more)

### Community 118 - "network-banner.js"
Cohesion: 0.33
Nodes (5): interfaces, localIps, os, otherIps, radminIps

### Community 119 - "prepare-prisma-for-env.js"
Cohesion: 0.33
Nodes (5): fs, isVercel, path, schema, schemaPath

### Community 120 - "redirects.test.tsx"
Cohesion: 0.47
Nodes (3): HomePage(), mockRedirect, RoomsCodePage()

### Community 121 - "bot-tactics.test.ts"
Cohesion: 0.29
Nodes (6): bow, club, dagger, el(), state(), wallWithDoor()

### Community 123 - "multiattack.test.ts"
Cohesion: 0.40
Nodes (3): createTestCombatState(), mockBite, mockClaw

### Community 125 - "encounter-generator.ts"
Cohesion: 0.13
Nodes (24): applyLeaderName(), ARCHETYPE_ALIASES, CAMPAIGN_BUDGET_SCALE, CAMPAIGN_TO_ENCOUNTER, campaignBudgetScale(), normalizeArchetype(), resolveEncounterDifficulty(), gen() (+16 more)

### Community 126 - "Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою"
Cohesion: 0.50
Nodes (3): 1. Цель, 2. Глобальные ограничения, Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

### Community 170 - "devDependencies"
Cohesion: 0.06
Nodes (25): devDependencies, bun-types, cheerio, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tw-animate-css (+17 more)

### Community 173 - "open-map-service.ts"
Cohesion: 0.33
Nodes (6): GET(), getPopularTags(), OPEN_BATTLEMAP_CATALOG, OpenMapSearchQuery, POPULAR_MAP_TAGS, searchOpenMaps()

### Community 175 - "zones.ts"
Cohesion: 0.44
Nodes (7): CellKind, anchor(), blocked(), buildSpawnZones(), buildZonesFromAreas(), nearestFloor(), pathDistances()

### Community 176 - "biome-matcher.ts"
Cohesion: 0.27
Nodes (9): BIOME_CONFIGS, BiomeAffinity, entryMatchesKeywords(), factionKeywords(), getBiomeCandidatePool(), getFactionCandidatePool(), UNIVERSAL_FALLBACK_KEYWORDS, UNIVERSAL_FALLBACK_TYPES (+1 more)

### Community 178 - "spawn-director.ts"
Cohesion: 0.21
Nodes (11): templePreset, assignTacticalSpawns(), BACKLINE_CLASSES, bodyFits(), BOSS_KEYWORDS, createDefaultSpawnZones(), findClosestPassableCell(), inferCombatantRole() (+3 more)

### Community 183 - "aoe-templates.ts"
Cohesion: 0.30
Nodes (10): ClassifiedTargets, classifyAoeTargets(), DIRECTION_STEPS, DirStep, getConeCells(), getCubeCells(), getLineCells(), getSphereCells() (+2 more)

### Community 191 - "DnDApp.tsx"
Cohesion: 0.05
Nodes (62): @radix-ui/react-select, CampaignSetupFormProps, CampaignSetupPanel(), CampaignSetupPanelProps, heroesWord(), partySetupDescription(), CreateCampaignModal(), CreateCampaignModalProps (+54 more)

### Community 194 - "combat-access.ts"
Cohesion: 0.16
Nodes (14): { getAuthUserMock, campaignFindUniqueMock, combatFindUniqueMock, combatantFindUniqueMock, getActiveRoomMock }, ACTOR_FIELD, actorIdForAction(), checkCombatControl(), CombatControlDeps, HOST_ONLY_ACTIONS, resetCombatAccessCaches(), resolveRoom() (+6 more)

### Community 195 - "form.tsx"
Cohesion: 0.19
Nodes (12): @radix-ui/react-label, react-hook-form, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext (+4 more)

### Community 200 - "gen-dungeon.ts"
Cohesion: 0.38
Nodes (9): besideWall(), carveCells(), center(), connect(), corridor(), dungeonDecor(), generateDungeonLayout(), placeRooms() (+1 more)

## Knowledge Gaps
- **1098 isolated node(s):** `supabase`, `$schema`, `style`, `rsc`, `tsx` (+1093 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1472 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `engine.ts`, `package.json`, `CombatView.tsx`, `bot.ts`, `Combatant`, `supabase/client.ts`, `rules.ts`, `performAttack`, `manual-combat-runner.ts`, `procgen/index.ts`, `party-leveled.ts`, `race-adapter.test.ts`, `library-data.ts`, `dm-context.test.ts`, `Field`, `MonsterManifestEntry`, `story-arc.ts`, `maps/types.ts`, `d20-helper.ts`, `fake-supabase.ts`, `import-character.ts`, `ssrf.ts`, `Attack`, `CombatGrid.tsx`, `sheet-store.ts`, `render-map.ts`, `react`, `reactions.ts`, `generateEncounter`, `monsters/types.ts`, `DnDApp`, `TacticalMapPreset`, `cave.ts`, `archetype-solver.ts`, `biome-matcher.ts`, `spawn-director.ts`, `setup-params.ts`, `party-arc-generator.ts`, `fighter-subclasses.ts`, `formation.ts`, `aoe-templates.ts`, `class-features.ts`, `MapElement`, `bestiary-resolver.ts`, `loot-generator.ts`, `DnDApp.tsx`, `combat-access.ts`, `room-service.ts`, `combat/types.ts`, `encounter-generator.test.ts`, `generator.ts`, `generator-lvl1-matrix.test.ts`, `character-adapter.ts`, `redirects.test.tsx`, `bot-tactics.test.ts`, `multiattack.test.ts`, `encounter-generator.ts`, `monster-adapter.test.ts`?**
  _High betweenness centrality (0.176) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `cn`, `render-map.ts`, `package.json`, `CombatView.tsx`, `Hotbar.tsx`, `form.tsx`, `CharacterCard.tsx`, `use-toast.ts`, `chart.tsx`, `alert-dialog.tsx`, `setup-params.ts`, `CombatGrid.tsx`, `DnDApp.tsx`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `Combatant` connect `Combatant` to `engine.ts`, `class-kit.ts`, `CombatView.tsx`, `fighter-combat.ts`, `race-combat.ts`, `bot.ts`, `vitest`, `rules.ts`, `performAttack`, `manual-combat-runner.ts`, `race-adapter.test.ts`, `library-data.ts`, `core-phb.ts`, `MonsterManifestEntry`, `Attack`, `CombatGrid.tsx`, `Hotbar.tsx`, `reactions.ts`, `TacticalMapPreset`, `spawn-director.ts`, `core-phb-combat.ts`, `fighter-subclasses.ts`, `aoe-templates.ts`, `class-features.ts`, `bestiary-resolver.ts`, `DnDApp.tsx`, `barbarian-combat.ts`, `distanceFt`, `Cell`, `combat/types.ts`, `character-adapter.ts`, `bot-tactics.test.ts`, `ReactionScope`, `multiattack.test.ts`, `encounter-generator.ts`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `supabase`, `$schema`, `style` to the rest of the system?**
  _1098 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.020263837889296886 - nodes in this community are weakly interconnected._
- **Should `engine.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06886446886446887 - nodes in this community are weakly interconnected._
- **Should `class-kit.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12987012987012986 - nodes in this community are weakly interconnected._