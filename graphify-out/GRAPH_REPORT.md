# Graph Report - battle+ai  (2026-09-24)

## Corpus Check
- 3234 files · ~2,009,132 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2124 nodes · 5447 edges · 143 communities (94 shown, 46 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 65 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7e2c3989`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- import-character.ts
- cn
- package.json
- dependencies
- cost.ts
- DnDApp.tsx
- aoe-templates.ts
- presets/index.ts
- monsters/types.ts
- Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)
- tools.ts
- createClient
- AttacksAbilitiesEditor.tsx
- D20RollModal.tsx
- JoinRoomModal.tsx
- archetype-solver.ts
- Supabase
- Global Constraints
- AI Dungeon Master — D&D 5e Solo
- CombatView.tsx
- Changelog
- action/route.ts
- engine.ts
- combat/types.ts
- story-arc.ts
- loot-generator.ts
- grid.ts
- Hotbar.tsx
- maps/types.ts
- alert-dialog.tsx
- use-toast.ts
- library-data.ts
- Changelog
- bot.ts
- RoomService
- Writing Guidelines for Postgres References
- import-character/route.ts
- vitest
- context-menu.tsx
- generator.ts
- RoomLobby.tsx
- encounter-generator.test.ts
- dropdown-menu.tsx
- compilerOptions
- TacticalMapPreset
- Section Definitions
- spawn-director.ts
- components.json
- models.ts
- pacing-director.test.ts
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- monster-bot-ai.test.ts
- supabase/types.ts
- canonical-biomes.ts
- CombatGrid.tsx
- monster-parser-engine.ts
- Supabase Postgres Best Practices
- carousel.tsx
- find-dragons.ts
- Combatant
- rules.ts
- serialize.ts
- form.tsx
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- command.tsx
- navigation-menu.tsx
- scripts
- room-service.ts
- db.ts
- chart.tsx
- scene-synchronizer.ts
- devDependencies
- advanced-full-text-search.md
- LibraryItemEditorModal
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- monster-adapter.ts
- conn-limits.md
- layout.tsx
- conn-pooling.md
- MonsterDefinition
- supabase/client.ts
- conn-prepared-statements.md
- data-batch-inserts.md
- @supabase/ssr
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- accordion.tsx
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
- collapsible.tsx
- hover-card.tsx
- query-partial-indexes.md
- DnDApp
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
- resizable.tsx
- open-map-service.ts
- tailwind.config.ts
- @radix-ui/react-aspect-ratio
- switch.tsx
- ImportCharacterModal
- maps/index.ts
- validation.ts
- chat/route.ts
- CoopTurnBar.tsx
- manual-combat-runner.ts
- party-arc-generator.ts
- toggle-group.tsx
- encounter-generator.ts
- sidebar.tsx
- drawer.tsx
- MonsterManifestEntry
- Global Constraints
- network-banner.js
- CharacterInventoryModal.tsx
- Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

## God Nodes (most connected - your core abstractions)
1. `cn()` - 234 edges
2. `react` - 76 edges
3. `vitest` - 67 edges
4. `Combatant` - 58 edges
5. `lucide-react` - 47 edges
6. `runBotTurn()` - 46 edges
7. `CombatState` - 46 edges
8. `RoomService` - 43 edges
9. `db` - 41 edges
10. `POST()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `resolveStoryModel()`  [EXTRACTED]
  scripts/check-polza-ping.ts → src/lib/ai/models.ts
- `checkAllTables()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/check-supabase-rooms.ts → src/lib/supabase/client.ts
- `main()` --calls--> `buildSystemPrompt()`  [EXTRACTED]
  scripts/consult-dm-prompt.ts → src/lib/ai/system-prompt.ts
- `inspectCharactersSchema()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-characters.ts → src/lib/supabase/client.ts
- `inspectData()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-data.ts → src/lib/supabase/client.ts

## Import Cycles
- None detected.

## Communities (143 total, 46 thin omitted)

### Community 0 - "import-character.ts"
Cohesion: 0.19
Nodes (16): fetchSharedCharacter(), maxDuration, POST(), ShareFetchError, SHEET_BASE_URL, ABILITY_KEYS, clampLevel(), DerivedMemory (+8 more)

### Community 1 - "cn"
Cohesion: 0.06
Nodes (42): input-otp, @radix-ui/react-menubar, @radix-ui/react-radio-group, BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+34 more)

### Community 2 - "package.json"
Cohesion: 0.04
Nodes (45): name, private, version, @ai-sdk/openai, @ai-sdk/react, bun-types, clsx, date-fns (+37 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (74): dependencies, ai, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, cmdk, date-fns (+66 more)

### Community 4 - "cost.ts"
Cohesion: 0.28
Nodes (8): CostStatsModal(), CostStatsModalProps, MessageBubble(), CampaignAiStats, formatRubles(), formatTokens(), ModelPricing, TokenUsage

### Community 5 - "DnDApp.tsx"
Cohesion: 0.08
Nodes (30): react, sonner, SupabaseAuthModal(), SupabaseAuthModalProps, ImportCharacterModalProps, COMMON_CONDITIONS, DAMAGE_TYPES, Props (+22 more)

### Community 6 - "aoe-templates.ts"
Cohesion: 0.27
Nodes (11): ClassifiedTargets, classifyAoeTargets(), DIRECTION_STEPS, DirStep, getConeCells(), getCubeCells(), getLineCells(), getSphereCells() (+3 more)

### Community 7 - "presets/index.ts"
Cohesion: 0.17
Nodes (12): OpenBattlemap, cityStreetPreset, gladiatorArenaPreset, ALL_PRESETS, getPresetByBiome(), getPresetById(), PRESETS_BY_BIOME, PRESETS_BY_ID (+4 more)

### Community 8 - "monsters/types.ts"
Cohesion: 0.25
Nodes (9): CreatureSize, CreatureType, MonsterAbilities, MonsterAction, MonsterDamageComponent, MonsterLegendaryActions, MonsterSpeed, MonsterSpellcasting (+1 more)

### Community 9 - "Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)"
Cohesion: 0.15
Nodes (12): 1. Контекст и проблема, 2. Цели и ключевые требования, 3. Архитектура и поток данных, 4.1. `POST /api/room/[code]/turn`, 4.2. `POST /api/room/[code]/turn/resolve`, 4.3. `GET /api/room/[code]/turn`, 4. Спецификация API и сервисов, 5.1. `PartyTurnBar` (`src/components/room/PartyTurnBar.tsx`) (+4 more)

### Community 10 - "tools.ts"
Cohesion: 0.10
Nodes (26): StoryAct, advanceActTool, campaignContextSchema, characterUpdatesSchema, createCharacterTool, dmTools, fetchPageTool, formatAct() (+18 more)

### Community 11 - "createClient"
Cohesion: 0.19
Nodes (13): ai, main(), main(), extractJson(), main(), main(), clientWithCustomUrl, cost (+5 more)

### Community 12 - "AttacksAbilitiesEditor.tsx"
Cohesion: 0.11
Nodes (18): @radix-ui/react-avatar, AttacksAbilitiesEditor(), save(), COST_OPTIONS, emptyAttack(), KIND_LABELS, Props, rebuildHotbar() (+10 more)

### Community 13 - "D20RollModal.tsx"
Cohesion: 0.20
Nodes (21): D20RollModal(), executeRoll(), handleAttackRoll(), handleCustomRoll(), handleSaveRoll(), handleSkillRoll(), ABILITY_META_LIST, AbilityKey (+13 more)

### Community 14 - "JoinRoomModal.tsx"
Cohesion: 0.31
Nodes (7): JoinRoomModal(), handleSubmit(), JoinRoomModalProps, DND_ROOM_WORDS, generateRoomCode(), isValidRoomCode(), normalizeRoomCode()

### Community 15 - "archetype-solver.ts"
Cohesion: 0.14
Nodes (25): inferBacklineRole(), isFrontlineCandidate(), RANGED_KEYWORDS, resolveArchetype(), solveBossMinions(), solveGreedyFallback(), solvePack(), solveSoloBoss() (+17 more)

### Community 16 - "Supabase"
Cohesion: 0.11
Nodes (15): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Debugging, Making and Committing Schema Changes (+7 more)

### Community 17 - "Global Constraints"
Cohesion: 0.18
Nodes (10): Global Constraints, Task 1: Backend Turn API — Блокировка повторной отправки и авто-резолвинг, Task 2: Host Force-Resolve — Завершение раунда с AFK-персонажами, Task 3: Компонент очереди отряда `PartyTurnBar`, Task 4: Интеграция пошагового цикла в `DnDApp.tsx`, Task 5: Финальная верификация, актуализация графа и публикация в Git, Автоматические тесты, План верификации (+2 more)

### Community 18 - "AI Dungeon Master — D&D 5e Solo"
Cohesion: 0.06
Nodes (34): AI Dungeon Master — D&D 5e Solo, AI забывает персонажей, API-ключ не работает, "Cannot find module 'xxx'", "Database is readonly" / "SQLite error", "Port 3000 is already in use", Быстрые кнопки, Ввод ключа в приложении (+26 more)

### Community 19 - "CombatView.tsx"
Cohesion: 0.11
Nodes (36): lucide-react, @radix-ui/react-slot, BestiaryBrowser(), BestiaryBrowserProps, CR_OPTIONS, CREATURE_TYPES, CombatEndSummary, CombatViewProps (+28 more)

### Community 20 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 21 - "action/route.ts"
Cohesion: 0.15
Nodes (39): loadState(), POST(), respond(), saveState(), syncCharacterPotionConsumed(), getBeastFormById(), isBotTurn(), applyEffect() (+31 more)

### Community 22 - "engine.ts"
Cohesion: 0.10
Nodes (40): GET(), hostilesOf(), isPerceivableByBot(), addDiceCount(), allyAdjacentTo(), applyActionParameters(), CastContext, CastResult (+32 more)

### Community 23 - "combat/types.ts"
Cohesion: 0.10
Nodes (27): EditableLibraryItem, LibraryCategory, AttackItem, Props, Tabs(), TabsContent(), TabsList(), TabsTrigger() (+19 more)

### Community 24 - "story-arc.ts"
Cohesion: 0.11
Nodes (31): main(), maxDuration, POST(), GET(), maxDuration, POST(), AuthMode, CompactOptions (+23 more)

### Community 25 - "loot-generator.ts"
Cohesion: 0.15
Nodes (17): BOSS_POTION_ITEM, BOSS_SCROLL_ITEM, CR_TO_XP, generateCombatLoot(), getXpForCr(), parseEnemyCr(), rollDice(), THEMATIC_BIOME_DROPS (+9 more)

### Community 27 - "Hotbar.tsx"
Cohesion: 0.16
Nodes (11): @radix-ui/react-popover, COST_LABEL, damageSummary(), extractWeaponBase(), Hotbar(), HotbarProps, spellSummary(), Popover() (+3 more)

### Community 28 - "maps/types.ts"
Cohesion: 0.21
Nodes (13): BiomeType, MapTagQuery, SpawnZoneDefinition, UniversalVTT, UVTTLight, UVTTPoint, UVTTPortal, UVTTResolution (+5 more)

### Community 29 - "alert-dialog.tsx"
Cohesion: 0.09
Nodes (19): @radix-ui/react-alert-dialog, AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay() (+11 more)

### Community 30 - "use-toast.ts"
Cohesion: 0.12
Nodes (25): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle (+17 more)

### Community 31 - "library-data.ts"
Cohesion: 0.06
Nodes (49): POST(), LibraryAbility, LibrarySpell, AbilityItem, SpellItem, PresetsModalProps, SpellDefinitionLike, ABILITY_ALIASES (+41 more)

### Community 32 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 33 - "bot.ts"
Cohesion: 0.14
Nodes (35): CombatantDetails(), alliesOf(), bestAttack(), BotArchetype, BotStep, BotTurnResult, decideBotTurn(), determineFacingTowards() (+27 more)

### Community 34 - "RoomService"
Cohesion: 0.18
Nodes (10): verifyMultiplayerRoomFlow(), DELETE(), GET(), POST(), POST(), GET(), POST(), mapParticipantFromDb() (+2 more)

### Community 35 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 36 - "import-character/route.ts"
Cohesion: 0.15
Nodes (16): POST(), ABILITY_RU_TO_EN, DAMAGE_TYPE_RU, detectActionCost(), detectWeapon(), parseBonus(), parseDamageString(), POST() (+8 more)

### Community 37 - "vitest"
Cohesion: 0.24
Nodes (12): vitest, POST(), GET(), POST(), resolveActiveRoomTurnHelper(), ResolveActiveRoomTurnOptions, bundleTurnInputs(), BundleTurnOptions (+4 more)

### Community 38 - "context-menu.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-context-menu, ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut() (+2 more)

### Community 39 - "generator.ts"
Cohesion: 0.18
Nodes (14): TEST_ENEMIES, TestEnemy, WeaponProfile, AttackOutcome, createTacticalEncounter(), EnemyInput, EnvironmentType, GeneratedMapElement (+6 more)

### Community 40 - "RoomLobby.tsx"
Cohesion: 0.10
Nodes (16): CharacterPickerModal(), CharacterPickerModalProps, formatCharacterCardForPicker(), FormattedCharacterCard, CampaignSetupFormValues, DIFFICULTY_OPTIONS, RoomCampaignSetupModal(), RoomCampaignSetupModalProps (+8 more)

### Community 41 - "encounter-generator.test.ts"
Cohesion: 0.32
Nodes (4): mockManifest, EncounterRequest, dungeonPrisonPreset, forestAmbushPreset

### Community 42 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-dropdown-menu, DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut() (+2 more)

### Community 43 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 44 - "TacticalMapPreset"
Cohesion: 0.40
Nodes (3): mapRegistry, MapManifestEntry, TacticalMapPreset

### Community 45 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 46 - "spawn-director.ts"
Cohesion: 0.21
Nodes (10): templePreset, assignTacticalSpawns(), BACKLINE_CLASSES, BOSS_KEYWORDS, createDefaultSpawnZones(), findClosestPassableCell(), inferCombatantRole(), SpawnDirectorOptions (+2 more)

### Community 47 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 48 - "models.ts"
Cohesion: 0.11
Nodes (25): main(), streamTurn(), main(), main(), main(), maxDuration, CHEAP_MODEL, DEFAULT_CHEAP_MODEL (+17 more)

### Community 49 - "pacing-director.test.ts"
Cohesion: 0.39
Nodes (6): DMAssistAction, evaluateCombatPacing(), PacingEvaluation, PacingThreatLevel, shouldTriggerEncounterRelief(), createMockState()

### Community 50 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.25
Nodes (7): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), 🗺️ 4. Категорический запрет визуальных заглушек и обязательный VTT-рендеринг (No Visual Stubs & Mandatory Real Battlemap Rendering), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 51 - "monster-bot-ai.test.ts"
Cohesion: 0.17
Nodes (8): createTestCombatState(), mockBite, mockClaw, createTestCombatState(), mockBite, mockClaw, MonsterMultiattack, RechargeAbility

### Community 52 - "supabase/types.ts"
Cohesion: 0.25
Nodes (7): PartyBond, RoomParticipantRecord, RoomRecord, RoomStatus, RoomTurnRecord, SupabaseCharacterRecord, TurnStatus

### Community 53 - "canonical-biomes.ts"
Cohesion: 0.11
Nodes (17): astralRiftPreset, banditCampPreset, bridgeChasmPreset, CANONICAL_PRESETS_EXTENDED, castleCourtyardPreset, desertDunesPreset, docksHarborPreset, foundryForgePreset (+9 more)

### Community 54 - "CombatGrid.tsx"
Cohesion: 0.08
Nodes (37): CombatEffectsLayer(), CombatEffectsLayerProps, CombatGrid(), getCellFromEvent(), handleGlobalMouseMove(), handleGlobalMouseUp(), handleSvgClick(), handleSvgMouseMove() (+29 more)

### Community 55 - "monster-parser-engine.ts"
Cohesion: 0.18
Nodes (17): cheerio, DAMAGE_TYPE_MAP, normalizeDamageType(), parseAbilities(), parseAction(), parseCR(), parseDamageTypes(), ParseMeta (+9 more)

### Community 56 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 57 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 58 - "find-dragons.ts"
Cohesion: 0.40
Nodes (4): dragons, manifest, MANIFEST_PATH, raw

### Community 59 - "Combatant"
Cohesion: 0.11
Nodes (16): CombatState, toggleDoor(), checkLegendaryResistance(), performLegendaryAction(), triggerAILegendaryActions(), createMockCombatState(), createTestCombatState(), mockTailAttack (+8 more)

### Community 60 - "rules.ts"
Cohesion: 0.12
Nodes (26): performAttack(), ActionCostCheck, AdvantageResult, applyDamage(), applyHealing(), AttackResolution, canPayForAttack(), computeAttackAdvantage() (+18 more)

### Community 61 - "serialize.ts"
Cohesion: 0.20
Nodes (16): GET(), getHostPort(), getLanIps(), POST(), GET(), POST(), GET(), DEFAULT_SPELLS (+8 more)

### Community 62 - "form.tsx"
Cohesion: 0.19
Nodes (12): @radix-ui/react-label, react-hook-form, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext (+4 more)

### Community 63 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.29
Nodes (6): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 64 - "command.tsx"
Cohesion: 0.18
Nodes (9): cmdk, Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator() (+1 more)

### Community 65 - "navigation-menu.tsx"
Cohesion: 0.20
Nodes (10): @radix-ui/react-navigation-menu, NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger() (+2 more)

### Community 66 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, db:generate, db:migrate, db:push, db:reset, dev, lint (+2 more)

### Community 67 - "room-service.ts"
Cohesion: 0.18
Nodes (13): POST(), PartyAwareAct1, resolveRoomTurn(), startRoomCampaign(), StartRoomCampaignResult, submitPlayerAction(), CreateRoomInput, JoinRoomInput (+5 more)

### Community 68 - "db.ts"
Cohesion: 0.11
Nodes (9): @prisma/client, isEnemyDefeatedOrFled(), POST(), calculateAwardedXP(), awardCombatVictoryXP(), AwardCombatXPResult, CR_TO_XP_TABLE, db (+1 more)

### Community 69 - "chart.tsx"
Cohesion: 0.23
Nodes (10): recharts, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 70 - "scene-synchronizer.ts"
Cohesion: 0.36
Nodes (8): zod, applyStatusToNotes(), extractJson(), extractStatusFromNotes(), newNpcSchema, SceneUpdate, sceneUpdateSchema, syncSceneState()

### Community 71 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, bun-types, cheerio, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tw-animate-css (+5 more)

### Community 76 - "monster-adapter.ts"
Cohesion: 0.17
Nodes (13): crToProfBonus(), getAttackStem(), MonsterAdapterOptions, monsterDefinitionToCombatant(), parseCountBeforeStem(), parseMultiattack(), safeId(), CombatantType (+5 more)

### Community 78 - "layout.tsx"
Cohesion: 0.20
Nodes (7): nextConfig, next, next-themes, geistMono, geistSans, metadata, Toaster()

### Community 80 - "MonsterDefinition"
Cohesion: 0.29
Nodes (7): createManifestEntry(), filterMonsters(), COMPENDIUM_DIR, MANIFEST_PATH, mockEntries, MonsterDefinition, MonsterQueryFilter

### Community 81 - "supabase/client.ts"
Cohesion: 0.15
Nodes (14): @supabase/supabase-js, checkAllTables(), inspectCharactersSchema(), inspectData(), listCharacters(), listUsers(), testAuth(), GET() (+6 more)

### Community 89 - "accordion.tsx"
Cohesion: 0.33
Nodes (4): @radix-ui/react-accordion, AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 107 - "DnDApp"
Cohesion: 0.08
Nodes (9): DnDApp(), deleteCampaign(), handleGenerateStory(), loadCampaignsList(), startArcGeneration(), emptySubscribe(), getMessageError(), getMessageText() (+1 more)

### Community 120 - "resizable.tsx"
Cohesion: 0.40
Nodes (3): react-resizable-panels, ResizableHandle(), ResizablePanelGroup()

### Community 121 - "open-map-service.ts"
Cohesion: 0.35
Nodes (8): GET(), getOpenMapById(), getPopularTags(), OPEN_BATTLEMAP_CATALOG, OpenMapSearchQuery, POPULAR_MAP_TAGS, resolveBattlemapForNarrative(), searchOpenMaps()

### Community 122 - "tailwind.config.ts"
Cohesion: 0.50
Nodes (3): tailwindcss, tailwindcss-animate, config

### Community 127 - "validation.ts"
Cohesion: 0.29
Nodes (8): GET(), CharacterCandidate, EvaluatedCharacter, EvaluatedCharacterList, extractCharacterLevel(), filterUserCharactersForRoom(), LevelValidationResult, validateCharacterForRoom()

### Community 135 - "chat/route.ts"
Cohesion: 0.20
Nodes (14): cleanAssistantNarrative(), maxDuration, POST(), compactHistory(), inFlight, loadSummaries(), VERBATIM_MESSAGES, calculateCostRub() (+6 more)

### Community 137 - "CoopTurnBar.tsx"
Cohesion: 0.18
Nodes (15): canSubmitPlayerTurn(), CoopTurnBar(), CoopTurnBarProps, validatePlayerAction(), formatTypingMessage(), LiveTypingIndicator(), LiveTypingIndicatorProps, TypingUser (+7 more)

### Community 140 - "manual-combat-runner.ts"
Cohesion: 0.14
Nodes (26): createHeroes(), ensureDir(), initCombat(), initDragonCombat(), loadSession(), main(), printStatus(), saveState() (+18 more)

### Community 143 - "party-arc-generator.ts"
Cohesion: 0.28
Nodes (11): buildPartyAct1Prompt(), CombatDifficultyConfig, extractJson(), extractPartyRosterFromParticipants(), generatePartyAwareAct1(), getCombatDifficultyConfig(), PartyArcGenerationParams, partyAwareAct1Schema (+3 more)

### Community 145 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (12): class-variance-authority, @radix-ui/react-toggle, @radix-ui/react-toggle-group, Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup() (+4 more)

### Community 148 - "encounter-generator.ts"
Cohesion: 0.33
Nodes (8): main(), GET(), POST(), createCombatantStub(), createMonsterDefinitionFromManifest(), generateEncounter(), loadDefaultManifest(), loadMonsterDefinition()

### Community 150 - "sidebar.tsx"
Cohesion: 0.05
Nodes (42): @radix-ui/react-dialog, @radix-ui/react-tooltip, Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay() (+34 more)

### Community 152 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): vaul, DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 153 - "MonsterManifestEntry"
Cohesion: 0.17
Nodes (13): BossMinionsCandidate, PackCandidate, TacticalCandidate, BIOME_CONFIGS, BiomeAffinity, entryMatchesKeywords(), getBiomeCandidatePool(), UNIVERSAL_FALLBACK_KEYWORDS (+5 more)

### Community 154 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Global Constraints, Task 1: Backend Data Model & Combat Engine Potion Support, Task 2: Combat Hotbar & CombatView UI Integration, Task 3: Campaign Character Card & Inventory Modal, Task 4: Full Verification, Graphify & Git Delivery, Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою — Implementation Plan

### Community 158 - "network-banner.js"
Cohesion: 0.33
Nodes (5): interfaces, localIps, os, otherIps, radminIps

### Community 159 - "CharacterInventoryModal.tsx"
Cohesion: 0.09
Nodes (29): zustand, abilityMod(), CharacterCard(), getRelationTier(), modStr(), RelationTier, typeColors, typeLabels (+21 more)

### Community 160 - "Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою"
Cohesion: 0.50
Nodes (3): 1. Цель, 2. Глобальные ограничения, Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

## Knowledge Gaps
- **579 isolated node(s):** `supabase`, `$schema`, `style`, `rsc`, `tsx` (+574 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 793 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **46 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `DnDApp.tsx` to `cn`, `package.json`, `CoopTurnBar.tsx`, `AttacksAbilitiesEditor.tsx`, `D20RollModal.tsx`, `JoinRoomModal.tsx`, `toggle-group.tsx`, `CombatView.tsx`, `sidebar.tsx`, `combat/types.ts`, `drawer.tsx`, `Hotbar.tsx`, `alert-dialog.tsx`, `use-toast.ts`, `CharacterInventoryModal.tsx`, `context-menu.tsx`, `RoomLobby.tsx`, `dropdown-menu.tsx`, `CombatGrid.tsx`, `carousel.tsx`, `form.tsx`, `command.tsx`, `navigation-menu.tsx`, `chart.tsx`, `supabase/client.ts`, `accordion.tsx`, `hover-card.tsx`, `DnDApp`, `resizable.tsx`, `switch.tsx`?**
  _High betweenness centrality (0.117) - this node is a cross-community bridge._
- **Why does `vitest` connect `vitest` to `package.json`, `DnDApp.tsx`, `aoe-templates.ts`, `chat/route.ts`, `presets/index.ts`, `CoopTurnBar.tsx`, `monsters/types.ts`, `manual-combat-runner.ts`, `D20RollModal.tsx`, `JoinRoomModal.tsx`, `party-arc-generator.ts`, `archetype-solver.ts`, `action/route.ts`, `engine.ts`, `MonsterManifestEntry`, `loot-generator.ts`, `maps/types.ts`, `library-data.ts`, `bot.ts`, `RoomService`, `generator.ts`, `RoomLobby.tsx`, `encounter-generator.test.ts`, `TacticalMapPreset`, `spawn-director.ts`, `models.ts`, `pacing-director.test.ts`, `monster-bot-ai.test.ts`, `CombatGrid.tsx`, `monster-parser-engine.ts`, `Combatant`, `rules.ts`, `serialize.ts`, `room-service.ts`, `db.ts`, `scene-synchronizer.ts`, `monster-adapter.ts`, `MonsterDefinition`, `supabase/client.ts`, `open-map-service.ts`, `validation.ts`?**
  _High betweenness centrality (0.108) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `DnDApp.tsx`, `CoopTurnBar.tsx`, `AttacksAbilitiesEditor.tsx`, `toggle-group.tsx`, `CombatView.tsx`, `sidebar.tsx`, `combat/types.ts`, `drawer.tsx`, `Hotbar.tsx`, `alert-dialog.tsx`, `use-toast.ts`, `CharacterInventoryModal.tsx`, `context-menu.tsx`, `dropdown-menu.tsx`, `carousel.tsx`, `form.tsx`, `command.tsx`, `navigation-menu.tsx`, `chart.tsx`, `accordion.tsx`, `hover-card.tsx`, `resizable.tsx`, `switch.tsx`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **What connects `supabase`, `$schema`, `style` to the rest of the system?**
  _579 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.058001397624039136 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.02702702702702703 - nodes in this community are weakly interconnected._