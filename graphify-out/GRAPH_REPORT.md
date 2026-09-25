# Graph Report - battle+ai  (2026-09-25)

## Corpus Check
- 3284 files · ~2,044,487 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2317 nodes · 5994 edges · 155 communities (105 shown, 46 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8a575947`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Hotbar.tsx
- scene-synchronizer.ts
- package.json
- dependencies
- room-service.ts
- useSupabaseAuth
- Combatant
- RoomLobby
- RoomLobby.tsx
- Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)
- presets/index.ts
- CombatView.tsx
- DnDApp
- supabase/client.ts
- RoomService
- archetype-solver.ts
- Supabase
- Global Constraints
- AI Dungeon Master — D&D 5e Solo
- CombatGrid.tsx
- Changelog
- action/route.ts
- d20-helper.ts
- Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness
- story-arc.ts
- loot-generator.ts
- LibraryManagerModal
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
- scroll-and-sync-helpers.ts
- resolve-turn-helper.ts
- models.ts
- react
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
- [id]/page.tsx
- Supabase Postgres Best Practices
- carousel.tsx
- Архитектурный дизайн: Синхронизация комнаты, живой стриминг ответов Мастера и учёт токенов
- CharacterCard.tsx
- rules.ts
- serialize.ts
- form.tsx
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- mage-3rd-level-spells.test.ts
- Prompt Cache Telemetry & Visibility Implementation Plan
- pacing-director.test.ts
- room/[code]/battle/page.tsx
- room/[code]/page.tsx
- chart.tsx
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
- biome-matcher.ts
- scripts
- utils.ts
- TacticalMapPreset
- compact.ts
- movement.ts
- JoinRoomModal.tsx
- validation.ts
- find-dragons.ts
- ai
- LibraryItemEditorModal
- prepare-prisma-for-env.js
- chat/route.ts
- engine.ts
- Architecture Design: Multi-Page Routing Architecture
- aoe-templates.ts
- grid.ts
- CombatState
- DnDApp.tsx
- party-arc-generator.ts
- Global Constraints
- toggle-group.tsx
- system-prompt.ts
- redirects.test.tsx
- encounters/types.ts
- cn
- Combat Persistence, API Route and URL Binding Implementation Plan
- encounter-generator.test.ts
- collapsible.tsx
- Global Constraints
- tailwind.config.ts
- @radix-ui/react-aspect-ratio
- network-banner.js
- Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

## God Nodes (most connected - your core abstractions)
1. `cn()` - 234 edges
2. `vitest` - 89 edges
3. `react` - 85 edges
4. `Combatant` - 58 edges
5. `db` - 52 edges
6. `RoomService` - 51 edges
7. `lucide-react` - 50 edges
8. `runBotTurn()` - 46 edges
9. `CombatState` - 46 edges
10. `POST()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `checkAllTables()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/check-supabase-rooms.ts → src/lib/supabase/client.ts
- `main()` --calls--> `createClient()`  [EXTRACTED]
  scripts/consult-dm-prompt.ts → src/lib/ai/client.ts
- `main()` --calls--> `resolveStoryModel()`  [EXTRACTED]
  scripts/generate-dragon-story.ts → src/lib/ai/models.ts
- `inspectCharactersSchema()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-characters.ts → src/lib/supabase/client.ts
- `inspectData()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-data.ts → src/lib/supabase/client.ts

## Import Cycles
- None detected.

## Communities (155 total, 46 thin omitted)

### Community 0 - "Hotbar.tsx"
Cohesion: 0.14
Nodes (12): @radix-ui/react-popover, COST_LABEL, damageSummary(), extractWeaponBase(), Hotbar(), spellSummary(), Popover(), PopoverContent() (+4 more)

### Community 1 - "scene-synchronizer.ts"
Cohesion: 0.42
Nodes (7): applyStatusToNotes(), extractJson(), extractStatusFromNotes(), newNpcSchema, SceneUpdate, sceneUpdateSchema, syncSceneState()

### Community 2 - "package.json"
Cohesion: 0.04
Nodes (45): name, private, version, @ai-sdk/react, bun-types, clsx, date-fns, @dnd-kit/core (+37 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (74): dependencies, ai, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, cmdk, date-fns (+66 more)

### Community 4 - "room-service.ts"
Cohesion: 0.17
Nodes (14): POST(), CampaignSetupFormValues, PartyAwareAct1, StartingSituation, resolveRoomTurn(), startRoomCampaign(), StartRoomCampaignInput, StartRoomCampaignResult (+6 more)

### Community 5 - "useSupabaseAuth"
Cohesion: 0.21
Nodes (9): @supabase/supabase-js, testAuth(), SupabaseAuthModal(), SupabaseAuthModalProps, CreateRoomModal(), CreateRoomModalProps, useRoomRealtime(), useSupabaseAuth() (+1 more)

### Community 6 - "Combatant"
Cohesion: 0.13
Nodes (20): main(), GET(), POST(), Props, InitiativeTrackerProps, Props, RoleSelectorModalProps, WildShapeModalProps (+12 more)

### Community 8 - "RoomLobby.tsx"
Cohesion: 0.13
Nodes (21): canSubmitPlayerTurn(), CoopTurnBar(), CoopTurnBarProps, validatePlayerAction(), formatTypingMessage(), LiveTypingIndicator(), LiveTypingIndicatorProps, TypingUser (+13 more)

### Community 9 - "Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)"
Cohesion: 0.15
Nodes (12): 1. Контекст и проблема, 2. Цели и ключевые требования, 3. Архитектура и поток данных, 4.1. `POST /api/room/[code]/turn`, 4.2. `POST /api/room/[code]/turn/resolve`, 4.3. `GET /api/room/[code]/turn`, 4. Спецификация API и сервисов, 5.1. `PartyTurnBar` (`src/components/room/PartyTurnBar.tsx`) (+4 more)

### Community 10 - "presets/index.ts"
Cohesion: 0.17
Nodes (12): GET(), cityStreetPreset, gladiatorArenaPreset, ALL_PRESETS, getPresetByBiome(), getPresetById(), PRESETS_BY_BIOME, PRESETS_BY_ID (+4 more)

### Community 11 - "CombatView.tsx"
Cohesion: 0.11
Nodes (39): lucide-react, @radix-ui/react-slot, sonner, BestiaryBrowser(), BestiaryBrowserProps, CR_OPTIONS, CREATURE_TYPES, CombatViewProps (+31 more)

### Community 12 - "DnDApp"
Cohesion: 0.09
Nodes (8): DnDApp(), copyRoomLink(), handleGenerateStory(), startArcGeneration(), emptySubscribe(), getMessageError(), getMessageText(), useIsMounted()

### Community 13 - "supabase/client.ts"
Cohesion: 0.11
Nodes (19): checkAllTables(), inspectCharactersSchema(), inspectData(), listCharacters(), listUsers(), GET(), POST(), POST() (+11 more)

### Community 14 - "RoomService"
Cohesion: 0.14
Nodes (14): verifyMultiplayerRoomFlow(), DELETE(), DELETE(), GET(), POST(), POST(), GET(), POST() (+6 more)

### Community 15 - "archetype-solver.ts"
Cohesion: 0.20
Nodes (19): BossMinionsCandidate, inferBacklineRole(), isFrontlineCandidate(), PackCandidate, RANGED_KEYWORDS, resolveArchetype(), solveBossMinions(), solveGreedyFallback() (+11 more)

### Community 16 - "Supabase"
Cohesion: 0.11
Nodes (15): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Debugging, Making and Committing Schema Changes (+7 more)

### Community 17 - "Global Constraints"
Cohesion: 0.18
Nodes (10): Global Constraints, Task 1: Backend Turn API — Блокировка повторной отправки и авто-резолвинг, Task 2: Host Force-Resolve — Завершение раунда с AFK-персонажами, Task 3: Компонент очереди отряда `PartyTurnBar`, Task 4: Интеграция пошагового цикла в `DnDApp.tsx`, Task 5: Финальная верификация, актуализация графа и публикация в Git, Автоматические тесты, План верификации (+2 more)

### Community 18 - "AI Dungeon Master — D&D 5e Solo"
Cohesion: 0.06
Nodes (34): AI Dungeon Master — D&D 5e Solo, AI забывает персонажей, API-ключ не работает, "Cannot find module 'xxx'", "Database is readonly" / "SQLite error", "Port 3000 is already in use", Быстрые кнопки, Ввод ключа в приложении (+26 more)

### Community 19 - "CombatGrid.tsx"
Cohesion: 0.08
Nodes (37): CombatEffectsLayer(), CombatEffectsLayerProps, CombatGrid(), getCellFromEvent(), handleGlobalMouseMove(), handleGlobalMouseUp(), handleSvgClick(), handleSvgMouseMove() (+29 more)

### Community 20 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 21 - "action/route.ts"
Cohesion: 0.23
Nodes (34): loadState(), POST(), respond(), saveState(), syncCharacterPotionConsumed(), isBotTurn(), applyActionParameters(), applyEffect() (+26 more)

### Community 22 - "d20-helper.ts"
Cohesion: 0.17
Nodes (21): D20RollModal(), executeRoll(), handleAttackRoll(), handleCustomRoll(), handleSaveRoll(), handleSkillRoll(), ABILITY_META_LIST, AbilityKey (+13 more)

### Community 23 - "Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness"
Cohesion: 0.17
Nodes (11): 1.1. Механика работы KV-кэша DeepSeek (Prefix Caching), 1.2. Диагностика текущего состояния `dnd-ai-master` (Cache Hit ~0%), 1. Контекст и проблема, 2. Архитектура: Модульная 3-зонная модель контекста, 3.1. `src/lib/ai/caching/frozen-prefix.ts`, 3.2. `src/lib/ai/caching/ephemeral-tail.ts`, 3.3. `src/lib/ai/caching/milestone-compactor.ts`, 3. Компоненты и интерфейсы (+3 more)

### Community 24 - "story-arc.ts"
Cohesion: 0.13
Nodes (25): main(), maxDuration, POST(), GET(), maxDuration, POST(), actSchema, ArcGenerationParams (+17 more)

### Community 25 - "loot-generator.ts"
Cohesion: 0.13
Nodes (20): @prisma/client, isEnemyDefeatedOrFled(), POST(), BOSS_POTION_ITEM, BOSS_SCROLL_ITEM, CR_TO_XP, generateCombatLoot(), getXpForCr() (+12 more)

### Community 27 - "tools.ts"
Cohesion: 0.10
Nodes (26): zod, StoryAct, advanceActTool, campaignContextSchema, characterUpdatesSchema, dmTools, fetchPageTool, formatAct() (+18 more)

### Community 28 - "monster-parser-engine.ts"
Cohesion: 0.18
Nodes (17): cheerio, DAMAGE_TYPE_MAP, normalizeDamageType(), parseAbilities(), parseAction(), parseCR(), parseDamageTypes(), ParseMeta (+9 more)

### Community 29 - "alert-dialog.tsx"
Cohesion: 0.09
Nodes (19): @radix-ui/react-alert-dialog, AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay() (+11 more)

### Community 30 - "use-toast.ts"
Cohesion: 0.12
Nodes (25): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle (+17 more)

### Community 31 - "library-data.ts"
Cohesion: 0.07
Nodes (41): LibraryAbility, LibrarySpell, AbilityItem, SpellItem, SpellDefinitionLike, ABILITY_ALIASES, ABILITY_LIBRARY, AbilityDefinition (+33 more)

### Community 32 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 33 - "bot.ts"
Cohesion: 0.14
Nodes (36): alliesOf(), bestAttack(), BotArchetype, BotStep, BotTurnResult, determineFacingTowards(), evaluateTargetScore(), FACING_CYCLE (+28 more)

### Community 34 - "combat/types.ts"
Cohesion: 0.10
Nodes (28): HotbarProps, crToProfBonus(), getAttackStem(), MonsterAdapterOptions, parseCountBeforeStem(), parseMultiattack(), safeId(), createTestCombatState() (+20 more)

### Community 35 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 36 - "context-menu.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-context-menu, ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut() (+2 more)

### Community 37 - "createClient"
Cohesion: 0.22
Nodes (14): @ai-sdk/openai, main(), main(), streamTurn(), main(), extractJson(), main(), main() (+6 more)

### Community 38 - "generator.ts"
Cohesion: 0.13
Nodes (25): collectRawAttacks(), DAMAGE_TYPE_RU, detectActionCost(), detectWeapon(), extractAbilitiesFromCharacter(), extractAttacksFromCharacter(), extractSpellsFromCharacter(), normalizeClassName() (+17 more)

### Community 39 - "scroll-and-sync-helpers.ts"
Cohesion: 0.60
Nodes (3): AutoScrollChatOptions, shouldAutoScrollChat(), shouldSyncCampaignSettings()

### Community 40 - "resolve-turn-helper.ts"
Cohesion: 0.26
Nodes (11): buildFrozenRoomSystemPrompt(), resolveActiveRoomTurnHelper(), ResolveActiveRoomTurnOptions, RoomTurnStats, bundleTurnInputs(), BundleTurnOptions, calculateTurnReadiness(), CharacterTurnStatus (+3 more)

### Community 41 - "models.ts"
Cohesion: 0.16
Nodes (10): main(), maxDuration, BOOKKEEPING_TOOLS, CHEAP_MODEL, DEFAULT_CHEAP_MODEL, DEFAULT_DM_MODEL, DEFAULT_STORY_MODEL, FEATURED_MODELS (+2 more)

### Community 42 - "react"
Cohesion: 0.10
Nodes (28): @radix-ui/react-avatar, react, CreateCampaignModal(), CreateCampaignModalProps, AttacksAbilitiesEditor(), save(), COST_OPTIONS, emptyAttack() (+20 more)

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
Nodes (14): vitest, { mockStreamText }, GET(), getHostPort(), getLanIps(), POST(), TEST_ENEMIES, GET() (+6 more)

### Community 47 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 48 - "Attack"
Cohesion: 0.23
Nodes (8): TestEnemy, WeaponProfile, BEAST_FORMS, BeastForm, getBeastFormById(), AttackOutcome, Attack, CombatAbility

### Community 49 - "maps/types.ts"
Cohesion: 0.23
Nodes (12): OpenBattlemap, BiomeType, SpawnZoneDefinition, UniversalVTT, UVTTLight, UVTTPoint, UVTTPortal, UVTTResolution (+4 more)

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
Cohesion: 0.21
Nodes (10): templePreset, assignTacticalSpawns(), BACKLINE_CLASSES, BOSS_KEYWORDS, createDefaultSpawnZones(), findClosestPassableCell(), inferCombatantRole(), SpawnDirectorOptions (+2 more)

### Community 56 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 57 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 58 - "Архитектурный дизайн: Синхронизация комнаты, живой стриминг ответов Мастера и учёт токенов"
Cohesion: 0.18
Nodes (10): 1. Контекст и цели, 2.1. Стриминг и Realtime-шина (Supabase Realtime Broadcast), 2.2. Завершение генерации и персистентность (Persistence & Fallback), 2. Архитектура и поток данных (Data Flow), 3.1. Лента сообщений чата (`DnDApp.tsx`), 3.2. Нижняя панель действий (`PartyTurnBar.tsx`), 3.3. Блок расхода токенов и стоимости (`MessageBubble.tsx`), 3. Изменения компонентов интерфейса (+2 more)

### Community 59 - "CharacterCard.tsx"
Cohesion: 0.10
Nodes (22): abilityMod(), CharacterCard(), getRelationTier(), modStr(), RelationTier, typeColors, typeLabels, CharacterInventoryModal() (+14 more)

### Community 60 - "rules.ts"
Cohesion: 0.16
Nodes (25): CombatantDetails(), ActionCostCheck, AdvantageResult, AttackResolution, computeAttackAdvantage(), DamageResult, DeathSaveResult, effectiveAC() (+17 more)

### Community 61 - "serialize.ts"
Cohesion: 0.17
Nodes (18): POST(), GET(), EditableLibraryItem, AttackItem, WeaponProfile, AttackDefinition, DEFAULT_SPELLS, hydrateCombat() (+10 more)

### Community 62 - "form.tsx"
Cohesion: 0.19
Nodes (12): @radix-ui/react-label, react-hook-form, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext (+4 more)

### Community 63 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.29
Nodes (6): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 64 - "mage-3rd-level-spells.test.ts"
Cohesion: 0.17
Nodes (9): POST(), PresetsModalProps, CAMPAIGN_HEROES_PRESETS, createCombatantFromPreset(), createPresetFromCombatant(), DEFAULT_PRESETS, getAllSRDMonsters(), getSRDMonster() (+1 more)

### Community 65 - "Prompt Cache Telemetry & Visibility Implementation Plan"
Cohesion: 0.33
Nodes (5): Prompt Cache Telemetry & Visibility Implementation Plan, Task 1: Prompt cache extraction helper with TDD (`src/lib/ai/cost.ts`), Task 2: Integrate robust token extraction in API routes, Task 3: UI Transparency in `MessageBubble` & Header Trigger (`DnDApp.tsx`), Task 4: Full Verification, Graphify & Git Push

### Community 66 - "pacing-director.test.ts"
Cohesion: 0.39
Nodes (6): DMAssistAction, evaluateCombatPacing(), PacingEvaluation, PacingThreatLevel, shouldTriggerEncounterRelief(), createMockState()

### Community 69 - "chart.tsx"
Cohesion: 0.23
Nodes (10): recharts, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

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
Nodes (15): createManifestEntry(), filterMonsters(), COMPENDIUM_DIR, MANIFEST_PATH, mockEntries, CreatureSize, MonsterAbilities, MonsterAction (+7 more)

### Community 81 - "import-character.ts"
Cohesion: 0.12
Nodes (24): fetchSharedCharacter(), maxDuration, POST(), ShareFetchError, SHEET_BASE_URL, POST(), ABILITY_KEYS, clampLevel() (+16 more)

### Community 89 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): vaul, DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 104 - "import-character/route.ts"
Cohesion: 0.19
Nodes (16): ABILITY_RU_TO_EN, DAMAGE_TYPE_RU, detectActionCost(), detectWeapon(), parseBonus(), parseDamageString(), POST(), calculateTool (+8 more)

### Community 105 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Prompt Caching Architecture (DeepSeek Harness Parity) Implementation Plan, Task 1: Core Caching Utilities — `frozen-prefix.ts` and `ephemeral-tail.ts`, Task 2: Discrete Milestone History Compactor — `milestone-compactor.ts`, Task 3: Integration into Solo Chat Endpoint (`src/app/api/chat/route.ts`), Task 4: Integration into Multiplayer Co-op Turn Helper (`src/lib/room/resolve-turn-helper.ts`), Task 5: End-to-End Verification & Cost Calculation Audit

### Community 120 - "biome-matcher.ts"
Cohesion: 0.22
Nodes (11): BIOME_CONFIGS, BiomeAffinity, entryMatchesKeywords(), getBiomeCandidatePool(), UNIVERSAL_FALLBACK_KEYWORDS, UNIVERSAL_FALLBACK_TYPES, mockManifest, SquadArchetype (+3 more)

### Community 121 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:generate, db:migrate, db:push, db:reset, dev, lint (+3 more)

### Community 122 - "utils.ts"
Cohesion: 0.06
Nodes (19): input-otp, @radix-ui/react-accordion, @radix-ui/react-hover-card, @radix-ui/react-radio-group, @radix-ui/react-switch, react-resizable-panels, AccordionContent(), AccordionItem() (+11 more)

### Community 123 - "TacticalMapPreset"
Cohesion: 0.33
Nodes (4): mapRegistry, MapManifestEntry, MapTagQuery, TacticalMapPreset

### Community 124 - "compact.ts"
Cohesion: 0.19
Nodes (11): AuthMode, CompactOptions, inFlight, loadSummaries(), VERBATIM_MESSAGES, buildSceneContext(), SceneContext, truncate() (+3 more)

### Community 125 - "movement.ts"
Cohesion: 0.15
Nodes (22): GET(), pullCombatantTowards(), pushCombatantAway(), createMockCombatState(), cellCost(), computeVisibilityStatus(), coversCell(), FACING_VECTORS (+14 more)

### Community 126 - "JoinRoomModal.tsx"
Cohesion: 0.31
Nodes (7): JoinRoomModal(), handleSubmit(), JoinRoomModalProps, DND_ROOM_WORDS, generateRoomCode(), isValidRoomCode(), normalizeRoomCode()

### Community 127 - "validation.ts"
Cohesion: 0.29
Nodes (8): GET(), CharacterCandidate, EvaluatedCharacter, EvaluatedCharacterList, extractCharacterLevel(), filterUserCharactersForRoom(), LevelValidationResult, validateCharacterForRoom()

### Community 130 - "find-dragons.ts"
Cohesion: 0.40
Nodes (4): dragons, manifest, MANIFEST_PATH, raw

### Community 131 - "ai"
Cohesion: 0.40
Nodes (8): ai, compactHistoryWithMilestones(), DEFAULT_CHUNK_SIZE, DEFAULT_MAX_VERBATIM, extractExistingChronicleBullets(), extractMessageText(), formatMessageBullet(), MilestoneCompactorOptions

### Community 133 - "prepare-prisma-for-env.js"
Cohesion: 0.33
Nodes (5): fs, isVercel, path, schema, schemaPath

### Community 135 - "chat/route.ts"
Cohesion: 0.17
Nodes (17): cleanAssistantNarrative(), maxDuration, POST(), buildEphemeralSceneTail, EphemeralNpcState, EphemeralPartyMemberState, EphemeralRecentEvent, EphemeralSceneState (+9 more)

### Community 136 - "engine.ts"
Cohesion: 0.13
Nodes (19): addDiceCount(), allyAdjacentTo(), CastContext, CastResult, findSneakAttack(), MoveOutcome, MultiattackResult, prepareDamage() (+11 more)

### Community 137 - "Architecture Design: Multi-Page Routing Architecture"
Cohesion: 0.17
Nodes (11): 1. Problem Statement & Motivation, 2.1 Route Map, 2. Target Routing Architecture, 3.1 `HomeHubView` (`src/components/home/HomeHubView.tsx`), 3.2 `RoomSessionView` (`src/components/room/RoomSessionView.tsx`), 3.3 `SoloCampaignView` (`src/components/campaign/SoloCampaignView.tsx`), 3.4 Shared State & Context, 3. Component Architecture & Decomposition (+3 more)

### Community 138 - "aoe-templates.ts"
Cohesion: 0.27
Nodes (11): ClassifiedTargets, classifyAoeTargets(), DIRECTION_STEPS, DirStep, getConeCells(), getCubeCells(), getLineCells(), getSphereCells() (+3 more)

### Community 139 - "grid.ts"
Cohesion: 0.17
Nodes (8): distance(), performLegendaryAction(), triggerAILegendaryActions(), canAct(), canPayForAttack(), createTestCombatState(), mockTailAttack, LegendaryState

### Community 140 - "CombatState"
Cohesion: 0.08
Nodes (38): createHeroes(), ensureDir(), initCombat(), initDragonCombat(), loadSession(), main(), printStatus(), saveState() (+30 more)

### Community 142 - "DnDApp.tsx"
Cohesion: 0.06
Nodes (44): CombatEndSummary, ImportCharacterModal(), ImportCharacterModalProps, COMMON_CONDITIONS, DAMAGE_TYPES, LibraryCategory, Props, CostStatsModal() (+36 more)

### Community 143 - "party-arc-generator.ts"
Cohesion: 0.28
Nodes (11): buildPartyAct1Prompt(), CombatDifficultyConfig, extractJson(), extractPartyRosterFromParticipants(), generatePartyAwareAct1(), getCombatDifficultyConfig(), PartyArcGenerationParams, partyAwareAct1Schema (+3 more)

### Community 144 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Multi-Page Routing Architecture Implementation Plan, Task 1: Route Aliases (`/home` and `/rooms/[code]`), Task 2: Home Hub View (`src/components/home/HomeHubView.tsx` & `src/app/page.tsx`), Task 3: Dedicated Multiplayer Room Session View (`/room/[code]`), Task 4: Dedicated Solo Campaign Session View (`/campaign/[id]`), Task 5: Full Regression, Type Verification & Graphify Update

### Community 145 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (12): class-variance-authority, @radix-ui/react-toggle, @radix-ui/react-toggle-group, Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup() (+4 more)

### Community 146 - "system-prompt.ts"
Cohesion: 0.22
Nodes (12): main(), StoryArc, buildArcSection(), buildSystemPrompt(), CampaignContext, difficultyDescriptions, dmStyleDescriptions, partyTiesDescriptions (+4 more)

### Community 147 - "redirects.test.tsx"
Cohesion: 0.47
Nodes (3): HomePage(), mockRedirect, RoomsCodePage()

### Community 149 - "encounters/types.ts"
Cohesion: 0.27
Nodes (9): EncounterDifficulty, EncounterRequest, PartyMember, SquadMonsterSlot, SquadPlan, calculateAwardedXP(), calculatePartyXPBudget(), MULTIPLIER_TIERS (+1 more)

### Community 150 - "cn"
Cohesion: 0.03
Nodes (100): cmdk, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-menubar, @radix-ui/react-navigation-menu, @radix-ui/react-tooltip, BreadcrumbEllipsis(), BreadcrumbItem() (+92 more)

### Community 151 - "Combat Persistence, API Route and URL Binding Implementation Plan"
Cohesion: 0.33
Nodes (5): Combat Persistence, API Route and URL Binding Implementation Plan, Task 1: Create `src/app/api/combat/[id]/route.ts` with TDD, Task 2: CombatView fallback and active combat room resolution, Task 3: URL Synchronization and Direct Battle Link in `DnDApp.tsx`, Task 4: Verification, Lint & Git Push

### Community 152 - "encounter-generator.test.ts"
Cohesion: 0.38
Nodes (3): mockManifest, dungeonPrisonPreset, forestAmbushPreset

### Community 154 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Global Constraints, Task 1: Backend Data Model & Combat Engine Potion Support, Task 2: Combat Hotbar & CombatView UI Integration, Task 3: Campaign Character Card & Inventory Modal, Task 4: Full Verification, Graphify & Git Delivery, Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою — Implementation Plan

### Community 155 - "tailwind.config.ts"
Cohesion: 0.50
Nodes (3): tailwindcss, tailwindcss-animate, config

### Community 158 - "network-banner.js"
Cohesion: 0.33
Nodes (5): interfaces, localIps, os, otherIps, radminIps

### Community 160 - "Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою"
Cohesion: 0.50
Nodes (3): 1. Цель, 2. Глобальные ограничения, Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

## Knowledge Gaps
- **654 isolated node(s):** `supabase`, `$schema`, `style`, `rsc`, `tsx` (+649 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 869 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `scene-synchronizer.ts`, `package.json`, `ai`, `room-service.ts`, `Combatant`, `chat/route.ts`, `RoomLobby.tsx`, `engine.ts`, `presets/index.ts`, `aoe-templates.ts`, `CombatState`, `supabase/client.ts`, `RoomService`, `DnDApp.tsx`, `party-arc-generator.ts`, `archetype-solver.ts`, `system-prompt.ts`, `redirects.test.tsx`, `CombatGrid.tsx`, `encounters/types.ts`, `d20-helper.ts`, `encounter-generator.test.ts`, `loot-generator.ts`, `monster-parser-engine.ts`, `library-data.ts`, `bot.ts`, `combat/types.ts`, `scroll-and-sync-helpers.ts`, `resolve-turn-helper.ts`, `react`, `cost.ts`, `Attack`, `maps/types.ts`, `open-map-service.ts`, `spawn-director.ts`, `[id]/page.tsx`, `grid.ts`, `mage-3rd-level-spells.test.ts`, `pacing-director.test.ts`, `room/[code]/battle/page.tsx`, `room/[code]/page.tsx`, `monsters/types.ts`, `import-character.ts`, `biome-matcher.ts`, `utils.ts`, `TacticalMapPreset`, `movement.ts`, `JoinRoomModal.tsx`, `validation.ts`?**
  _High betweenness centrality (0.132) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `drawer.tsx`, `Hotbar.tsx`, `context-menu.tsx`, `chart.tsx`, `RoomLobby.tsx`, `react`, `CombatView.tsx`, `DnDApp.tsx`, `toggle-group.tsx`, `use-toast.ts`, `carousel.tsx`, `utils.ts`, `CharacterCard.tsx`, `alert-dialog.tsx`, `form.tsx`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `Hotbar.tsx`, `package.json`, `useSupabaseAuth`, `RoomLobby.tsx`, `CombatView.tsx`, `DnDApp.tsx`, `toggle-group.tsx`, `CombatGrid.tsx`, `cn`, `alert-dialog.tsx`, `use-toast.ts`, `context-menu.tsx`, `[id]/page.tsx`, `carousel.tsx`, `CharacterCard.tsx`, `form.tsx`, `room/[code]/battle/page.tsx`, `room/[code]/page.tsx`, `chart.tsx`, `drawer.tsx`, `utils.ts`, `JoinRoomModal.tsx`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **What connects `supabase`, `$schema`, `style` to the rest of the system?**
  _654 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Hotbar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1368421052631579 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.02702702702702703 - nodes in this community are weakly interconnected._