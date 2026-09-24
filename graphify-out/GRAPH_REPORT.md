# Graph Report - battle+ai  (2026-09-24)

## Corpus Check
- 3242 files · ~2,017,953 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2170 nodes · 5569 edges · 143 communities (96 shown, 44 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 65 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6d1e9e71`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AttacksAbilitiesEditor.tsx
- cn
- package.json
- dependencies
- DnDApp.tsx
- utils.ts
- monster-adapter.ts
- presets/index.ts
- RoomLobby.tsx
- Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)
- tools.ts
- createClient
- accordion.tsx
- D20RollModal.tsx
- ephemeral-tail.ts
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
- generator.ts
- maps/types.ts
- alert-dialog.tsx
- use-toast.ts
- library-data.ts
- Changelog
- bot.ts
- room-service.ts
- Writing Guidelines for Postgres References
- import-character/route.ts
- Attack
- context-menu.tsx
- command.tsx
- resolve-turn-helper.ts
- models.ts
- LibraryItemEditorModal.tsx
- compilerOptions
- mapRegistry
- Section Definitions
- spawn-director.ts
- components.json
- system-prompt.ts
- pacing-director.test.ts
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- Combatant
- supabase/types.ts
- canonical-biomes.ts
- CombatGrid.tsx
- monster-parser-engine.ts
- Supabase Postgres Best Practices
- carousel.tsx
- engine.ts
- CharacterInventoryModal.tsx
- rules.ts
- serialize.ts
- form.tsx
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- combat/types.ts
- find-dragons.ts
- Hotbar.tsx
- LibraryItemEditorModal
- vitest
- chart.tsx
- dropdown-menu.tsx
- devDependencies
- advanced-full-text-search.md
- aoe-templates.ts
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- encounter-generator.ts
- conn-limits.md
- layout.tsx
- conn-pooling.md
- monsters/types.ts
- supabase/client.ts
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
- collapsible.tsx
- Global Constraints
- query-partial-indexes.md
- maps/route.ts
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
- navigation-menu.tsx
- open-map-service.ts
- LibraryManagerModal
- resizable.tsx
- room/types.ts
- hover-card.tsx
- validation.ts
- scripts
- prepare-prisma-for-env.js
- chat/route.ts
- tailwind.config.ts
- @radix-ui/react-aspect-ratio
- switch.tsx
- manual-combat-runner.ts
- party-arc-generator.ts
- toggle-group.tsx
- sidebar.tsx
- biome-matcher.ts
- Global Constraints
- network-banner.js
- Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

## God Nodes (most connected - your core abstractions)
1. `cn()` - 234 edges
2. `react` - 76 edges
3. `vitest` - 69 edges
4. `Combatant` - 58 edges
5. `lucide-react` - 47 edges
6. `runBotTurn()` - 46 edges
7. `CombatState` - 46 edges
8. `db` - 44 edges
9. `RoomService` - 43 edges
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

## Communities (143 total, 44 thin omitted)

### Community 0 - "AttacksAbilitiesEditor.tsx"
Cohesion: 0.12
Nodes (18): AttacksAbilitiesEditor(), save(), COST_OPTIONS, emptyAttack(), KIND_LABELS, Props, rebuildHotbar(), Tab (+10 more)

### Community 1 - "cn"
Cohesion: 0.06
Nodes (42): input-otp, @radix-ui/react-menubar, @radix-ui/react-radio-group, BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+34 more)

### Community 2 - "package.json"
Cohesion: 0.04
Nodes (45): name, private, version, @ai-sdk/openai, @ai-sdk/react, bun-types, clsx, date-fns (+37 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (74): dependencies, ai, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, cmdk, date-fns (+66 more)

### Community 4 - "DnDApp.tsx"
Cohesion: 0.04
Nodes (33): zustand, CombatEndSummary, CostStatsModal(), CostStatsModalProps, ArcState, ChatMessage, DnDApp(), handleGenerateStory() (+25 more)

### Community 5 - "utils.ts"
Cohesion: 0.13
Nodes (20): @radix-ui/react-avatar, abilityMod(), CharacterCard(), getRelationTier(), modStr(), RelationTier, typeColors, typeLabels (+12 more)

### Community 6 - "monster-adapter.ts"
Cohesion: 0.23
Nodes (10): crToProfBonus(), getAttackStem(), MonsterAdapterOptions, monsterDefinitionToCombatant(), parseCountBeforeStem(), parseMultiattack(), safeId(), CombatantType (+2 more)

### Community 7 - "presets/index.ts"
Cohesion: 0.21
Nodes (11): cityStreetPreset, dungeonPrisonPreset, forestAmbushPreset, gladiatorArenaPreset, PRESETS_BY_ID, lavaCavePreset, shipBattlePreset, tavernPreset (+3 more)

### Community 8 - "RoomLobby.tsx"
Cohesion: 0.09
Nodes (20): @supabase/supabase-js, testAuth(), SupabaseAuthModal(), SupabaseAuthModalProps, CreateRoomModal(), CreateRoomModalProps, CampaignSetupFormValues, DIFFICULTY_OPTIONS (+12 more)

### Community 9 - "Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)"
Cohesion: 0.15
Nodes (12): 1. Контекст и проблема, 2. Цели и ключевые требования, 3. Архитектура и поток данных, 4.1. `POST /api/room/[code]/turn`, 4.2. `POST /api/room/[code]/turn/resolve`, 4.3. `GET /api/room/[code]/turn`, 4. Спецификация API и сервисов, 5.1. `PartyTurnBar` (`src/components/room/PartyTurnBar.tsx`) (+4 more)

### Community 10 - "tools.ts"
Cohesion: 0.06
Nodes (43): fetchSharedCharacter(), maxDuration, POST(), ShareFetchError, SHEET_BASE_URL, POST(), advanceActTool, calculateTool (+35 more)

### Community 11 - "createClient"
Cohesion: 0.17
Nodes (14): ai, main(), main(), extractJson(), main(), main(), clientWithCustomUrl, cost (+6 more)

### Community 12 - "accordion.tsx"
Cohesion: 0.33
Nodes (4): @radix-ui/react-accordion, AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 13 - "D20RollModal.tsx"
Cohesion: 0.14
Nodes (28): CharacterInventoryModalProps, D20RollModal(), executeRoll(), handleAttackRoll(), handleCustomRoll(), handleSaveRoll(), handleSkillRoll(), D20RollModalProps (+20 more)

### Community 14 - "ephemeral-tail.ts"
Cohesion: 0.22
Nodes (11): buildEphemeralSceneTail, EphemeralNpcState, EphemeralPartyMemberState, EphemeralRecentEvent, EphemeralSceneState, fetchEphemeralSceneTail(), formatSceneSnapshot(), injectEphemeralTailToLastUserMessage() (+3 more)

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
Nodes (37): lucide-react, @radix-ui/react-slot, react, BestiaryBrowser(), BestiaryBrowserProps, CR_OPTIONS, CREATURE_TYPES, CombatViewProps (+29 more)

### Community 20 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 21 - "action/route.ts"
Cohesion: 0.17
Nodes (39): loadState(), POST(), respond(), saveState(), syncCharacterPotionConsumed(), isBotTurn(), applyEffect(), assertTurn() (+31 more)

### Community 22 - "movement.ts"
Cohesion: 0.17
Nodes (21): GET(), checkSpellRange(), createMockCombatState(), cellCost(), computeVisibilityStatus(), coversCell(), FACING_VECTORS, findOpportunityAttackers() (+13 more)

### Community 23 - "Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness"
Cohesion: 0.17
Nodes (11): 1.1. Механика работы KV-кэша DeepSeek (Prefix Caching), 1.2. Диагностика текущего состояния `dnd-ai-master` (Cache Hit ~0%), 1. Контекст и проблема, 2. Архитектура: Модульная 3-зонная модель контекста, 3.1. `src/lib/ai/caching/frozen-prefix.ts`, 3.2. `src/lib/ai/caching/ephemeral-tail.ts`, 3.3. `src/lib/ai/caching/milestone-compactor.ts`, 3. Компоненты и интерфейсы (+3 more)

### Community 24 - "story-arc.ts"
Cohesion: 0.13
Nodes (27): main(), maxDuration, POST(), GET(), maxDuration, POST(), resolveStoryModel(), actSchema (+19 more)

### Community 25 - "loot-generator.ts"
Cohesion: 0.15
Nodes (17): BOSS_POTION_ITEM, BOSS_SCROLL_ITEM, CR_TO_XP, generateCombatLoot(), getXpForCr(), parseEnemyCr(), rollDice(), THEMATIC_BIOME_DROPS (+9 more)

### Community 26 - "preset-data.ts"
Cohesion: 0.20
Nodes (9): POST(), PresetsModalProps, CAMPAIGN_HEROES_PRESETS, createCombatantFromPreset(), createPresetFromCombatant(), DEFAULT_PRESETS, getAllSRDMonsters(), getSRDMonster() (+1 more)

### Community 27 - "generator.ts"
Cohesion: 0.15
Nodes (18): startCombatTool, EncounterDifficulty, GeneratedEncounter, PartyMember, SpawnedEnemy, SquadArchetype, SquadMonsterSlot, SquadPlan (+10 more)

### Community 28 - "maps/types.ts"
Cohesion: 0.20
Nodes (14): GeneratedMapElement, OpenBattlemap, BiomeType, SpawnZoneDefinition, UniversalVTT, UVTTLight, UVTTPoint, UVTTPortal (+6 more)

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
Cohesion: 0.14
Nodes (36): CombatantDetails(), alliesOf(), bestAttack(), BotArchetype, BotStep, BotTurnResult, determineFacingTowards(), evaluateTargetScore() (+28 more)

### Community 34 - "room-service.ts"
Cohesion: 0.11
Nodes (23): verifyMultiplayerRoomFlow(), DELETE(), GET(), POST(), POST(), handleSubmit(), PartyAwareAct1, DND_ROOM_WORDS (+15 more)

### Community 35 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 36 - "import-character/route.ts"
Cohesion: 0.26
Nodes (12): ABILITY_RU_TO_EN, DAMAGE_TYPE_RU, detectActionCost(), detectWeapon(), parseBonus(), parseDamageString(), POST(), abilitiesForClass() (+4 more)

### Community 37 - "Attack"
Cohesion: 0.33
Nodes (8): WeaponProfile, BEAST_FORMS, BeastForm, AttackOutcome, createAuditCombatant(), createAuditState(), Attack, CombatAbility

### Community 38 - "context-menu.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-context-menu, ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut() (+2 more)

### Community 39 - "command.tsx"
Cohesion: 0.18
Nodes (9): cmdk, Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator() (+1 more)

### Community 40 - "resolve-turn-helper.ts"
Cohesion: 0.21
Nodes (11): POST(), GET(), POST(), resolveActiveRoomTurnHelper(), getActiveTurn(), mapTurnFromDb(), bundleTurnInputs(), BundleTurnOptions (+3 more)

### Community 41 - "models.ts"
Cohesion: 0.18
Nodes (9): main(), maxDuration, CHEAP_MODEL, DEFAULT_CHEAP_MODEL, DEFAULT_DM_MODEL, DEFAULT_STORY_MODEL, FEATURED_MODELS, FeaturedModelInfo (+1 more)

### Community 42 - "LibraryItemEditorModal.tsx"
Cohesion: 0.10
Nodes (25): sonner, ImportCharacterModal(), ImportCharacterModalProps, COMMON_CONDITIONS, DAMAGE_TYPES, LibraryCategory, Props, calculateBaseStats() (+17 more)

### Community 43 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 44 - "mapRegistry"
Cohesion: 0.33
Nodes (3): mapRegistry, MapManifestEntry, MapTagQuery

### Community 45 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 46 - "spawn-director.ts"
Cohesion: 0.17
Nodes (10): ToggleDoorOutcome, assignTacticalSpawns(), BACKLINE_CLASSES, BOSS_KEYWORDS, createDefaultSpawnZones(), findClosestPassableCell(), inferCombatantRole(), SpawnDirectorOptions (+2 more)

### Community 47 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 48 - "system-prompt.ts"
Cohesion: 0.19
Nodes (16): main(), streamTurn(), main(), main(), resolveDmModel(), StoryArc, buildArcSection(), buildSystemPrompt() (+8 more)

### Community 49 - "pacing-director.test.ts"
Cohesion: 0.39
Nodes (6): DMAssistAction, evaluateCombatPacing(), PacingEvaluation, PacingThreatLevel, shouldTriggerEncounterRelief(), createMockState()

### Community 50 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.25
Nodes (7): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), 🗺️ 4. Категорический запрет визуальных заглушек и обязательный VTT-рендеринг (No Visual Stubs & Mandatory Real Battlemap Rendering), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 51 - "Combatant"
Cohesion: 0.12
Nodes (12): CombatState, createTestCombatState(), mockTailAttack, createTestCombatState(), mockMeleeAttack, createTestCombatState(), createTestCombatState(), mockMeleeAttack (+4 more)

### Community 52 - "supabase/types.ts"
Cohesion: 0.25
Nodes (7): PartyBond, RoomParticipantRecord, RoomRecord, RoomStatus, RoomTurnRecord, SupabaseCharacterRecord, TurnStatus

### Community 53 - "canonical-biomes.ts"
Cohesion: 0.11
Nodes (17): astralRiftPreset, banditCampPreset, bridgeChasmPreset, CANONICAL_PRESETS_EXTENDED, castleCourtyardPreset, desertDunesPreset, docksHarborPreset, foundryForgePreset (+9 more)

### Community 54 - "CombatGrid.tsx"
Cohesion: 0.07
Nodes (40): CombatEffectsLayer(), CombatEffectsLayerProps, CombatGrid(), getCellFromEvent(), handleGlobalMouseMove(), handleGlobalMouseUp(), handleSvgClick(), handleSvgMouseMove() (+32 more)

### Community 55 - "monster-parser-engine.ts"
Cohesion: 0.14
Nodes (21): cheerio, DAMAGE_TYPE_MAP, normalizeDamageType(), parseAbilities(), parseAction(), parseCR(), parseDamageTypes(), ParseMeta (+13 more)

### Community 56 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 57 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 58 - "engine.ts"
Cohesion: 0.12
Nodes (19): addDiceCount(), allyAdjacentTo(), applyActionParameters(), CastContext, CastResult, findSneakAttack(), MoveOutcome, MultiattackResult (+11 more)

### Community 59 - "CharacterInventoryModal.tsx"
Cohesion: 0.24
Nodes (11): CharacterInventoryModal(), handleAddPotion(), handleDrinkPotion(), createUniqueId(), getSyncTimestamp(), InventoryGear, InventoryPotion, parseInventory() (+3 more)

### Community 60 - "rules.ts"
Cohesion: 0.10
Nodes (29): getBeastFormById(), dealDamage(), dropConcentrationEffects(), revertWildShape(), rollInitiativeFor(), ActionCostCheck, AdvantageResult, applyDamage() (+21 more)

### Community 61 - "serialize.ts"
Cohesion: 0.16
Nodes (16): GET(), getHostPort(), getLanIps(), POST(), TEST_ENEMIES, TestEnemy, GET(), EnemyInput (+8 more)

### Community 62 - "form.tsx"
Cohesion: 0.19
Nodes (12): @radix-ui/react-label, react-hook-form, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext (+4 more)

### Community 63 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.29
Nodes (6): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 64 - "combat/types.ts"
Cohesion: 0.09
Nodes (23): createTestCombatState(), mockBite, mockClaw, createTestCombatState(), mockBite, mockClaw, ABILITY_LABELS, AppliedEffect (+15 more)

### Community 65 - "find-dragons.ts"
Cohesion: 0.40
Nodes (4): dragons, manifest, MANIFEST_PATH, raw

### Community 66 - "Hotbar.tsx"
Cohesion: 0.16
Nodes (10): @radix-ui/react-popover, COST_LABEL, damageSummary(), extractWeaponBase(), Hotbar(), spellSummary(), Popover(), PopoverContent() (+2 more)

### Community 68 - "vitest"
Cohesion: 0.17
Nodes (10): @prisma/client, vitest, isEnemyDefeatedOrFled(), POST(), GET(), awardCombatVictoryXP(), AwardCombatXPResult, CR_TO_XP_TABLE (+2 more)

### Community 69 - "chart.tsx"
Cohesion: 0.23
Nodes (10): recharts, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 70 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-dropdown-menu, DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut() (+2 more)

### Community 71 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, bun-types, cheerio, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tw-animate-css (+5 more)

### Community 73 - "aoe-templates.ts"
Cohesion: 0.27
Nodes (11): ClassifiedTargets, classifyAoeTargets(), DIRECTION_STEPS, DirStep, getConeCells(), getCubeCells(), getLineCells(), getSphereCells() (+3 more)

### Community 76 - "encounter-generator.ts"
Cohesion: 0.21
Nodes (11): main(), GET(), GET(), POST(), createCombatantStub(), createMonsterDefinitionFromManifest(), generateEncounter(), loadDefaultManifest() (+3 more)

### Community 78 - "layout.tsx"
Cohesion: 0.20
Nodes (7): nextConfig, next, next-themes, geistMono, geistSans, metadata, Toaster()

### Community 80 - "monsters/types.ts"
Cohesion: 0.21
Nodes (11): createManifestEntry(), filterMonsters(), COMPENDIUM_DIR, MANIFEST_PATH, mockEntries, CreatureSize, MonsterAbilities, MonsterAction (+3 more)

### Community 81 - "supabase/client.ts"
Cohesion: 0.12
Nodes (19): checkAllTables(), inspectCharactersSchema(), inspectData(), listCharacters(), listUsers(), GET(), POST(), POST() (+11 more)

### Community 89 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): vaul, DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 105 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Prompt Caching Architecture (DeepSeek Harness Parity) Implementation Plan, Task 1: Core Caching Utilities — `frozen-prefix.ts` and `ephemeral-tail.ts`, Task 2: Discrete Milestone History Compactor — `milestone-compactor.ts`, Task 3: Integration into Solo Chat Endpoint (`src/app/api/chat/route.ts`), Task 4: Integration into Multiplayer Co-op Turn Helper (`src/lib/room/resolve-turn-helper.ts`), Task 5: End-to-End Verification & Cost Calculation Audit

### Community 107 - "maps/route.ts"
Cohesion: 0.38
Nodes (5): POST(), ALL_PRESETS, getPresetByBiome(), getPresetById(), PRESETS_BY_BIOME

### Community 120 - "navigation-menu.tsx"
Cohesion: 0.20
Nodes (10): @radix-ui/react-navigation-menu, NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger() (+2 more)

### Community 121 - "open-map-service.ts"
Cohesion: 0.35
Nodes (8): GET(), getOpenMapById(), getPopularTags(), OPEN_BATTLEMAP_CATALOG, OpenMapSearchQuery, POPULAR_MAP_TAGS, resolveBattlemapForNarrative(), searchOpenMaps()

### Community 123 - "resizable.tsx"
Cohesion: 0.40
Nodes (3): react-resizable-panels, ResizableHandle(), ResizablePanelGroup()

### Community 124 - "room/types.ts"
Cohesion: 0.18
Nodes (16): canSubmitPlayerTurn(), CoopTurnBar(), CoopTurnBarProps, validatePlayerAction(), formatTypingMessage(), LiveTypingIndicator(), LiveTypingIndicatorProps, TypingUser (+8 more)

### Community 127 - "validation.ts"
Cohesion: 0.29
Nodes (8): GET(), CharacterCandidate, EvaluatedCharacter, EvaluatedCharacterList, extractCharacterLevel(), filterUserCharactersForRoom(), LevelValidationResult, validateCharacterForRoom()

### Community 129 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:generate, db:migrate, db:push, db:reset, dev, lint (+3 more)

### Community 133 - "prepare-prisma-for-env.js"
Cohesion: 0.33
Nodes (5): fs, isVercel, path, schema, schemaPath

### Community 135 - "chat/route.ts"
Cohesion: 0.11
Nodes (27): zod, cleanAssistantNarrative(), maxDuration, POST(), AuthMode, compactHistory(), CompactOptions, inFlight (+19 more)

### Community 136 - "tailwind.config.ts"
Cohesion: 0.50
Nodes (3): tailwindcss, tailwindcss-animate, config

### Community 140 - "manual-combat-runner.ts"
Cohesion: 0.14
Nodes (27): createHeroes(), ensureDir(), initCombat(), initDragonCombat(), loadSession(), main(), printStatus(), saveState() (+19 more)

### Community 143 - "party-arc-generator.ts"
Cohesion: 0.28
Nodes (11): buildPartyAct1Prompt(), CombatDifficultyConfig, extractJson(), extractPartyRosterFromParticipants(), generatePartyAwareAct1(), getCombatDifficultyConfig(), PartyArcGenerationParams, partyAwareAct1Schema (+3 more)

### Community 145 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (12): class-variance-authority, @radix-ui/react-toggle, @radix-ui/react-toggle-group, Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup() (+4 more)

### Community 150 - "sidebar.tsx"
Cohesion: 0.05
Nodes (42): @radix-ui/react-dialog, @radix-ui/react-tooltip, Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay() (+34 more)

### Community 153 - "biome-matcher.ts"
Cohesion: 0.27
Nodes (9): BIOME_CONFIGS, BiomeAffinity, entryMatchesKeywords(), getBiomeCandidatePool(), UNIVERSAL_FALLBACK_KEYWORDS, UNIVERSAL_FALLBACK_TYPES, mockManifest, StoryFactionContext (+1 more)

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
- **603 isolated node(s):** `supabase`, `$schema`, `style`, `rsc`, `tsx` (+598 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 812 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **44 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `package.json`, `utils.ts`, `monster-adapter.ts`, `chat/route.ts`, `RoomLobby.tsx`, `manual-combat-runner.ts`, `D20RollModal.tsx`, `ephemeral-tail.ts`, `party-arc-generator.ts`, `archetype-solver.ts`, `movement.ts`, `biome-matcher.ts`, `loot-generator.ts`, `generator.ts`, `maps/types.ts`, `preset-data.ts`, `library-data.ts`, `bot.ts`, `room-service.ts`, `Attack`, `resolve-turn-helper.ts`, `LibraryItemEditorModal.tsx`, `mapRegistry`, `spawn-director.ts`, `system-prompt.ts`, `pacing-director.test.ts`, `Combatant`, `CombatGrid.tsx`, `monster-parser-engine.ts`, `engine.ts`, `rules.ts`, `combat/types.ts`, `aoe-templates.ts`, `encounter-generator.ts`, `monsters/types.ts`, `supabase/client.ts`, `maps/route.ts`, `open-map-service.ts`, `room/types.ts`, `validation.ts`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `AttacksAbilitiesEditor.tsx`, `cn`, `package.json`, `DnDApp.tsx`, `utils.ts`, `RoomLobby.tsx`, `switch.tsx`, `accordion.tsx`, `D20RollModal.tsx`, `toggle-group.tsx`, `sidebar.tsx`, `alert-dialog.tsx`, `use-toast.ts`, `context-menu.tsx`, `command.tsx`, `LibraryItemEditorModal.tsx`, `CombatGrid.tsx`, `carousel.tsx`, `CharacterInventoryModal.tsx`, `form.tsx`, `Hotbar.tsx`, `chart.tsx`, `dropdown-menu.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `resizable.tsx`, `room/types.ts`, `hover-card.tsx`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `AttacksAbilitiesEditor.tsx`, `DnDApp.tsx`, `utils.ts`, `switch.tsx`, `accordion.tsx`, `D20RollModal.tsx`, `toggle-group.tsx`, `react`, `sidebar.tsx`, `alert-dialog.tsx`, `use-toast.ts`, `context-menu.tsx`, `command.tsx`, `LibraryItemEditorModal.tsx`, `carousel.tsx`, `form.tsx`, `Hotbar.tsx`, `chart.tsx`, `dropdown-menu.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `resizable.tsx`, `hover-card.tsx`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **What connects `supabase`, `$schema`, `style` to the rest of the system?**
  _603 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AttacksAbilitiesEditor.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11956521739130435 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.058001397624039136 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._