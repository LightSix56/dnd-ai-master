# Graph Report - ai_master_n_battle  (2026-11-28)

## Corpus Check
- 3503 files · ~2,235,068 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4154 nodes · 12257 edges · 195 communities (146 shown, 44 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 180 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9dc2a9fe`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cn
- action/route.ts
- class-kit.ts
- package.json
- DnDApp.tsx
- fighter-combat.ts
- race-combat.ts
- bot.ts
- dependencies
- Combatant
- denyCampaignAccess
- vitest
- rules.ts
- useAbility
- library-data.ts
- procgen/index.ts
- ai/client.ts
- race-adapter.test.ts
- adapter.ts
- compact.ts
- Field
- resolve-turn-helper.ts
- createClient
- story-arc.ts
- maps/types.ts
- d20-helper.ts
- fake-supabase.ts
- import-character.ts
- party-leveled.ts
- campaign-access.ts
- CombatView
- Attack
- AI Dungeon Master — D&D 5e Solo
- room-service.ts
- render-map.ts
- tools.ts
- Hotbar.tsx
- RoomLobby
- Review Focus
- races-settings.test.ts
- MapElement
- monsters/types.ts
- race-defs.ts
- DnDApp
- TacticalMapPreset
- cave.ts
- use-toast.ts
- engine.ts
- encounters/types.ts
- alert-dialog.tsx
- barbarian-combat.ts
- setup-params.ts
- combat/types.ts
- fighter-subclasses.ts
- formation.ts
- character-adapter.ts
- class-features.ts
- presets/index.ts
- encounter-generator.ts
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
- barbarian.ts
- Review Focus
- canonical-biomes.ts
- Review Focus
- Writing Guidelines for Postgres References
- Решение
- File Structure
- react
- import-foundry-class-features.py
- distanceFt
- Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)
- Дизайн: Объединение всех справочников D&D 5e (2014) в общую библиотеку `dnd-shared`
- RoomService
- Review Focus
- Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness
- Architecture Design: Multi-Page Routing Architecture
- carousel.tsx
- monster-adapter.ts
- Global Constraints
- Global Constraints
- Архитектурный дизайн: Синхронизация комнаты, живой стриминг ответов Мастера и учёт токенов
- Процедурные карты боя: пещера
- ai
- Section Definitions
- Глобальные ограничения
- Global Constraints
- Changelog
- Changelog
- monster-parser-engine.ts
- hero-overlay.ts
- Архитектура
- generator.ts
- AI Dungeon Master — сайт мастера
- Global Constraints
- Global Constraints
- Global Constraints
- Architecture & Changes
- frozen-prefix.ts
- supabase/types.ts
- Global Constraints
- Multiplayer Network Infrastructure & Gameplay Resilience Implementation Plan
- chart.tsx
- File Structure
- evaluateArithmetic
- Supabase Postgres Best Practices
- Combat Persistence, API Route and URL Binding Implementation Plan
- Prompt Cache Telemetry & Visibility Implementation Plan
- import-character/route.ts
- network-banner.js
- prepare-prisma-for-env.js
- redirects.test.tsx
- moveCombatant
- scripts
- room/types.ts
- data/README.md
- encounter-request.ts
- Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою
- scene-synchronizer.ts
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
- pacing-director.test.ts
- devDependencies
- validation.ts
- c
- open-map-service.ts
- File Structure
- zones.ts
- initiative.ts
- AttacksAbilitiesEditor
- spawn-director.ts
- CharacterCard.tsx
- combat-sheet-sync.ts
- biome-matcher.ts
- File Structure
- aoe-templates.ts
- ActionCost
- wild-shape.test.ts
- Cell
- opportunity-attacks.test.ts
- parseChallengeRating
- ImportCharacterModal
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
- `main()` --calls--> `createClient()`  [EXTRACTED]
  scripts/check-polza-ping.ts → src/lib/ai/client.ts
- `checkAllTables()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/check-supabase-rooms.ts → src/lib/supabase/client.ts
- `inspectCharactersSchema()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-characters.ts → src/lib/supabase/client.ts
- `inspectData()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-data.ts → src/lib/supabase/client.ts
- `listCharacters()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/list-chars.ts → src/lib/supabase/client.ts

## Import Cycles
- 3-file cycle: `src/lib/combat/classes/barbarian-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/classes/barbarian-combat.ts`
- 3-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/classes/rogue-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 3-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/fighter-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 4-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/core-phb-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 4-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/legacy-settings-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 4-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/legacy-volo-mtf-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 4-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/mpmm-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 4-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/race-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 4-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/classes/barbarian-combat.ts -> src/lib/combat/class-kit.ts`
- 4-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/classes/rogue-combat.ts -> src/lib/combat/class-kit.ts`
- 5-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/core-phb-combat.ts -> src/lib/combat/class-kit.ts`
- 5-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/core-phb-combat.ts -> src/lib/combat/races/race-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 5-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/legacy-settings-combat.ts -> src/lib/combat/class-kit.ts`
- 5-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/legacy-settings-combat.ts -> src/lib/combat/races/race-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 5-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/legacy-volo-mtf-combat.ts -> src/lib/combat/class-kit.ts`
- 5-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/legacy-volo-mtf-combat.ts -> src/lib/combat/races/race-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 5-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/mpmm-combat.ts -> src/lib/combat/class-kit.ts`
- 5-file cycle: `src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/mpmm-combat.ts -> src/lib/combat/races/race-combat.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts`
- 5-file cycle: `src/lib/combat/class-kit.ts -> src/lib/combat/engine.ts -> src/lib/combat/classes/combat-index.ts -> src/lib/combat/races/combat-index.ts -> src/lib/combat/races/race-combat.ts -> src/lib/combat/class-kit.ts`

## Communities (195 total, 44 thin omitted)

### Community 0 - "cn"
Cohesion: 0.02
Nodes (124): cmdk, @radix-ui/react-context-menu, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-menubar, @radix-ui/react-navigation-menu, @radix-ui/react-slot, @radix-ui/react-tooltip (+116 more)

### Community 1 - "action/route.ts"
Cohesion: 0.10
Nodes (53): assertNoPendingReaction(), ConflictError, dispatchAction(), errorResponse(), executeAction(), loadedVersion, loadState(), POST() (+45 more)

### Community 2 - "class-kit.ts"
Cohesion: 0.12
Nodes (17): ActionRule, inReach(), isOwnTurn(), KITS, markTurn(), onceThisTurn(), ReductionRule, RiderRule (+9 more)

### Community 3 - "package.json"
Cohesion: 0.02
Nodes (81): name, private, version, @ai-sdk/openai, @ai-sdk/react, bun-types, class-variance-authority, clsx (+73 more)

### Community 4 - "DnDApp.tsx"
Cohesion: 0.06
Nodes (91): lucide-react, sonner, CreateCampaignModal(), CreateCampaignModalProps, MODE_DESCRIPTION, COST_OPTIONS, KIND_LABELS, Tab (+83 more)

### Community 5 - "fighter-combat.ts"
Cohesion: 0.06
Nodes (83): featureReady(), sneakDealt(), spendAbilityUse(), abilityName(), ACTIONS, addDamage(), alive(), alliesOf() (+75 more)

### Community 6 - "race-combat.ts"
Cohesion: 0.10
Nodes (72): registerClassModule(), ActionCtx, alive(), fireConditionStart(), log(), modOf(), registerKit(), removeConditions() (+64 more)

### Community 7 - "bot.ts"
Cohesion: 0.10
Nodes (54): alliesOf(), bestAttack(), BotArchetype, BotStep, BotTurnResult, determineFacingTowards(), evaluateTargetScore(), FACING_CYCLE (+46 more)

### Community 8 - "dependencies"
Cohesion: 0.03
Nodes (75): dependencies, ai, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, cmdk, date-fns (+67 more)

### Community 9 - "Combatant"
Cohesion: 0.07
Nodes (19): Props, InitiativeTrackerProps, Props, RoleSelectorModalProps, WildShapeModalProps, ClassModule, CombatState, createMockCombatState() (+11 more)

### Community 10 - "denyCampaignAccess"
Cohesion: 0.16
Nodes (13): GET(), maxDuration, GET(), PATCH(), POST(), DELETE(), GET(), PATCH() (+5 more)

### Community 11 - "vitest"
Cohesion: 0.10
Nodes (27): vitest, combatRow(), endCombat(), fighter(), CompanionRequest, ensureCompanions(), findNonParticipants(), awardCombatVictoryXP() (+19 more)

### Community 12 - "rules.ts"
Cohesion: 0.08
Nodes (50): attackMatches(), auraRadius(), CONDITION_MODS, conscious(), FEATURE_MODS, has(), INCAPACITATING, MENTAL_ABILITIES (+42 more)

### Community 13 - "useAbility"
Cohesion: 0.11
Nodes (48): call(), extractAbilitiesFromCharacter(), classRules, SUBCLASSES, subclassRuleKeys(), useAbility(), rage(), raging() (+40 more)

### Community 14 - "library-data.ts"
Cohesion: 0.08
Nodes (38): createHeroes(), ensureDir(), initCombat(), initDragonCombat(), loadSession(), main(), printStatus(), saveState() (+30 more)

### Community 15 - "procgen/index.ts"
Cohesion: 0.08
Nodes (42): Tile(), buildAreaZones(), BIOME_NAMES, DECOR_CELL, LIQUID, PROCGEN_BIOMES, resolveProcgenBiome(), STEMS (+34 more)

### Community 16 - "ai/client.ts"
Cohesion: 0.11
Nodes (25): GET(), maxDuration, maxDuration, POST(), MISSING_API_KEY_MESSAGE, resolveApiKey(), addPromptCacheMarkers(), addReasoningEffort() (+17 more)

### Community 17 - "race-adapter.test.ts"
Cohesion: 0.17
Nodes (16): unregisterClassModule(), unregisterFeatureMod(), unregisterRace(), {
  combatantCreateMock,
  combatFindUniqueMock,
  campaignFindUniqueMock,
  spellLibraryFindManyMock,
  abilityLibraryFindManyMock,
}, registerDragonbornRules(), registeredFeatureKeys, registerTestFeatureMod(), registerTestRace() (+8 more)

### Community 18 - "adapter.ts"
Cohesion: 0.06
Nodes (43): dnd-shared, POST(), LibraryAbility, LibrarySpell, AbilityItem, SpellItem, PresetsModalProps, SpellDefinitionLike (+35 more)

### Community 19 - "compact.ts"
Cohesion: 0.14
Nodes (18): buildDmHistory(), CHRONICLE_HEADER, chronicleFromSummaries(), COMPACT_BLOCK, DmHistory, formatChronicleMessage(), isServiceStub(), MAX_VERBATIM_SAFETY (+10 more)

### Community 20 - "Field"
Cohesion: 0.11
Nodes (36): blurField(), boxPass(), Field, sampleGrid(), SUB, valueNoise(), gaps(), generateCityLayout() (+28 more)

### Community 21 - "resolve-turn-helper.ts"
Cohesion: 0.11
Nodes (32): clientWithCustomUrl, cost, customCost, cleanAssistantNarrative(), hasNarrative(), maxDuration, POST(), resolveMaxOutputTokens() (+24 more)

### Community 22 - "createClient"
Cohesion: 0.13
Nodes (21): main(), main(), streamTurn(), main(), main(), main(), createClient(), StoryArc (+13 more)

### Community 23 - "story-arc.ts"
Cohesion: 0.07
Nodes (43): main(), main(), extractJson(), main(), main(), maxDuration, POST(), POST() (+35 more)

### Community 24 - "maps/types.ts"
Cohesion: 0.23
Nodes (12): OpenBattlemap, BiomeType, SpawnZoneDefinition, UniversalVTT, UVTTLight, UVTTPoint, UVTTPortal, UVTTResolution (+4 more)

### Community 25 - "d20-helper.ts"
Cohesion: 0.17
Nodes (21): D20RollModal(), executeRoll(), handleAttackRoll(), handleCustomRoll(), handleSaveRoll(), handleSkillRoll(), ABILITY_META_LIST, AbilityKey (+13 more)

### Community 26 - "fake-supabase.ts"
Cohesion: 0.08
Nodes (28): setup(), sheetRow(), state, setup(), state, wizardSheet, client(), db() (+20 more)

### Community 27 - "import-character.ts"
Cohesion: 0.10
Nodes (33): fetchSharedCharacter(), maxDuration, POST(), ShareFetchError, SHEET_BASE_URL, AUTH, handleCreateAndSelect(), ABILITY_KEYS (+25 more)

### Community 28 - "party-leveled.ts"
Cohesion: 0.17
Nodes (21): failure(), GET(), POST(), resolveCampaign(), GET(), POST(), resolveRoom(), RouteProps (+13 more)

### Community 29 - "campaign-access.ts"
Cohesion: 0.09
Nodes (40): GET(), getHostPort(), getLanIps(), POST(), POST(), TEST_ENEMIES, GET(), GET() (+32 more)

### Community 30 - "CombatView"
Cohesion: 0.10
Nodes (30): CombatEffectsLayer(), CombatEffectsLayerProps, CombatGridProps, CombatView(), addCombatant(), answerReaction(), applyMultiSpell(), cancelTargeting() (+22 more)

### Community 31 - "Attack"
Cohesion: 0.13
Nodes (24): TestEnemy, BeastForm, MergedRaceCombatantData, MergeRaceInput, FeatureOpts, HitResolution, MODULES, scoped() (+16 more)

### Community 32 - "AI Dungeon Master — D&D 5e Solo"
Cohesion: 0.06
Nodes (34): AI Dungeon Master — D&D 5e Solo, AI забывает персонажей, API-ключ не работает, "Cannot find module 'xxx'", "Database is readonly" / "SQLite error", "Port 3000 is already in use", Быстрые кнопки, Ввод ключа в приложении (+26 more)

### Community 33 - "room-service.ts"
Cohesion: 0.10
Nodes (30): handleSubmit(), extractPartyRosterFromParticipants(), PartyAwareAct1, addExperience(), applyGameState(), createCampaignHeroSheet(), db(), ensureCampaignVersion() (+22 more)

### Community 34 - "render-map.ts"
Cohesion: 0.12
Nodes (29): COLORS, DevMaps(), loadImage(), BackgroundSource, loadImage(), loadTextures(), rendered, renderUrl() (+21 more)

### Community 35 - "tools.ts"
Cohesion: 0.10
Nodes (27): StoryAct, advanceActTool, calculateTool, campaignContextSchema, characterUpdatesSchema, createCharacterTool, dmTools, fetchPageTool (+19 more)

### Community 36 - "Hotbar.tsx"
Cohesion: 0.08
Nodes (20): @radix-ui/react-popover, AOE_SHAPE, COST_LABEL, COST_STYLE, CostKind, damageSummary(), DEFAULT_SPELL_ACCENT, diceText() (+12 more)

### Community 37 - "RoomLobby"
Cohesion: 0.18
Nodes (9): RoomLobby(), handleCopyInviteLink(), handleStartCampaign(), readStoredAiSettings(), storedAiRequestFields(), StoredAiSettings, STORY_MODEL_FALLBACK, DEFAULT_CHEAP_MODEL (+1 more)

### Community 38 - "Review Focus"
Cohesion: 0.08
Nodes (24): Execution Handoff, Global Constraints, Review Focus, Self-review, Task 1: Нормализатор параметров, Task 2: Колонка `startingSituation`, Task 3: Соло API: `POST /api/campaign` и `PATCH /api/campaign`, Task 4: Сетевой старт: маршрут и `room-service` (+16 more)

### Community 39 - "races-settings.test.ts"
Cohesion: 0.08
Nodes (37): CombatantDetails(), kitHandles(), raceRules, RACES_2014, runWithReactions(), storage, Store, askReaction() (+29 more)

### Community 40 - "MapElement"
Cohesion: 0.28
Nodes (4): Segment, wallOutlineSegments(), CombatSnapshot, MapElement

### Community 41 - "monsters/types.ts"
Cohesion: 0.09
Nodes (26): dragons, manifest, MANIFEST_PATH, raw, BossMinionsCandidate, PackCandidate, TacticalCandidate, GenerateEncounterOptions (+18 more)

### Community 42 - "race-defs.ts"
Cohesion: 0.03
Nodes (81): buildDefinition(), Calc, calcOf(), classAbilityDefinitions(), CLASSES, defineClass(), FeatureRule, findSubclass() (+73 more)

### Community 43 - "DnDApp"
Cohesion: 0.07
Nodes (17): DnDApp(), createCampaign(), handleGenerateStory(), startArcGeneration(), emptySubscribe(), getMessageError(), getMessageText(), useIsMounted() (+9 more)

### Community 44 - "TacticalMapPreset"
Cohesion: 0.36
Nodes (4): mapRegistry, MapManifestEntry, MapTagQuery, TacticalMapPreset

### Community 45 - "cave.ts"
Cohesion: 0.12
Nodes (23): addNiches(), buildFloor(), buildWater(), CaveLayout, Chamber, ChamberShape, clamp(), connectChambers() (+15 more)

### Community 46 - "use-toast.ts"
Cohesion: 0.12
Nodes (25): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle (+17 more)

### Community 47 - "engine.ts"
Cohesion: 0.08
Nodes (45): AbilityUsesFormula, bardicInspirationDie(), martialArtsDie(), rageDamageBonus(), rageUses(), resolveAbilityUses(), addDiceCount(), applyActionParameters() (+37 more)

### Community 48 - "encounters/types.ts"
Cohesion: 0.15
Nodes (24): inferBacklineRole(), isFrontlineCandidate(), RANGED_KEYWORDS, resolveArchetype(), solveBossMinions(), solveGreedyFallback(), solveHorde(), SolveOptions (+16 more)

### Community 49 - "alert-dialog.tsx"
Cohesion: 0.09
Nodes (20): @radix-ui/react-alert-dialog, react-day-picker, AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader() (+12 more)

### Community 50 - "barbarian-combat.ts"
Cohesion: 0.12
Nodes (33): dcBy(), hostilesOf(), rollOf(), saves(), weaponOf(), auraAction(), BEAST_ATTACKS, beastForm() (+25 more)

### Community 51 - "setup-params.ts"
Cohesion: 0.06
Nodes (53): zod, CampaignSetupForm(), CampaignSetupFormProps, CampaignSetupPanelProps, baseProps(), buildPartyAct1Prompt(), CombatDifficultyConfig, extractJson() (+45 more)

### Community 52 - "combat/types.ts"
Cohesion: 0.07
Nodes (40): PendingRecord, GET(), Props, ModRule, DEFAULT_SPELLS, hydrateCombatant(), hydrateMapElement(), MONSTER_DATA_KEYS (+32 more)

### Community 53 - "fighter-subclasses.ts"
Cohesion: 0.08
Nodes (30): SrdAbilityDefinition, arcaneShot(), buildDefinition(), Calc, dcOf(), FEATURE_RULES, FIGHTER_FEATURES, FIGHTER_SUBCLASSES (+22 more)

### Community 54 - "formation.ts"
Cohesion: 0.19
Nodes (18): bySizeDesc(), centroid(), closeContact(), clusterAround(), footprint(), FormationInput, FormationResult, FORMATIONS (+10 more)

### Community 55 - "character-adapter.ts"
Cohesion: 0.17
Nodes (19): classifyArmorItem(), collectRawAttacks(), DAMAGE_TYPE_RU, dedupeStringsCaseInsensitive(), detectActionCost(), detectArmorType(), detectWeapon(), extractAttacksFromCharacter() (+11 more)

### Community 56 - "class-features.ts"
Cohesion: 0.06
Nodes (44): ACTIVATION_COST, ALWAYS_POOL, CLASS_PATTERNS, damageTypeOf(), ENGINE_ACTIONS, engineActionValues(), evaluateFormula(), featureUses() (+36 more)

### Community 57 - "presets/index.ts"
Cohesion: 0.15
Nodes (11): cityStreetPreset, dungeonPrisonPreset, gladiatorArenaPreset, ALL_PRESETS, getPresetByBiome(), getPresetById(), PRESETS_BY_BIOME, PRESETS_BY_ID (+3 more)

### Community 58 - "encounter-generator.ts"
Cohesion: 0.17
Nodes (16): main(), GET(), createCombatantStub(), createMonsterDefinitionFromManifest(), generateEncounter(), loadDefaultManifest(), loadMonsterDefinition(), gen() (+8 more)

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

### Community 69 - "barbarian.ts"
Cohesion: 0.11
Nodes (9): CLEAVER_TYPES, hasFeature(), RAGE, spiritShieldDice(), STORM_ENVS, STORM_RESIST, stormEnv, TOTEMS (+1 more)

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

### Community 76 - "react"
Cohesion: 0.06
Nodes (35): @radix-ui/react-avatar, react, testAuth(), CampaignPage(), RoomBattlePage(), RoomPage(), SupabaseAuthModal(), SupabaseAuthModalProps (+27 more)

### Community 77 - "import-foundry-class-features.py"
Cohesion: 0.22
Nodes (14): activity(), by_identifier(), consumption(), formula_of(), ident_of(), key_of(), load(), Формула урона/лечения Foundry -> строка вида '2d8 + @mod (+6 more)

### Community 78 - "distanceFt"
Cohesion: 0.09
Nodes (27): alliesOf(), friendly(), bolsterTarget(), attackResolved(), castSaveDisadvantage(), cellFree(), contest(), creatureDown() (+19 more)

### Community 79 - "Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)"
Cohesion: 0.15
Nodes (12): 1. Контекст и проблема, 2. Цели и ключевые требования, 3. Архитектура и поток данных, 4.1. `POST /api/room/[code]/turn`, 4.2. `POST /api/room/[code]/turn/resolve`, 4.3. `GET /api/room/[code]/turn`, 4. Спецификация API и сервисов, 5.1. `PartyTurnBar` (`src/components/room/PartyTurnBar.tsx`) (+4 more)

### Community 80 - "Дизайн: Объединение всех справочников D&D 5e (2014) в общую библиотеку `dnd-shared`"
Cohesion: 0.11
Nodes (17): 1. Цель и ключевые ограничения, 2.1. Официальный контент D&D 5e (2014), 2.2. Хоумбрю в `dnd-shared/homebrew`, 2. Источник истины и политика по хоумбрю, 3.1. Карта сабпат-экспортов (`package.json`), 3.2. Контракты поиска и совместимость с Next.js 16 / `tsx`, 3. Архитектура пакета `dnd-shared`, 4.1. `dnd5e-character-sheet` (ветка `dev`) (+9 more)

### Community 81 - "RoomService"
Cohesion: 0.07
Nodes (33): checkAllTables(), inspectCharactersSchema(), inspectData(), listCharacters(), listUsers(), GET(), guestHits, guestRateLimited() (+25 more)

### Community 82 - "Review Focus"
Cohesion: 0.20
Nodes (9): Global Constraints, Review Focus, Task 1: Генератор случайных чисел и субклеточные поля, Task 2: План пещеры из заготовленных частей, Task 3: Разметка, зоны и `generateProcgenMap`, Task 4: Подключение к созданию боя, Task 5: Текстуры и отрисовка в браузере, Task 6: Архив старых карт и визуальная проверка (+1 more)

### Community 83 - "Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness"
Cohesion: 0.17
Nodes (11): 1.1. Механика работы KV-кэша DeepSeek (Prefix Caching), 1.2. Диагностика текущего состояния `dnd-ai-master` (Cache Hit ~0%), 1. Контекст и проблема, 2. Архитектура: Модульная 3-зонная модель контекста, 3.1. `src/lib/ai/caching/frozen-prefix.ts`, 3.2. `src/lib/ai/caching/ephemeral-tail.ts`, 3.3. `src/lib/ai/caching/milestone-compactor.ts`, 3. Компоненты и интерфейсы (+3 more)

### Community 84 - "Architecture Design: Multi-Page Routing Architecture"
Cohesion: 0.17
Nodes (11): 1. Problem Statement & Motivation, 2.1 Route Map, 2. Target Routing Architecture, 3.1 `HomeHubView` (`src/components/home/HomeHubView.tsx`), 3.2 `RoomSessionView` (`src/components/room/RoomSessionView.tsx`), 3.3 `SoloCampaignView` (`src/components/campaign/SoloCampaignView.tsx`), 3.4 Shared State & Context, 3. Component Architecture & Decomposition (+3 more)

### Community 85 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 86 - "monster-adapter.ts"
Cohesion: 0.16
Nodes (18): HotbarProps, crToProfBonus(), formatCR(), getAttackStem(), MONSTER_TYPE_RU, MonsterAdapterOptions, monsterDefinitionToCombatant(), parseCountBeforeStem() (+10 more)

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

### Community 91 - "ai"
Cohesion: 0.24
Nodes (11): ai, compactHistoryWithMilestones(), DEFAULT_CHUNK_SIZE, DEFAULT_MAX_VERBATIM, extractExistingChronicleBullets(), extractMessageText(), formatMessageBullet(), MilestoneCompactorOptions (+3 more)

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

### Community 97 - "monster-parser-engine.ts"
Cohesion: 0.18
Nodes (17): cheerio, DAMAGE_TYPE_MAP, normalizeDamageType(), parseAbilities(), parseAction(), parseCR(), parseDamageTypes(), ParseMeta (+9 more)

### Community 98 - "hero-overlay.ts"
Cohesion: 0.20
Nodes (14): @supabase/supabase-js, count(), currentHitPoints(), HeroView, Linkable, overlaySheet(), proficiencyBonus(), text() (+6 more)

### Community 99 - "Архитектура"
Cohesion: 0.22
Nodes (8): 1. Зоны заклинаний (`MapElement` с `isSpellZone: true`), 2. Повторные действия (`Heat Metal` и др.), 3. Действие освобождения (`Escape Action`), 4. Исправление `spells.json`, 5. Высшая невидимость (`Greater Invisibility`), Архитектура, Дизайн: Динамические зоны заклинаний, повторные действия и механики 5e, Цель

### Community 100 - "generator.ts"
Cohesion: 0.09
Nodes (22): GeneratedEncounter, Formation, FORMATION_LABELS, applyFormation(), CLASS_DEFAULT_SAVING_THROWS, EnemyInput, EnvironmentType, GeneratedMapElement (+14 more)

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

### Community 106 - "frozen-prefix.ts"
Cohesion: 0.15
Nodes (20): buildEphemeralSceneTail, EphemeralNpcState, EphemeralPartyMemberState, EphemeralRecentEvent, EphemeralSceneState, fetchEphemeralSceneTail(), fetchRelevantMemories(), formatSceneSnapshot() (+12 more)

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

### Community 117 - "import-character/route.ts"
Cohesion: 0.15
Nodes (21): ABILITY_RU_TO_EN, DAMAGE_TYPE_RU, detectActionCost(), detectWeapon(), LEGACY_ABILITY_NAMES, parseBonus(), parseDamageString(), POST() (+13 more)

### Community 118 - "network-banner.js"
Cohesion: 0.33
Nodes (5): interfaces, localIps, os, otherIps, radminIps

### Community 119 - "prepare-prisma-for-env.js"
Cohesion: 0.33
Nodes (5): fs, isVercel, path, schema, schemaPath

### Community 120 - "redirects.test.tsx"
Cohesion: 0.47
Nodes (3): HomePage(), mockRedirect, RoomsCodePage()

### Community 121 - "moveCombatant"
Cohesion: 0.09
Nodes (39): GET(), CombatGrid(), getCellFromEvent(), handleGlobalMouseMove(), handleGlobalMouseUp(), handleSvgClick(), handleSvgMouseMove(), handleSvgMouseUp() (+31 more)

### Community 122 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:generate, db:migrate, db:push, db:reset, dev, lint (+3 more)

### Community 123 - "room/types.ts"
Cohesion: 0.09
Nodes (30): maxDuration, POST(), GET(), maxDuration, POST(), canSubmitPlayerTurn(), CoopTurnBar(), CoopTurnBarProps (+22 more)

### Community 125 - "encounter-request.ts"
Cohesion: 0.19
Nodes (13): startCombatTool, applyLeaderName(), ARCHETYPE_ALIASES, CAMPAIGN_BUDGET_SCALE, CAMPAIGN_TO_ENCOUNTER, campaignBudgetScale(), normalizeArchetype(), resolveEncounterDifficulty() (+5 more)

### Community 126 - "Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою"
Cohesion: 0.50
Nodes (3): 1. Цель, 2. Глобальные ограничения, Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

### Community 127 - "scene-synchronizer.ts"
Cohesion: 0.19
Nodes (15): AuthMode, CompactOptions, resolveCheapModel(), applyStatusToNotes(), extractJson(), extractStatusFromNotes(), newNpcSchema, SceneUpdate (+7 more)

### Community 169 - "pacing-director.test.ts"
Cohesion: 0.39
Nodes (6): DMAssistAction, evaluateCombatPacing(), PacingEvaluation, PacingThreatLevel, shouldTriggerEncounterRelief(), createMockState()

### Community 170 - "devDependencies"
Cohesion: 0.08
Nodes (17): devDependencies, bun-types, cheerio, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tw-animate-css (+9 more)

### Community 171 - "validation.ts"
Cohesion: 0.33
Nodes (7): CharacterCandidate, EvaluatedCharacter, EvaluatedCharacterList, extractCharacterLevel(), filterUserCharactersForRoom(), LevelValidationResult, validateCharacterForRoom()

### Community 173 - "open-map-service.ts"
Cohesion: 0.33
Nodes (6): GET(), getPopularTags(), OPEN_BATTLEMAP_CATALOG, OpenMapSearchQuery, POPULAR_MAP_TAGS, searchOpenMaps()

### Community 174 - "File Structure"
Cohesion: 0.25
Nodes (7): `dnd-shared` Stage 3 (Weapons, Armors, Gear, Tools & Potions) Implementation Plan, File Structure, Global Constraints, Task 1: `dnd-shared` — Build Weapons, Armors/Items & Potions (`./items`, `./items-core`) & Push `<SHA_3>`, Task 2: `dnd5e-character-sheet` (`dev`) — Migrate `dnd-weapons.ts`, `items.ts`, `potions-data.ts` to `<SHA_3>` [Parallel Agent A, Hydrogen], Task 3: `ai_master_n_battle` (`dev`) — Migrate `srd/adapter.ts` Weapons to `dnd-shared/items` (`<SHA_3>`) [Parallel Agent B, Hydrogen], Task 4: Cross-Repo Stage 3 Verification

### Community 175 - "zones.ts"
Cohesion: 0.44
Nodes (7): CellKind, anchor(), blocked(), buildSpawnZones(), buildZonesFromAreas(), nearestFloor(), pathDistances()

### Community 176 - "initiative.ts"
Cohesion: 0.19
Nodes (11): getNextTurn(), InitiativeInput, InitiativeRoll, NextTurnResult, reconcileTurnOrder(), rollInitiativeFor(), Sortable, sortByInitiative() (+3 more)

### Community 177 - "AttacksAbilitiesEditor"
Cohesion: 0.29
Nodes (5): AttacksAbilitiesEditor(), addAbilityFromLibrary(), save(), emptyAttack(), rebuildHotbar()

### Community 178 - "spawn-director.ts"
Cohesion: 0.18
Nodes (12): forestAmbushPreset, templePreset, assignTacticalSpawns(), BACKLINE_CLASSES, bodyFits(), BOSS_KEYWORDS, createDefaultSpawnZones(), findClosestPassableCell() (+4 more)

### Community 179 - "CharacterCard.tsx"
Cohesion: 0.08
Nodes (24): @radix-ui/react-progress, zustand, abilityMod(), CharacterCard(), getRelationTier(), modStr(), RelationTier, typeColors (+16 more)

### Community 180 - "combat-sheet-sync.ts"
Cohesion: 0.23
Nodes (11): @prisma/client, isEnemyDefeatedOrFled(), POST(), AUTH, CombatantRow, combatantToSheetPatch(), count(), parseJson() (+3 more)

### Community 181 - "biome-matcher.ts"
Cohesion: 0.25
Nodes (11): BIOME_CONFIGS, BiomeAffinity, entryMatchesKeywords(), factionKeywords(), getBiomeCandidatePool(), getFactionCandidatePool(), UNIVERSAL_FALLBACK_KEYWORDS, UNIVERSAL_FALLBACK_TYPES (+3 more)

### Community 182 - "File Structure"
Cohesion: 0.25
Nodes (7): `dnd-shared` Stage 4 (Feats, Backgrounds, Homebrew Traits, Conditions & Monsters) Implementation Plan, File Structure, Global Constraints, Task 1: `dnd-shared` — Build Feats, Backgrounds, Homebrew Traits, Conditions & Monsters (`v1.0.0`) & Push `<SHA_4>`, Task 2: `dnd5e-character-sheet` (`dev`) — Migrate Feats, Backgrounds, Traits & Conditions to `<SHA_4>` [Parallel Agent A, Hydrogen], Task 3: `ai_master_n_battle` (`dev`) — Migrate `srd/adapter.ts` Monsters to `dnd-shared/monsters` (`<SHA_4>`) [Parallel Agent B, Hydrogen], Task 4: Final Cross-Repo Verification & Unification Close-Out

### Community 183 - "aoe-templates.ts"
Cohesion: 0.30
Nodes (10): ClassifiedTargets, classifyAoeTargets(), DIRECTION_STEPS, DirStep, getConeCells(), getCubeCells(), getLineCells(), getSphereCells() (+2 more)

### Community 184 - "ActionCost"
Cohesion: 0.52
Nodes (7): EditableLibraryItem, AttackItem, AttackDefinition, SRDWeapon, ActionCost, AttackKind, DamageRoll

### Community 186 - "Cell"
Cohesion: 0.33
Nodes (6): DoorRoute, FiringPosition, CastContext, MoveOutcome, PathResult, Cell

### Community 187 - "opportunity-attacks.test.ts"
Cohesion: 0.40
Nodes (3): createTestCombatState(), mockMeleeAttack, mockRangedAttack

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
- **1108 isolated node(s):** `supabase`, `$schema`, `style`, `rsc`, `tsx` (+1103 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1484 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `action/route.ts`, `package.json`, `bot.ts`, `Combatant`, `denyCampaignAccess`, `rules.ts`, `useAbility`, `library-data.ts`, `procgen/index.ts`, `ai/client.ts`, `race-adapter.test.ts`, `adapter.ts`, `compact.ts`, `Field`, `resolve-turn-helper.ts`, `createClient`, `story-arc.ts`, `maps/types.ts`, `d20-helper.ts`, `fake-supabase.ts`, `import-character.ts`, `character-adapter.ts`, `campaign-access.ts`, `CombatView`, `party-leveled.ts`, `room-service.ts`, `render-map.ts`, `races-settings.test.ts`, `MapElement`, `pacing-director.test.ts`, `monsters/types.ts`, `DnDApp`, `TacticalMapPreset`, `cave.ts`, `validation.ts`, `engine.ts`, `encounters/types.ts`, `initiative.ts`, `spawn-director.ts`, `setup-params.ts`, `combat-sheet-sync.ts`, `CharacterCard.tsx`, `biome-matcher.ts`, `aoe-templates.ts`, `combat/types.ts`, `presets/index.ts`, `encounter-generator.ts`, `class-features.ts`, `loot-generator.ts`, `parseChallengeRating`, `fighter-subclasses.ts`, `formation.ts`, `opportunity-attacks.test.ts`, `wild-shape.test.ts`, `combat-access.ts`, `react`, `RoomService`, `ai`, `monster-parser-engine.ts`, `hero-overlay.ts`, `generator.ts`, `frozen-prefix.ts`, `redirects.test.tsx`, `moveCombatant`, `room/types.ts`, `encounter-request.ts`, `scene-synchronizer.ts`?**
  _High betweenness centrality (0.175) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `cn`, `render-map.ts`, `package.json`, `DnDApp.tsx`, `Hotbar.tsx`, `form.tsx`, `use-toast.ts`, `chart.tsx`, `alert-dialog.tsx`, `setup-params.ts`, `CharacterCard.tsx`, `carousel.tsx`, `moveCombatant`, `room/types.ts`, `CombatView`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `Combatant` connect `Combatant` to `action/route.ts`, `class-kit.ts`, `DnDApp.tsx`, `fighter-combat.ts`, `race-combat.ts`, `bot.ts`, `rules.ts`, `useAbility`, `library-data.ts`, `race-adapter.test.ts`, `adapter.ts`, `Attack`, `Hotbar.tsx`, `races-settings.test.ts`, `MapElement`, `pacing-director.test.ts`, `monsters/types.ts`, `race-defs.ts`, `engine.ts`, `encounters/types.ts`, `initiative.ts`, `barbarian-combat.ts`, `spawn-director.ts`, `combat/types.ts`, `fighter-subclasses.ts`, `character-adapter.ts`, `aoe-templates.ts`, `class-features.ts`, `encounter-generator.ts`, `Cell`, `opportunity-attacks.test.ts`, `wild-shape.test.ts`, `barbarian.ts`, `distanceFt`, `monster-adapter.ts`, `generator.ts`, `moveCombatant`, `encounter-request.ts`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `supabase`, `$schema`, `style` to the rest of the system?**
  _1108 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.02120730137090055 - nodes in this community are weakly interconnected._
- **Should `action/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10303030303030303 - nodes in this community are weakly interconnected._
- **Should `class-kit.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11578947368421053 - nodes in this community are weakly interconnected._