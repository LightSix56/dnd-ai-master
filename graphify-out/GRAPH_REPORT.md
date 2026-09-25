# Graph Report - battle+ai  (2026-09-25)

## Corpus Check
- 3276 files · ~2,040,231 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2290 nodes · 5910 edges · 150 communities (105 shown, 42 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 70 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `246a2ef4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Hotbar.tsx
- scene-synchronizer.ts
- package.json
- dependencies
- RoomCampaignSetupModal.tsx
- react
- encounter-generator.ts
- command.tsx
- CoopTurnBar.tsx
- Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)
- presets/index.ts
- CombatView.tsx
- DnDApp.tsx
- supabase/client.ts
- room-service.ts
- archetype-solver.ts
- Supabase
- Global Constraints
- AI Dungeon Master — D&D 5e Solo
- CombatView
- Changelog
- action/route.ts
- D20RollModal.tsx
- Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness
- story-arc.ts
- loot-generator.ts
- AttacksAbilitiesEditor.tsx
- tools.ts
- monster-parser-engine.ts
- alert-dialog.tsx
- use-toast.ts
- library-data.ts
- Changelog
- bot.ts
- combat/types.ts
- Writing Guidelines for Postgres References
- context-menu.tsx
- createClient
- generator.ts
- navigation-menu.tsx
- resolve-turn-helper.ts
- models.ts
- LibraryItemEditorModal.tsx
- compilerOptions
- cost.ts
- Section Definitions
- vitest
- components.json
- Attack
- maps/types.ts
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- open-map-service.ts
- supabase/types.ts
- canonical-biomes.ts
- spawn-director.ts
- AttackKind
- Supabase Postgres Best Practices
- carousel.tsx
- Архитектурный дизайн: Синхронизация комнаты, живой стриминг ответов Мастера и учёт токенов
- CharacterInventoryModal.tsx
- rules.ts
- serialize.ts
- form.tsx
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- preset-data.ts
- Prompt Cache Telemetry & Visibility Implementation Plan
- pacing-director.test.ts
- utils.ts
- accordion.tsx
- chart.tsx
- dropdown-menu.tsx
- devDependencies
- advanced-full-text-search.md
- Multiplayer Network Infrastructure & Gameplay Resilience Implementation Plan
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- Global Constraints
- conn-limits.md
- layout.tsx
- conn-pooling.md
- monsters/types.ts
- import-character.ts
- conn-prepared-statements.md
- data-batch-inserts.md
- @supabase/ssr
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- drawer.tsx
- lock-deadlock-prevention.md
- lock-short-transactions.md
- lock-skip-locked.md
- monitor-explain-analyze.md
- monitor-pg-stat-statements.md
- test-key/route.ts
- monitor-vacuum-analyze.md
- query-composite-indexes.md
- query-covering-indexes.md
- query-index-types.md
- eslint.config.mjs
- query-missing-indexes.md
- postcss.config.mjs
- import-character/route.ts
- Global Constraints
- query-partial-indexes.md
- hover-card.tsx
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
- .mcp.json
- vercel.json
- encounters/types.ts
- scripts
- cn
- mapRegistry
- compact.ts
- movement.ts
- JoinRoomModal.tsx
- validation.ts
- resizable.tsx
- find-dragons.ts
- milestone-compactor.ts
- LibraryItemEditorModal
- prepare-prisma-for-env.js
- LibraryManagerModal
- chat/route.ts
- engine.ts
- Architecture Design: Multi-Page Routing Architecture
- Combatant
- manual-combat-runner.ts
- HomeHubView.tsx
- party-arc-generator.ts
- Global Constraints
- toggle-group.tsx
- redirects.test.tsx
- sidebar.tsx
- Global Constraints
- network-banner.js
- Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

## God Nodes (most connected - your core abstractions)
1. `cn()` - 234 edges
2. `vitest` - 86 edges
3. `react` - 83 edges
4. `Combatant` - 58 edges
5. `lucide-react` - 50 edges
6. `db` - 49 edges
7. `RoomService` - 49 edges
8. `runBotTurn()` - 46 edges
9. `CombatState` - 46 edges
10. `POST()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `resolveStoryModel()`  [EXTRACTED]
  scripts/check-polza-ping.ts → src/lib/ai/models.ts
- `checkAllTables()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/check-supabase-rooms.ts → src/lib/supabase/client.ts
- `inspectCharactersSchema()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-characters.ts → src/lib/supabase/client.ts
- `inspectData()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-data.ts → src/lib/supabase/client.ts
- `listCharacters()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/list-chars.ts → src/lib/supabase/client.ts

## Import Cycles
- None detected.

## Communities (150 total, 42 thin omitted)

### Community 0 - "Hotbar.tsx"
Cohesion: 0.16
Nodes (10): @radix-ui/react-popover, COST_LABEL, damageSummary(), extractWeaponBase(), Hotbar(), spellSummary(), Popover(), PopoverContent() (+2 more)

### Community 1 - "scene-synchronizer.ts"
Cohesion: 0.36
Nodes (8): zod, applyStatusToNotes(), extractJson(), extractStatusFromNotes(), newNpcSchema, SceneUpdate, sceneUpdateSchema, syncSceneState()

### Community 2 - "package.json"
Cohesion: 0.03
Nodes (50): name, private, version, @ai-sdk/openai, @ai-sdk/react, bun-types, clsx, date-fns (+42 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (74): dependencies, ai, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, cmdk, date-fns (+66 more)

### Community 4 - "RoomCampaignSetupModal.tsx"
Cohesion: 0.27
Nodes (8): CampaignSetupFormValues, DIFFICULTY_OPTIONS, RoomCampaignSetupModal(), SETTING_PRESETS, SITUATION_OPTIONS, validateCampaignSetupInput(), StartingSituation, StartRoomCampaignInput

### Community 5 - "react"
Cohesion: 0.11
Nodes (14): react, testAuth(), CampaignPage(), RoomPage(), SupabaseAuthModal(), SupabaseAuthModalProps, CreateRoomModal(), CreateRoomModalProps (+6 more)

### Community 6 - "encounter-generator.ts"
Cohesion: 0.23
Nodes (10): main(), createCombatantStub(), generateEncounter(), GenerateEncounterOptions, mockManifest, EncounterRequest, calculateAwardedXP(), calculatePartyXPBudget() (+2 more)

### Community 7 - "command.tsx"
Cohesion: 0.18
Nodes (9): cmdk, Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator() (+1 more)

### Community 8 - "CoopTurnBar.tsx"
Cohesion: 0.36
Nodes (8): canSubmitPlayerTurn(), CoopTurnBar(), CoopTurnBarProps, validatePlayerAction(), formatTypingMessage(), LiveTypingIndicator(), LiveTypingIndicatorProps, TypingUser

### Community 9 - "Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)"
Cohesion: 0.15
Nodes (12): 1. Контекст и проблема, 2. Цели и ключевые требования, 3. Архитектура и поток данных, 4.1. `POST /api/room/[code]/turn`, 4.2. `POST /api/room/[code]/turn/resolve`, 4.3. `GET /api/room/[code]/turn`, 4. Спецификация API и сервисов, 5.1. `PartyTurnBar` (`src/components/room/PartyTurnBar.tsx`) (+4 more)

### Community 10 - "presets/index.ts"
Cohesion: 0.19
Nodes (11): cityStreetPreset, dungeonPrisonPreset, forestAmbushPreset, gladiatorArenaPreset, PRESETS_BY_ID, lavaCavePreset, shipBattlePreset, tavernPreset (+3 more)

### Community 11 - "CombatView.tsx"
Cohesion: 0.10
Nodes (41): lucide-react, @radix-ui/react-slot, BestiaryBrowser(), BestiaryBrowserProps, CR_OPTIONS, CREATURE_TYPES, CombatEndSummary, CombatViewProps (+33 more)

### Community 12 - "DnDApp.tsx"
Cohesion: 0.06
Nodes (24): CostStatsModal(), ArcState, ChatMessage, DnDApp(), handleGenerateStory(), startArcGeneration(), emptySubscribe(), formatInline() (+16 more)

### Community 13 - "supabase/client.ts"
Cohesion: 0.10
Nodes (22): checkAllTables(), inspectCharactersSchema(), inspectData(), listCharacters(), listUsers(), GET(), POST(), POST() (+14 more)

### Community 14 - "room-service.ts"
Cohesion: 0.12
Nodes (21): @supabase/supabase-js, uuid, verifyMultiplayerRoomFlow(), DELETE(), DELETE(), GET(), POST(), GET() (+13 more)

### Community 15 - "archetype-solver.ts"
Cohesion: 0.17
Nodes (22): BossMinionsCandidate, inferBacklineRole(), isFrontlineCandidate(), PackCandidate, RANGED_KEYWORDS, resolveArchetype(), solveBossMinions(), solveGreedyFallback() (+14 more)

### Community 16 - "Supabase"
Cohesion: 0.11
Nodes (15): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Debugging, Making and Committing Schema Changes (+7 more)

### Community 17 - "Global Constraints"
Cohesion: 0.18
Nodes (10): Global Constraints, Task 1: Backend Turn API — Блокировка повторной отправки и авто-резолвинг, Task 2: Host Force-Resolve — Завершение раунда с AFK-персонажами, Task 3: Компонент очереди отряда `PartyTurnBar`, Task 4: Интеграция пошагового цикла в `DnDApp.tsx`, Task 5: Финальная верификация, актуализация графа и публикация в Git, Автоматические тесты, План верификации (+2 more)

### Community 18 - "AI Dungeon Master — D&D 5e Solo"
Cohesion: 0.06
Nodes (34): AI Dungeon Master — D&D 5e Solo, AI забывает персонажей, API-ключ не работает, "Cannot find module 'xxx'", "Database is readonly" / "SQLite error", "Port 3000 is already in use", Быстрые кнопки, Ввод ключа в приложении (+26 more)

### Community 19 - "CombatView"
Cohesion: 0.11
Nodes (27): CombatEffectsLayer(), CombatEffectsLayerProps, CombatGridProps, CombatView(), addCombatant(), applyMultiSpell(), cancelTargeting(), continueAfterBot() (+19 more)

### Community 20 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 21 - "action/route.ts"
Cohesion: 0.14
Nodes (45): loadState(), POST(), respond(), saveState(), syncCharacterPotionConsumed(), getBeastFormById(), isBotTurn(), applyActionParameters() (+37 more)

### Community 22 - "D20RollModal.tsx"
Cohesion: 0.13
Nodes (30): zustand, CharacterInventoryModalProps, D20RollModal(), executeRoll(), handleAttackRoll(), handleCustomRoll(), handleSaveRoll(), handleSkillRoll() (+22 more)

### Community 23 - "Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness"
Cohesion: 0.17
Nodes (11): 1.1. Механика работы KV-кэша DeepSeek (Prefix Caching), 1.2. Диагностика текущего состояния `dnd-ai-master` (Cache Hit ~0%), 1. Контекст и проблема, 2. Архитектура: Модульная 3-зонная модель контекста, 3.1. `src/lib/ai/caching/frozen-prefix.ts`, 3.2. `src/lib/ai/caching/ephemeral-tail.ts`, 3.3. `src/lib/ai/caching/milestone-compactor.ts`, 3. Компоненты и интерфейсы (+3 more)

### Community 24 - "story-arc.ts"
Cohesion: 0.14
Nodes (26): main(), maxDuration, POST(), GET(), maxDuration, POST(), resolveStoryModel(), actSchema (+18 more)

### Community 25 - "loot-generator.ts"
Cohesion: 0.15
Nodes (17): BOSS_POTION_ITEM, BOSS_SCROLL_ITEM, CR_TO_XP, generateCombatLoot(), getXpForCr(), parseEnemyCr(), rollDice(), THEMATIC_BIOME_DROPS (+9 more)

### Community 26 - "AttacksAbilitiesEditor.tsx"
Cohesion: 0.13
Nodes (11): AttacksAbilitiesEditor(), save(), COST_OPTIONS, emptyAttack(), KIND_LABELS, Props, rebuildHotbar(), Tab (+3 more)

### Community 27 - "tools.ts"
Cohesion: 0.10
Nodes (27): StoryAct, advanceActTool, campaignContextSchema, characterUpdatesSchema, createCharacterTool, dmTools, fetchPageTool, formatAct() (+19 more)

### Community 28 - "monster-parser-engine.ts"
Cohesion: 0.18
Nodes (17): cheerio, DAMAGE_TYPE_MAP, normalizeDamageType(), parseAbilities(), parseAction(), parseCR(), parseDamageTypes(), ParseMeta (+9 more)

### Community 29 - "alert-dialog.tsx"
Cohesion: 0.15
Nodes (9): @radix-ui/react-alert-dialog, AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay() (+1 more)

### Community 30 - "use-toast.ts"
Cohesion: 0.12
Nodes (25): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle (+17 more)

### Community 31 - "library-data.ts"
Cohesion: 0.08
Nodes (38): LibraryAbility, LibrarySpell, AbilityItem, SpellItem, SpellDefinitionLike, ABILITY_ALIASES, ABILITY_LIBRARY, AbilityDefinition (+30 more)

### Community 32 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 33 - "bot.ts"
Cohesion: 0.14
Nodes (35): CombatantDetails(), alliesOf(), bestAttack(), BotArchetype, BotStep, BotTurnResult, determineFacingTowards(), evaluateTargetScore() (+27 more)

### Community 34 - "combat/types.ts"
Cohesion: 0.09
Nodes (31): crToProfBonus(), getAttackStem(), MonsterAdapterOptions, monsterDefinitionToCombatant(), parseCountBeforeStem(), parseMultiattack(), safeId(), createTestCombatState() (+23 more)

### Community 35 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 36 - "context-menu.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-context-menu, ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut() (+2 more)

### Community 37 - "createClient"
Cohesion: 0.13
Nodes (26): ai, main(), main(), main(), streamTurn(), main(), extractJson(), main() (+18 more)

### Community 38 - "generator.ts"
Cohesion: 0.16
Nodes (17): POST(), TEST_ENEMIES, TestEnemy, calculateTool, CLASS_DEFAULT_SAVING_THROWS, createTacticalEncounter(), EnemyInput, EnvironmentType (+9 more)

### Community 39 - "navigation-menu.tsx"
Cohesion: 0.20
Nodes (10): @radix-ui/react-navigation-menu, NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger() (+2 more)

### Community 40 - "resolve-turn-helper.ts"
Cohesion: 0.13
Nodes (22): POST(), GET(), POST(), PartyTurnBarProps, buildFrozenRoomSystemPrompt(), resolveActiveRoomTurnHelper(), ResolveActiveRoomTurnOptions, ResolveActiveRoomTurnResult (+14 more)

### Community 41 - "models.ts"
Cohesion: 0.18
Nodes (9): maxDuration, BOOKKEEPING_TOOLS, CHEAP_MODEL, DEFAULT_CHEAP_MODEL, DEFAULT_DM_MODEL, DEFAULT_STORY_MODEL, FEATURED_MODELS, FeaturedModelInfo (+1 more)

### Community 42 - "LibraryItemEditorModal.tsx"
Cohesion: 0.11
Nodes (25): sonner, ImportCharacterModal(), ImportCharacterModalProps, COMMON_CONDITIONS, DAMAGE_TYPES, LibraryCategory, Props, SetupModalProps (+17 more)

### Community 43 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 44 - "cost.ts"
Cohesion: 0.24
Nodes (9): clientWithCustomUrl, cost, customCost, calculateCostRub(), extractCachedTokens(), extractTokenUsage(), KNOWN_MODEL_PRICING, ModelPricing (+1 more)

### Community 45 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 46 - "vitest"
Cohesion: 0.12
Nodes (13): @prisma/client, vitest, { mockStreamText }, GET(), getHostPort(), getLanIps(), isEnemyDefeatedOrFled(), POST() (+5 more)

### Community 47 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 48 - "Attack"
Cohesion: 0.33
Nodes (8): WeaponProfile, BEAST_FORMS, BeastForm, AttackOutcome, createAuditCombatant(), createAuditState(), Attack, CombatAbility

### Community 49 - "maps/types.ts"
Cohesion: 0.18
Nodes (14): ToggleDoorOutcome, OpenBattlemap, BiomeType, MapTagQuery, SpawnZoneDefinition, UniversalVTT, UVTTLight, UVTTPoint (+6 more)

### Community 50 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.25
Nodes (7): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), 🗺️ 4. Категорический запрет визуальных заглушек и обязательный VTT-рендеринг (No Visual Stubs & Mandatory Real Battlemap Rendering), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 51 - "open-map-service.ts"
Cohesion: 0.35
Nodes (8): GET(), getOpenMapById(), getPopularTags(), OPEN_BATTLEMAP_CATALOG, OpenMapSearchQuery, POPULAR_MAP_TAGS, resolveBattlemapForNarrative(), searchOpenMaps()

### Community 52 - "supabase/types.ts"
Cohesion: 0.25
Nodes (7): PartyBond, RoomParticipantRecord, RoomRecord, RoomStatus, RoomTurnRecord, SupabaseCharacterRecord, TurnStatus

### Community 53 - "canonical-biomes.ts"
Cohesion: 0.11
Nodes (17): astralRiftPreset, banditCampPreset, bridgeChasmPreset, CANONICAL_PRESETS_EXTENDED, castleCourtyardPreset, desertDunesPreset, docksHarborPreset, foundryForgePreset (+9 more)

### Community 54 - "spawn-director.ts"
Cohesion: 0.18
Nodes (12): POST(), ALL_PRESETS, getPresetById(), PRESETS_BY_BIOME, assignTacticalSpawns(), BACKLINE_CLASSES, BOSS_KEYWORDS, createDefaultSpawnZones() (+4 more)

### Community 55 - "AttackKind"
Cohesion: 0.36
Nodes (7): EditableLibraryItem, AttackItem, AttackDefinition, SRDWeapon, ActionCost, AttackKind, DamageRoll

### Community 56 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 57 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 58 - "Архитектурный дизайн: Синхронизация комнаты, живой стриминг ответов Мастера и учёт токенов"
Cohesion: 0.18
Nodes (10): 1. Контекст и цели, 2.1. Стриминг и Realtime-шина (Supabase Realtime Broadcast), 2.2. Завершение генерации и персистентность (Persistence & Fallback), 2. Архитектура и поток данных (Data Flow), 3.1. Лента сообщений чата (`DnDApp.tsx`), 3.2. Нижняя панель действий (`PartyTurnBar.tsx`), 3.3. Блок расхода токенов и стоимости (`MessageBubble.tsx`), 3. Изменения компонентов интерфейса (+2 more)

### Community 59 - "CharacterInventoryModal.tsx"
Cohesion: 0.16
Nodes (16): CharacterInventoryModal(), handleAddPotion(), handleDrinkPotion(), createUniqueId(), getSyncTimestamp(), InventoryGear, InventoryPotion, parseInventory() (+8 more)

### Community 60 - "rules.ts"
Cohesion: 0.13
Nodes (19): ActionCostCheck, AdvantageResult, applyHealing(), AttackResolution, computeAttackAdvantage(), consumeAttackConditions(), DamageResult, DeathSaveResult (+11 more)

### Community 61 - "serialize.ts"
Cohesion: 0.29
Nodes (11): GET(), DEFAULT_SPELLS, hydrateCombat(), hydrateCombatant(), hydrateMapElement(), normalizeAttack(), normalizeSpells(), safeParse() (+3 more)

### Community 62 - "form.tsx"
Cohesion: 0.19
Nodes (12): @radix-ui/react-label, react-hook-form, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext (+4 more)

### Community 63 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.29
Nodes (6): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 64 - "preset-data.ts"
Cohesion: 0.14
Nodes (15): POST(), GET(), GET(), POST(), PresetsModalProps, createMonsterDefinitionFromManifest(), loadDefaultManifest(), loadMonsterDefinition() (+7 more)

### Community 65 - "Prompt Cache Telemetry & Visibility Implementation Plan"
Cohesion: 0.33
Nodes (5): Prompt Cache Telemetry & Visibility Implementation Plan, Task 1: Prompt cache extraction helper with TDD (`src/lib/ai/cost.ts`), Task 2: Integrate robust token extraction in API routes, Task 3: UI Transparency in `MessageBubble` & Header Trigger (`DnDApp.tsx`), Task 4: Full Verification, Graphify & Git Push

### Community 66 - "pacing-director.test.ts"
Cohesion: 0.39
Nodes (6): DMAssistAction, evaluateCombatPacing(), PacingEvaluation, PacingThreatLevel, shouldTriggerEncounterRelief(), createMockState()

### Community 67 - "utils.ts"
Cohesion: 0.33
Nodes (4): @radix-ui/react-checkbox, copyRoomLink(), Checkbox(), copyToClipboard()

### Community 68 - "accordion.tsx"
Cohesion: 0.33
Nodes (4): @radix-ui/react-accordion, AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 69 - "chart.tsx"
Cohesion: 0.23
Nodes (10): recharts, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 70 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-dropdown-menu, DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut() (+2 more)

### Community 71 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, bun-types, cheerio, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tw-animate-css (+5 more)

### Community 73 - "Multiplayer Network Infrastructure & Gameplay Resilience Implementation Plan"
Cohesion: 0.29
Nodes (6): Multiplayer Network Infrastructure & Gameplay Resilience Implementation Plan, Task 1: 1-Click Guest Authentication & Client Auth Guard, Task 2: Opening Story & Campaign Chat Synchronization for Guests, Task 3: Atomic Concurrency Lock on Turn Resolution, Task 4: Realtime Reliability & Polling Fallback in `useRoomRealtime`, Task 5: Full Regression Testing, Graph Update, and Git Push

### Community 76 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Room Streaming, Live Synchronization and Token Tracking Implementation Plan, Task 1: Подсчёт токенов, стоимости и сохранение `_stats` в `resolve-turn-helper.ts`, Task 2: Потоковый стриминг ответа Мастера в `resolve-turn-helper.ts` и `api/room/[code]/turn/resolve`, Task 3: Клиентская подписка на Supabase Realtime `room:${roomId}` (`dm_stream`) и трансляция чанков, Task 4: Перенос статуса Мастера в чат и очистка `PartyTurnBar.tsx`, Task 5: Полная верификация, сборка и Git Push

### Community 78 - "layout.tsx"
Cohesion: 0.20
Nodes (7): nextConfig, next, next-themes, geistMono, geistSans, metadata, Toaster()

### Community 80 - "monsters/types.ts"
Cohesion: 0.13
Nodes (16): createManifestEntry(), filterMonsters(), COMPENDIUM_DIR, MANIFEST_PATH, mockEntries, CreatureSize, CreatureType, MonsterAbilities (+8 more)

### Community 81 - "import-character.ts"
Cohesion: 0.14
Nodes (25): fetchSharedCharacter(), maxDuration, POST(), ShareFetchError, SHEET_BASE_URL, POST(), proficiencyBonus(), ABILITY_KEYS (+17 more)

### Community 89 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): vaul, DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 104 - "import-character/route.ts"
Cohesion: 0.27
Nodes (11): ABILITY_RU_TO_EN, DAMAGE_TYPE_RU, detectActionCost(), detectWeapon(), parseBonus(), parseDamageString(), POST(), abilitiesForClass() (+3 more)

### Community 105 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Prompt Caching Architecture (DeepSeek Harness Parity) Implementation Plan, Task 1: Core Caching Utilities — `frozen-prefix.ts` and `ephemeral-tail.ts`, Task 2: Discrete Milestone History Compactor — `milestone-compactor.ts`, Task 3: Integration into Solo Chat Endpoint (`src/app/api/chat/route.ts`), Task 4: Integration into Multiplayer Co-op Turn Helper (`src/lib/room/resolve-turn-helper.ts`), Task 5: End-to-End Verification & Cost Calculation Audit

### Community 120 - "encounters/types.ts"
Cohesion: 0.16
Nodes (14): BIOME_CONFIGS, BiomeAffinity, entryMatchesKeywords(), getBiomeCandidatePool(), UNIVERSAL_FALLBACK_KEYWORDS, UNIVERSAL_FALLBACK_TYPES, mockManifest, GeneratedEncounter (+6 more)

### Community 121 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:generate, db:migrate, db:push, db:reset, dev, lint (+3 more)

### Community 122 - "cn"
Cohesion: 0.05
Nodes (53): input-otp, @radix-ui/react-avatar, @radix-ui/react-menubar, @radix-ui/react-radio-group, Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis() (+45 more)

### Community 124 - "compact.ts"
Cohesion: 0.19
Nodes (11): AuthMode, CompactOptions, inFlight, loadSummaries(), VERBATIM_MESSAGES, buildSceneContext(), SceneContext, truncate() (+3 more)

### Community 125 - "movement.ts"
Cohesion: 0.10
Nodes (37): GET(), CombatGrid(), getCellFromEvent(), handleGlobalMouseMove(), handleGlobalMouseUp(), handleSvgClick(), handleSvgMouseMove(), handleSvgMouseUp() (+29 more)

### Community 126 - "JoinRoomModal.tsx"
Cohesion: 0.31
Nodes (7): JoinRoomModal(), handleSubmit(), JoinRoomModalProps, DND_ROOM_WORDS, generateRoomCode(), isValidRoomCode(), normalizeRoomCode()

### Community 127 - "validation.ts"
Cohesion: 0.33
Nodes (7): CharacterCandidate, EvaluatedCharacter, EvaluatedCharacterList, extractCharacterLevel(), filterUserCharactersForRoom(), LevelValidationResult, validateCharacterForRoom()

### Community 129 - "resizable.tsx"
Cohesion: 0.40
Nodes (3): react-resizable-panels, ResizableHandle(), ResizablePanelGroup()

### Community 130 - "find-dragons.ts"
Cohesion: 0.40
Nodes (4): dragons, manifest, MANIFEST_PATH, raw

### Community 131 - "milestone-compactor.ts"
Cohesion: 0.44
Nodes (7): compactHistoryWithMilestones(), DEFAULT_CHUNK_SIZE, DEFAULT_MAX_VERBATIM, extractExistingChronicleBullets(), extractMessageText(), formatMessageBullet(), MilestoneCompactorOptions

### Community 133 - "prepare-prisma-for-env.js"
Cohesion: 0.33
Nodes (5): fs, isVercel, path, schema, schemaPath

### Community 135 - "chat/route.ts"
Cohesion: 0.18
Nodes (17): cleanAssistantNarrative(), maxDuration, POST(), buildEphemeralSceneTail, EphemeralNpcState, EphemeralPartyMemberState, EphemeralRecentEvent, EphemeralSceneState (+9 more)

### Community 136 - "engine.ts"
Cohesion: 0.15
Nodes (17): addDiceCount(), allyAdjacentTo(), CastContext, CastResult, findSneakAttack(), MoveOutcome, MultiattackResult, prepareDamage() (+9 more)

### Community 137 - "Architecture Design: Multi-Page Routing Architecture"
Cohesion: 0.17
Nodes (11): 1. Problem Statement & Motivation, 2.1 Route Map, 2. Target Routing Architecture, 3.1 `HomeHubView` (`src/components/home/HomeHubView.tsx`), 3.2 `RoomSessionView` (`src/components/room/RoomSessionView.tsx`), 3.3 `SoloCampaignView` (`src/components/campaign/SoloCampaignView.tsx`), 3.4 Shared State & Context, 3. Component Architecture & Decomposition (+3 more)

### Community 138 - "Combatant"
Cohesion: 0.07
Nodes (27): ClassifiedTargets, classifyAoeTargets(), DIRECTION_STEPS, DirStep, getConeCells(), getCubeCells(), getLineCells(), getSphereCells() (+19 more)

### Community 140 - "manual-combat-runner.ts"
Cohesion: 0.13
Nodes (27): createHeroes(), ensureDir(), initCombat(), initDragonCombat(), loadSession(), main(), printStatus(), saveState() (+19 more)

### Community 141 - "HomeHubView.tsx"
Cohesion: 0.16
Nodes (17): CreateCampaignModal(), CreateCampaignModalProps, abilityMod(), CharacterCard(), getRelationTier(), modStr(), RelationTier, typeColors (+9 more)

### Community 143 - "party-arc-generator.ts"
Cohesion: 0.28
Nodes (11): buildPartyAct1Prompt(), CombatDifficultyConfig, extractJson(), extractPartyRosterFromParticipants(), generatePartyAwareAct1(), getCombatDifficultyConfig(), PartyArcGenerationParams, partyAwareAct1Schema (+3 more)

### Community 144 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Multi-Page Routing Architecture Implementation Plan, Task 1: Route Aliases (`/home` and `/rooms/[code]`), Task 2: Home Hub View (`src/components/home/HomeHubView.tsx` & `src/app/page.tsx`), Task 3: Dedicated Multiplayer Room Session View (`/room/[code]`), Task 4: Dedicated Solo Campaign Session View (`/campaign/[id]`), Task 5: Full Regression, Type Verification & Graphify Update

### Community 145 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (12): class-variance-authority, @radix-ui/react-toggle, @radix-ui/react-toggle-group, Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup() (+4 more)

### Community 147 - "redirects.test.tsx"
Cohesion: 0.47
Nodes (3): HomePage(), mockRedirect, RoomsCodePage()

### Community 150 - "sidebar.tsx"
Cohesion: 0.05
Nodes (42): @radix-ui/react-dialog, @radix-ui/react-tooltip, Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay() (+34 more)

### Community 154 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Global Constraints, Task 1: Backend Data Model & Combat Engine Potion Support, Task 2: Combat Hotbar & CombatView UI Integration, Task 3: Campaign Character Card & Inventory Modal, Task 4: Full Verification, Graphify & Git Delivery, Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою — Implementation Plan

### Community 158 - "network-banner.js"
Cohesion: 0.33
Nodes (5): interfaces, localIps, os, otherIps, radminIps

### Community 160 - "Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою"
Cohesion: 0.50
Nodes (3): 1. Цель, 2. Глобальные ограничения, Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

## Knowledge Gaps
- **649 isolated node(s):** `supabase`, `$schema`, `style`, `rsc`, `tsx` (+644 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 861 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `scene-synchronizer.ts`, `package.json`, `milestone-compactor.ts`, `RoomCampaignSetupModal.tsx`, `react`, `encounter-generator.ts`, `chat/route.ts`, `CoopTurnBar.tsx`, `engine.ts`, `presets/index.ts`, `Combatant`, `DnDApp.tsx`, `supabase/client.ts`, `room-service.ts`, `HomeHubView.tsx`, `party-arc-generator.ts`, `archetype-solver.ts`, `manual-combat-runner.ts`, `redirects.test.tsx`, `CombatView`, `action/route.ts`, `D20RollModal.tsx`, `loot-generator.ts`, `monster-parser-engine.ts`, `library-data.ts`, `bot.ts`, `combat/types.ts`, `createClient`, `resolve-turn-helper.ts`, `LibraryItemEditorModal.tsx`, `cost.ts`, `Attack`, `maps/types.ts`, `open-map-service.ts`, `spawn-director.ts`, `rules.ts`, `preset-data.ts`, `pacing-director.test.ts`, `utils.ts`, `monsters/types.ts`, `import-character.ts`, `encounters/types.ts`, `movement.ts`, `JoinRoomModal.tsx`, `validation.ts`?**
  _High betweenness centrality (0.133) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `Hotbar.tsx`, `resizable.tsx`, `package.json`, `command.tsx`, `CombatView.tsx`, `DnDApp.tsx`, `HomeHubView.tsx`, `toggle-group.tsx`, `sidebar.tsx`, `AttacksAbilitiesEditor.tsx`, `alert-dialog.tsx`, `use-toast.ts`, `context-menu.tsx`, `navigation-menu.tsx`, `LibraryItemEditorModal.tsx`, `carousel.tsx`, `CharacterInventoryModal.tsx`, `form.tsx`, `utils.ts`, `accordion.tsx`, `chart.tsx`, `dropdown-menu.tsx`, `drawer.tsx`, `hover-card.tsx`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `Hotbar.tsx`, `resizable.tsx`, `package.json`, `RoomCampaignSetupModal.tsx`, `command.tsx`, `CoopTurnBar.tsx`, `CombatView.tsx`, `DnDApp.tsx`, `HomeHubView.tsx`, `toggle-group.tsx`, `CombatView`, `D20RollModal.tsx`, `sidebar.tsx`, `AttacksAbilitiesEditor.tsx`, `alert-dialog.tsx`, `use-toast.ts`, `context-menu.tsx`, `navigation-menu.tsx`, `resolve-turn-helper.ts`, `LibraryItemEditorModal.tsx`, `carousel.tsx`, `CharacterInventoryModal.tsx`, `form.tsx`, `utils.ts`, `accordion.tsx`, `chart.tsx`, `dropdown-menu.tsx`, `drawer.tsx`, `hover-card.tsx`, `cn`, `movement.ts`, `JoinRoomModal.tsx`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **What connects `supabase`, `$schema`, `style` to the rest of the system?**
  _649 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.034482758620689655 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.02702702702702703 - nodes in this community are weakly interconnected._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.11088709677419355 - nodes in this community are weakly interconnected._