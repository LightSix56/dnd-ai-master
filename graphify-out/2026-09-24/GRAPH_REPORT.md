# Graph Report - battle+ai  (2026-09-24)

## Corpus Check
- 3253 files · ~2,024,570 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2204 nodes · 5677 edges · 142 communities (97 shown, 42 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 69 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `84ccf982`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Hotbar.tsx
- monster-parser-engine.ts
- package.json
- dependencies
- DnDApp.tsx
- RoomLobby.tsx
- generator.ts
- maps/types.ts
- CoopTurnBar.tsx
- Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)
- presets/index.ts
- CombatView.tsx
- DnDApp
- supabase/client.ts
- room-service.ts
- archetype-solver.ts
- Supabase
- Global Constraints
- AI Dungeon Master — D&D 5e Solo
- react
- Changelog
- action/route.ts
- movement.ts
- Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness
- story-arc.ts
- loot-generator.ts
- preset-data.ts
- tools.ts
- spawn-director.ts
- alert-dialog.tsx
- use-toast.ts
- library-data.ts
- Changelog
- bot.ts
- Combatant
- Writing Guidelines for Postgres References
- Attack
- canAct
- TacticalMapPreset
- compact.ts
- vitest
- models.ts
- lucide-react
- compilerOptions
- scripts
- Section Definitions
- spawn-director.test.ts
- components.json
- createClient
- pacing-director.test.ts
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- open-map-service.ts
- supabase/types.ts
- canonical-biomes.ts
- CombatGrid.tsx
- cost.ts
- Supabase Postgres Best Practices
- carousel.tsx
- aoe-templates.ts
- CharacterCard.tsx
- rules.ts
- serialize.ts
- form.tsx
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- combat/types.ts
- AttackKind
- collapsible.tsx
- JoinRoomModal.tsx
- xp-calculator.ts
- chart.tsx
- dropdown-menu.tsx
- devDependencies
- advanced-full-text-search.md
- Multiplayer Network Infrastructure & Gameplay Resilience Implementation Plan
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- encounter-generator.ts
- conn-limits.md
- layout.tsx
- conn-pooling.md
- monsters/types.ts
- db.ts
- conn-prepared-statements.md
- data-batch-inserts.md
- @supabase/ssr
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- LibraryItemEditorModal
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
- scene-synchronizer.ts
- Global Constraints
- query-partial-indexes.md
- tailwind.config.ts
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
- @radix-ui/react-aspect-ratio
- encounters/types.ts
- utils.ts
- engine.ts
- CombatView
- CombatGrid
- RoomCampaignSetupModal.tsx
- validation.ts
- find-dragons.ts
- drawer.tsx
- ai
- prepare-prisma-for-env.js
- chat/route.ts
- manual-combat-runner.ts
- party-arc-generator.ts
- toggle-group.tsx
- cn
- Global Constraints
- network-banner.js
- Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

## God Nodes (most connected - your core abstractions)
1. `cn()` - 234 edges
2. `react` - 76 edges
3. `vitest` - 76 edges
4. `Combatant` - 58 edges
5. `lucide-react` - 47 edges
6. `runBotTurn()` - 46 edges
7. `CombatState` - 46 edges
8. `db` - 45 edges
9. `RoomService` - 45 edges
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

## Communities (142 total, 42 thin omitted)

### Community 0 - "Hotbar.tsx"
Cohesion: 0.14
Nodes (12): @radix-ui/react-popover, COST_LABEL, damageSummary(), extractWeaponBase(), Hotbar(), spellSummary(), Popover(), PopoverContent() (+4 more)

### Community 1 - "monster-parser-engine.ts"
Cohesion: 0.18
Nodes (17): cheerio, DAMAGE_TYPE_MAP, normalizeDamageType(), parseAbilities(), parseAction(), parseCR(), parseDamageTypes(), ParseMeta (+9 more)

### Community 2 - "package.json"
Cohesion: 0.04
Nodes (44): name, private, version, @ai-sdk/react, bun-types, clsx, date-fns, @dnd-kit/core (+36 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (74): dependencies, ai, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, cmdk, date-fns (+66 more)

### Community 4 - "DnDApp.tsx"
Cohesion: 0.07
Nodes (22): zustand, CombatEndSummary, CostStatsModal(), ArcState, ChatMessage, formatInline(), MarkdownRenderer(), MessageBubble() (+14 more)

### Community 5 - "RoomLobby.tsx"
Cohesion: 0.10
Nodes (14): @supabase/supabase-js, SupabaseAuthModal(), SupabaseAuthModalProps, calculateBaseStats(), CharacterPickerModal(), handleCreateAndSelect(), formatCampaignCharacterForPicker(), formatCharacterCardForPicker() (+6 more)

### Community 6 - "generator.ts"
Cohesion: 0.23
Nodes (11): createTacticalEncounter(), EnemyInput, EnvironmentType, GeneratedMapElement, generateTacticalMap(), resolveEnemyAttacks(), TacticalEncounterResult, resolveBattlemapForNarrative() (+3 more)

### Community 7 - "maps/types.ts"
Cohesion: 0.20
Nodes (14): ToggleDoorOutcome, OpenBattlemap, BiomeType, SpawnZoneDefinition, UniversalVTT, UVTTLight, UVTTPoint, UVTTPortal (+6 more)

### Community 8 - "CoopTurnBar.tsx"
Cohesion: 0.36
Nodes (8): canSubmitPlayerTurn(), CoopTurnBar(), CoopTurnBarProps, validatePlayerAction(), formatTypingMessage(), LiveTypingIndicator(), LiveTypingIndicatorProps, TypingUser

### Community 9 - "Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)"
Cohesion: 0.15
Nodes (12): 1. Контекст и проблема, 2. Цели и ключевые требования, 3. Архитектура и поток данных, 4.1. `POST /api/room/[code]/turn`, 4.2. `POST /api/room/[code]/turn/resolve`, 4.3. `GET /api/room/[code]/turn`, 4. Спецификация API и сервисов, 5.1. `PartyTurnBar` (`src/components/room/PartyTurnBar.tsx`) (+4 more)

### Community 10 - "presets/index.ts"
Cohesion: 0.16
Nodes (10): cityStreetPreset, dungeonPrisonPreset, gladiatorArenaPreset, ALL_PRESETS, getPresetByBiome(), PRESETS_BY_BIOME, PRESETS_BY_ID, lavaCavePreset (+2 more)

### Community 11 - "CombatView.tsx"
Cohesion: 0.06
Nodes (33): @radix-ui/react-avatar, sonner, AttacksAbilitiesEditor(), save(), COST_OPTIONS, emptyAttack(), KIND_LABELS, Props (+25 more)

### Community 12 - "DnDApp"
Cohesion: 0.06
Nodes (32): D20RollModal(), executeRoll(), handleAttackRoll(), handleCustomRoll(), handleSaveRoll(), handleSkillRoll(), DnDApp(), copyRoomLink() (+24 more)

### Community 13 - "supabase/client.ts"
Cohesion: 0.13
Nodes (14): checkAllTables(), inspectCharactersSchema(), inspectData(), listCharacters(), listUsers(), testAuth(), GET(), POST() (+6 more)

### Community 14 - "room-service.ts"
Cohesion: 0.13
Nodes (19): verifyMultiplayerRoomFlow(), DELETE(), GET(), POST(), GET(), POST(), RoomCampaignSetupModalProps, PartyAwareAct1 (+11 more)

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

### Community 19 - "react"
Cohesion: 0.12
Nodes (38): @radix-ui/react-slot, react, BestiaryBrowser(), BestiaryBrowserProps, CR_OPTIONS, CREATURE_TYPES, Props, BiomeCategory (+30 more)

### Community 20 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 21 - "action/route.ts"
Cohesion: 0.18
Nodes (37): loadState(), POST(), respond(), saveState(), syncCharacterPotionConsumed(), getBeastFormById(), isBotTurn(), applyActionParameters() (+29 more)

### Community 22 - "movement.ts"
Cohesion: 0.15
Nodes (26): GET(), hostilesOf(), isPerceivableByBot(), checkSpellRange(), startTurn(), cellCost(), computeVisibilityStatus(), coversCell() (+18 more)

### Community 23 - "Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness"
Cohesion: 0.17
Nodes (11): 1.1. Механика работы KV-кэша DeepSeek (Prefix Caching), 1.2. Диагностика текущего состояния `dnd-ai-master` (Cache Hit ~0%), 1. Контекст и проблема, 2. Архитектура: Модульная 3-зонная модель контекста, 3.1. `src/lib/ai/caching/frozen-prefix.ts`, 3.2. `src/lib/ai/caching/ephemeral-tail.ts`, 3.3. `src/lib/ai/caching/milestone-compactor.ts`, 3. Компоненты и интерфейсы (+3 more)

### Community 24 - "story-arc.ts"
Cohesion: 0.12
Nodes (29): main(), extractJson(), main(), maxDuration, POST(), GET(), maxDuration, POST() (+21 more)

### Community 25 - "loot-generator.ts"
Cohesion: 0.15
Nodes (17): BOSS_POTION_ITEM, BOSS_SCROLL_ITEM, CR_TO_XP, generateCombatLoot(), getXpForCr(), parseEnemyCr(), rollDice(), THEMATIC_BIOME_DROPS (+9 more)

### Community 26 - "preset-data.ts"
Cohesion: 0.20
Nodes (9): POST(), PresetsModalProps, CAMPAIGN_HEROES_PRESETS, createCombatantFromPreset(), createPresetFromCombatant(), DEFAULT_PRESETS, getAllSRDMonsters(), getSRDMonster() (+1 more)

### Community 27 - "tools.ts"
Cohesion: 0.06
Nodes (47): fetchSharedCharacter(), maxDuration, POST(), ShareFetchError, SHEET_BASE_URL, POST(), StoryAct, advanceActTool (+39 more)

### Community 28 - "spawn-director.ts"
Cohesion: 0.21
Nodes (12): GET(), POST(), getPresetById(), assignTacticalSpawns(), BACKLINE_CLASSES, BOSS_KEYWORDS, createDefaultSpawnZones(), findClosestPassableCell() (+4 more)

### Community 29 - "alert-dialog.tsx"
Cohesion: 0.09
Nodes (19): @radix-ui/react-alert-dialog, AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay() (+11 more)

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
Cohesion: 0.17
Nodes (30): CombatantDetails(), alliesOf(), bestAttack(), BotArchetype, BotStep, BotTurnResult, determineFacingTowards(), evaluateTargetScore() (+22 more)

### Community 34 - "Combatant"
Cohesion: 0.09
Nodes (19): CombatState, createMockCombatState(), applyMoraleFailure(), checkMoraleTrigger(), getFleeingDestination(), MoraleTriggerCheck, resolveMoraleCheck(), createTestCombatState() (+11 more)

### Community 35 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 36 - "Attack"
Cohesion: 0.15
Nodes (20): TestEnemy, ABILITY_RU_TO_EN, DAMAGE_TYPE_RU, detectActionCost(), detectWeapon(), parseBonus(), parseDamageString(), POST() (+12 more)

### Community 37 - "canAct"
Cohesion: 0.39
Nodes (6): checkLegendaryResistance(), performLegendaryAction(), triggerAILegendaryActions(), canAct(), createTestCombatState(), mockTailAttack

### Community 38 - "TacticalMapPreset"
Cohesion: 0.36
Nodes (4): mapRegistry, MapManifestEntry, MapTagQuery, TacticalMapPreset

### Community 39 - "compact.ts"
Cohesion: 0.19
Nodes (11): AuthMode, CompactOptions, inFlight, loadSummaries(), VERBATIM_MESSAGES, buildSceneContext(), SceneContext, truncate() (+3 more)

### Community 40 - "vitest"
Cohesion: 0.14
Nodes (22): vitest, POST(), GET(), POST(), PartyTurnBar(), PartyTurnBarProps, buildFrozenRoomSystemPrompt(), resolveActiveRoomTurnHelper() (+14 more)

### Community 41 - "models.ts"
Cohesion: 0.16
Nodes (10): main(), maxDuration, BOOKKEEPING_TOOLS, CHEAP_MODEL, DEFAULT_CHEAP_MODEL, DEFAULT_DM_MODEL, DEFAULT_STORY_MODEL, FEATURED_MODELS (+2 more)

### Community 42 - "lucide-react"
Cohesion: 0.13
Nodes (20): lucide-react, COMMON_CONDITIONS, DAMAGE_TYPES, LibraryCategory, Props, CharacterPickerModalProps, DND_CLASSES, DND_RACES (+12 more)

### Community 43 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 44 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:generate, db:migrate, db:push, db:reset, dev, lint (+3 more)

### Community 45 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 47 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 48 - "createClient"
Cohesion: 0.14
Nodes (22): @ai-sdk/openai, main(), main(), main(), streamTurn(), main(), main(), main() (+14 more)

### Community 49 - "pacing-director.test.ts"
Cohesion: 0.39
Nodes (6): DMAssistAction, evaluateCombatPacing(), PacingEvaluation, PacingThreatLevel, shouldTriggerEncounterRelief(), createMockState()

### Community 50 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.25
Nodes (7): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), 🗺️ 4. Категорический запрет визуальных заглушек и обязательный VTT-рендеринг (No Visual Stubs & Mandatory Real Battlemap Rendering), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 51 - "open-map-service.ts"
Cohesion: 0.38
Nodes (7): GET(), getOpenMapById(), getPopularTags(), OPEN_BATTLEMAP_CATALOG, OpenMapSearchQuery, POPULAR_MAP_TAGS, searchOpenMaps()

### Community 52 - "supabase/types.ts"
Cohesion: 0.25
Nodes (7): PartyBond, RoomParticipantRecord, RoomRecord, RoomStatus, RoomTurnRecord, SupabaseCharacterRecord, TurnStatus

### Community 53 - "canonical-biomes.ts"
Cohesion: 0.11
Nodes (17): astralRiftPreset, banditCampPreset, bridgeChasmPreset, CANONICAL_PRESETS_EXTENDED, castleCourtyardPreset, desertDunesPreset, docksHarborPreset, foundryForgePreset (+9 more)

### Community 54 - "CombatGrid.tsx"
Cohesion: 0.20
Nodes (15): CombatEffectsLayer(), CombatEffectsLayerProps, CombatGridProps, HotbarProps, calculateAttackVector(), CombatEffect, CombatOutcomeType, DamagePopup (+7 more)

### Community 55 - "cost.ts"
Cohesion: 0.21
Nodes (9): clientWithCustomUrl, cost, customCost, CostStatsModalProps, calculateCostRub(), CampaignAiStats, KNOWN_MODEL_PRICING, ModelPricing (+1 more)

### Community 56 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 57 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 58 - "aoe-templates.ts"
Cohesion: 0.27
Nodes (11): ClassifiedTargets, classifyAoeTargets(), DIRECTION_STEPS, DirStep, getConeCells(), getCubeCells(), getLineCells(), getSphereCells() (+3 more)

### Community 59 - "CharacterCard.tsx"
Cohesion: 0.17
Nodes (14): abilityMod(), CharacterCard(), getRelationTier(), modStr(), RelationTier, typeColors, typeLabels, CharacterInventoryModal() (+6 more)

### Community 60 - "rules.ts"
Cohesion: 0.13
Nodes (22): ActionCostCheck, AdvantageResult, applyDamage(), applyHealing(), AttackResolution, consumeAttackConditions(), DamageResult, DeathSaveResult (+14 more)

### Community 61 - "serialize.ts"
Cohesion: 0.22
Nodes (14): GET(), getHostPort(), getLanIps(), POST(), TEST_ENEMIES, DEFAULT_SPELLS, hydrateCombat(), hydrateCombatant() (+6 more)

### Community 62 - "form.tsx"
Cohesion: 0.19
Nodes (12): @radix-ui/react-label, react-hook-form, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext (+4 more)

### Community 63 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.29
Nodes (6): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 64 - "combat/types.ts"
Cohesion: 0.11
Nodes (28): crToProfBonus(), getAttackStem(), MonsterAdapterOptions, monsterDefinitionToCombatant(), parseCountBeforeStem(), parseMultiattack(), safeId(), createTestCombatState() (+20 more)

### Community 65 - "AttackKind"
Cohesion: 0.31
Nodes (8): GET(), EditableLibraryItem, AttackItem, AttackDefinition, SRDWeapon, ActionCost, AttackKind, DamageRoll

### Community 67 - "JoinRoomModal.tsx"
Cohesion: 0.31
Nodes (7): JoinRoomModal(), handleSubmit(), JoinRoomModalProps, DND_ROOM_WORDS, generateRoomCode(), isValidRoomCode(), normalizeRoomCode()

### Community 68 - "xp-calculator.ts"
Cohesion: 0.43
Nodes (6): EncounterDifficulty, PartyMember, calculateAwardedXP(), calculatePartyXPBudget(), MULTIPLIER_TIERS, XP_THRESHOLDS_BY_LEVEL

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

### Community 76 - "encounter-generator.ts"
Cohesion: 0.24
Nodes (10): main(), GET(), POST(), createCombatantStub(), createMonsterDefinitionFromManifest(), generateEncounter(), loadDefaultManifest(), loadMonsterDefinition() (+2 more)

### Community 78 - "layout.tsx"
Cohesion: 0.20
Nodes (7): nextConfig, next, next-themes, geistMono, geistSans, metadata, Toaster()

### Community 80 - "monsters/types.ts"
Cohesion: 0.13
Nodes (15): createManifestEntry(), filterMonsters(), COMPENDIUM_DIR, MANIFEST_PATH, mockEntries, CreatureSize, MonsterAbilities, MonsterAction (+7 more)

### Community 81 - "db.ts"
Cohesion: 0.15
Nodes (16): @prisma/client, POST(), GET(), POST(), GET(), GET(), PATCH(), POST() (+8 more)

### Community 104 - "scene-synchronizer.ts"
Cohesion: 0.36
Nodes (8): zod, applyStatusToNotes(), extractJson(), extractStatusFromNotes(), newNpcSchema, SceneUpdate, sceneUpdateSchema, syncSceneState()

### Community 105 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Prompt Caching Architecture (DeepSeek Harness Parity) Implementation Plan, Task 1: Core Caching Utilities — `frozen-prefix.ts` and `ephemeral-tail.ts`, Task 2: Discrete Milestone History Compactor — `milestone-compactor.ts`, Task 3: Integration into Solo Chat Endpoint (`src/app/api/chat/route.ts`), Task 4: Integration into Multiplayer Co-op Turn Helper (`src/lib/room/resolve-turn-helper.ts`), Task 5: End-to-End Verification & Cost Calculation Audit

### Community 107 - "tailwind.config.ts"
Cohesion: 0.50
Nodes (3): tailwindcss, tailwindcss-animate, config

### Community 121 - "encounters/types.ts"
Cohesion: 0.16
Nodes (15): BIOME_CONFIGS, BiomeAffinity, entryMatchesKeywords(), getBiomeCandidatePool(), UNIVERSAL_FALLBACK_KEYWORDS, UNIVERSAL_FALLBACK_TYPES, mockManifest, GeneratedEncounter (+7 more)

### Community 122 - "utils.ts"
Cohesion: 0.06
Nodes (19): input-otp, @radix-ui/react-accordion, @radix-ui/react-hover-card, @radix-ui/react-radio-group, @radix-ui/react-switch, react-resizable-panels, AccordionContent(), AccordionItem() (+11 more)

### Community 123 - "engine.ts"
Cohesion: 0.15
Nodes (17): addDiceCount(), allyAdjacentTo(), CastContext, CastResult, findSneakAttack(), MoveOutcome, MultiattackResult, prepareDamage() (+9 more)

### Community 124 - "CombatView"
Cohesion: 0.20
Nodes (16): CombatView(), addCombatant(), applyMultiSpell(), cancelTargeting(), continueAfterBot(), doAction(), endCombat(), executeOnTarget() (+8 more)

### Community 125 - "CombatGrid"
Cohesion: 0.16
Nodes (10): CombatGrid(), getCellFromEvent(), handleGlobalMouseMove(), handleGlobalMouseUp(), handleSvgClick(), handleSvgMouseMove(), handleSvgMouseUp(), cellKey() (+2 more)

### Community 126 - "RoomCampaignSetupModal.tsx"
Cohesion: 0.20
Nodes (10): POST(), CampaignSetupFormValues, DIFFICULTY_OPTIONS, RoomCampaignSetupModal(), SETTING_PRESETS, SITUATION_OPTIONS, validateCampaignSetupInput(), StartingSituation (+2 more)

### Community 127 - "validation.ts"
Cohesion: 0.29
Nodes (8): GET(), CharacterCandidate, EvaluatedCharacter, EvaluatedCharacterList, extractCharacterLevel(), filterUserCharactersForRoom(), LevelValidationResult, validateCharacterForRoom()

### Community 129 - "find-dragons.ts"
Cohesion: 0.40
Nodes (4): dragons, manifest, MANIFEST_PATH, raw

### Community 130 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): vaul, DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 131 - "ai"
Cohesion: 0.40
Nodes (8): ai, compactHistoryWithMilestones(), DEFAULT_CHUNK_SIZE, DEFAULT_MAX_VERBATIM, extractExistingChronicleBullets(), extractMessageText(), formatMessageBullet(), MilestoneCompactorOptions

### Community 133 - "prepare-prisma-for-env.js"
Cohesion: 0.33
Nodes (5): fs, isVercel, path, schema, schemaPath

### Community 135 - "chat/route.ts"
Cohesion: 0.16
Nodes (18): cleanAssistantNarrative(), maxDuration, POST(), { mockStreamText }, buildEphemeralSceneTail, EphemeralNpcState, EphemeralPartyMemberState, EphemeralRecentEvent (+10 more)

### Community 140 - "manual-combat-runner.ts"
Cohesion: 0.13
Nodes (28): createHeroes(), ensureDir(), initCombat(), initDragonCombat(), loadSession(), main(), printStatus(), saveState() (+20 more)

### Community 143 - "party-arc-generator.ts"
Cohesion: 0.28
Nodes (11): buildPartyAct1Prompt(), CombatDifficultyConfig, extractJson(), extractPartyRosterFromParticipants(), generatePartyAwareAct1(), getCombatDifficultyConfig(), PartyArcGenerationParams, partyAwareAct1Schema (+3 more)

### Community 145 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (12): class-variance-authority, @radix-ui/react-toggle, @radix-ui/react-toggle-group, Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup() (+4 more)

### Community 150 - "cn"
Cohesion: 0.03
Nodes (100): cmdk, @radix-ui/react-context-menu, @radix-ui/react-dialog, @radix-ui/react-menubar, @radix-ui/react-navigation-menu, @radix-ui/react-tooltip, BreadcrumbEllipsis(), BreadcrumbItem() (+92 more)

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
- **612 isolated node(s):** `supabase`, `$schema`, `style`, `rsc`, `tsx` (+607 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 822 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `monster-parser-engine.ts`, `package.json`, `ai`, `RoomLobby.tsx`, `generator.ts`, `chat/route.ts`, `CoopTurnBar.tsx`, `maps/types.ts`, `presets/index.ts`, `DnDApp`, `supabase/client.ts`, `room-service.ts`, `party-arc-generator.ts`, `archetype-solver.ts`, `manual-combat-runner.ts`, `action/route.ts`, `movement.ts`, `loot-generator.ts`, `preset-data.ts`, `tools.ts`, `spawn-director.ts`, `library-data.ts`, `bot.ts`, `Combatant`, `Attack`, `canAct`, `TacticalMapPreset`, `spawn-director.test.ts`, `createClient`, `pacing-director.test.ts`, `open-map-service.ts`, `CombatGrid.tsx`, `cost.ts`, `aoe-templates.ts`, `rules.ts`, `serialize.ts`, `combat/types.ts`, `JoinRoomModal.tsx`, `xp-calculator.ts`, `encounter-generator.ts`, `monsters/types.ts`, `db.ts`, `scene-synchronizer.ts`, `encounters/types.ts`, `utils.ts`, `engine.ts`, `RoomCampaignSetupModal.tsx`, `validation.ts`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `Hotbar.tsx`, `drawer.tsx`, `DnDApp.tsx`, `chart.tsx`, `dropdown-menu.tsx`, `vitest`, `lucide-react`, `CombatView.tsx`, `toggle-group.tsx`, `react`, `use-toast.ts`, `carousel.tsx`, `utils.ts`, `CharacterCard.tsx`, `alert-dialog.tsx`, `form.tsx`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `Hotbar.tsx`, `package.json`, `drawer.tsx`, `DnDApp.tsx`, `RoomLobby.tsx`, `CoopTurnBar.tsx`, `CombatView.tsx`, `supabase/client.ts`, `toggle-group.tsx`, `cn`, `alert-dialog.tsx`, `use-toast.ts`, `vitest`, `lucide-react`, `CombatGrid.tsx`, `carousel.tsx`, `CharacterCard.tsx`, `form.tsx`, `JoinRoomModal.tsx`, `chart.tsx`, `dropdown-menu.tsx`, `utils.ts`, `RoomCampaignSetupModal.tsx`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **What connects `supabase`, `$schema`, `style` to the rest of the system?**
  _612 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Hotbar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1368421052631579 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.02702702702702703 - nodes in this community are weakly interconnected._