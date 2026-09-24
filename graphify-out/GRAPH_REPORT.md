# Graph Report - battle+ai  (2026-09-24)

## Corpus Check
- 3236 files · ~2,013,498 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2135 nodes · 5518 edges · 148 communities (102 shown, 43 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 65 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4b98b837`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- scene-synchronizer.ts
- cn
- package.json
- dependencies
- DnDApp.tsx
- utils.ts
- monster-adapter.ts
- presets/index.ts
- useSupabaseAuth
- Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)
- import-character.ts
- createClient
- accordion.tsx
- D20RollModal.tsx
- JoinRoomModal.tsx
- archetype-solver.ts
- Supabase
- Global Constraints
- AI Dungeon Master — D&D 5e Solo
- react
- Changelog
- action/route.ts
- movement.ts
- tools.ts
- story-arc.ts
- loot-generator.ts
- preset-data.ts
- encounter-generator.ts
- maps/types.ts
- alert-dialog.tsx
- use-toast.ts
- adapter.ts
- Changelog
- bot.ts
- RoomService
- Writing Guidelines for Postgres References
- import-character/route.ts
- library-data.ts
- context-menu.tsx
- input-otp.tsx
- vitest
- models.ts
- lucide-react
- compilerOptions
- TacticalMapPreset
- Section Definitions
- spawn-director.ts
- components.json
- system-prompt.ts
- pacing-director.test.ts
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- Combatant
- supabase/types.ts
- canonical-biomes.ts
- CombatView
- monsters/types.ts
- Supabase Postgres Best Practices
- carousel.tsx
- engine.ts
- LibraryManagerModal.tsx
- rules.ts
- serialize.ts
- form.tsx
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- combat/types.ts
- find-dragons.ts
- Hotbar.tsx
- LibraryItemEditorModal
- db.ts
- chart.tsx
- dropdown-menu.tsx
- devDependencies
- advanced-full-text-search.md
- aoe-templates.ts
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- generator.ts
- conn-limits.md
- layout.tsx
- conn-pooling.md
- MonsterManifestEntry
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
- CombatGrid.tsx
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
- navigation-menu.tsx
- open-map-service.ts
- CombatView.tsx
- radio-group.tsx
- RoomLobby.tsx
- CombatGrid
- hover-card.tsx
- validation.ts
- scripts
- proficiencyBonus
- breadcrumb.tsx
- search.ts
- prepare-prisma-for-env.js
- alert.tsx
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
3. `vitest` - 68 edges
4. `Combatant` - 58 edges
5. `lucide-react` - 47 edges
6. `runBotTurn()` - 46 edges
7. `CombatState` - 46 edges
8. `db` - 43 edges
9. `RoomService` - 43 edges
10. `POST()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `resolveStoryModel()`  [EXTRACTED]
  scripts/check-polza-ping.ts → src/lib/ai/models.ts
- `checkAllTables()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/check-supabase-rooms.ts → src/lib/supabase/client.ts
- `main()` --calls--> `createClient()`  [EXTRACTED]
  scripts/consult-dm-prompt.ts → src/lib/ai/client.ts
- `inspectCharactersSchema()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-characters.ts → src/lib/supabase/client.ts
- `inspectData()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-data.ts → src/lib/supabase/client.ts

## Import Cycles
- None detected.

## Communities (148 total, 43 thin omitted)

### Community 0 - "scene-synchronizer.ts"
Cohesion: 0.42
Nodes (7): applyStatusToNotes(), extractJson(), extractStatusFromNotes(), newNpcSchema, SceneUpdate, sceneUpdateSchema, syncSceneState()

### Community 1 - "cn"
Cohesion: 0.06
Nodes (41): cmdk, @radix-ui/react-menubar, react-resizable-panels, CardAction(), CardFooter(), Command(), CommandDialog(), CommandGroup() (+33 more)

### Community 2 - "package.json"
Cohesion: 0.05
Nodes (43): name, private, version, @ai-sdk/openai, @ai-sdk/react, bun-types, clsx, date-fns (+35 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (74): dependencies, ai, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, cmdk, date-fns (+66 more)

### Community 4 - "DnDApp.tsx"
Cohesion: 0.09
Nodes (23): @radix-ui/react-slider, clientWithCustomUrl, cost, customCost, CostStatsModal(), CostStatsModalProps, ArcState, ChatMessage (+15 more)

### Community 5 - "utils.ts"
Cohesion: 0.08
Nodes (29): @radix-ui/react-avatar, @radix-ui/react-progress, AttacksAbilitiesEditor(), save(), COST_OPTIONS, emptyAttack(), KIND_LABELS, Props (+21 more)

### Community 6 - "monster-adapter.ts"
Cohesion: 0.23
Nodes (10): crToProfBonus(), getAttackStem(), MonsterAdapterOptions, monsterDefinitionToCombatant(), parseCountBeforeStem(), parseMultiattack(), safeId(), CombatantType (+2 more)

### Community 7 - "presets/index.ts"
Cohesion: 0.17
Nodes (11): cityStreetPreset, dungeonPrisonPreset, gladiatorArenaPreset, ALL_PRESETS, getPresetByBiome(), PRESETS_BY_BIOME, PRESETS_BY_ID, lavaCavePreset (+3 more)

### Community 8 - "useSupabaseAuth"
Cohesion: 0.13
Nodes (11): @supabase/supabase-js, testAuth(), SupabaseAuthModal(), SupabaseAuthModalProps, CreateRoomModal(), CreateRoomModalProps, RoomLobby(), handleCopyInviteLink() (+3 more)

### Community 9 - "Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)"
Cohesion: 0.15
Nodes (12): 1. Контекст и проблема, 2. Цели и ключевые требования, 3. Архитектура и поток данных, 4.1. `POST /api/room/[code]/turn`, 4.2. `POST /api/room/[code]/turn/resolve`, 4.3. `GET /api/room/[code]/turn`, 4. Спецификация API и сервисов, 5.1. `PartyTurnBar` (`src/components/room/PartyTurnBar.tsx`) (+4 more)

### Community 10 - "import-character.ts"
Cohesion: 0.18
Nodes (16): fetchSharedCharacter(), maxDuration, POST(), ShareFetchError, SHEET_BASE_URL, ABILITY_KEYS, clampLevel(), DerivedMemory (+8 more)

### Community 11 - "createClient"
Cohesion: 0.25
Nodes (11): ai, main(), main(), extractJson(), main(), main(), main(), createClient() (+3 more)

### Community 12 - "accordion.tsx"
Cohesion: 0.33
Nodes (4): @radix-ui/react-accordion, AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 13 - "D20RollModal.tsx"
Cohesion: 0.12
Nodes (31): zustand, CharacterInventoryModalProps, D20RollModal(), executeRoll(), handleAttackRoll(), handleCustomRoll(), handleSaveRoll(), handleSkillRoll() (+23 more)

### Community 14 - "JoinRoomModal.tsx"
Cohesion: 0.31
Nodes (7): JoinRoomModal(), handleSubmit(), JoinRoomModalProps, DND_ROOM_WORDS, generateRoomCode(), isValidRoomCode(), normalizeRoomCode()

### Community 15 - "archetype-solver.ts"
Cohesion: 0.23
Nodes (16): inferBacklineRole(), isFrontlineCandidate(), RANGED_KEYWORDS, resolveArchetype(), solveBossMinions(), solveGreedyFallback(), solvePack(), solveSoloBoss() (+8 more)

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
Nodes (29): class-variance-authority, @radix-ui/react-slot, react, BestiaryBrowser(), BestiaryBrowserProps, CR_OPTIONS, CREATURE_TYPES, BiomeCategory (+21 more)

### Community 20 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 21 - "action/route.ts"
Cohesion: 0.18
Nodes (41): loadState(), POST(), respond(), saveState(), syncCharacterPotionConsumed(), isBotTurn(), applyActionParameters(), applyEffect() (+33 more)

### Community 22 - "movement.ts"
Cohesion: 0.15
Nodes (24): GET(), checkSpellRange(), pullCombatantTowards(), pushCombatantAway(), startTurn(), createMockCombatState(), cellCost(), computeVisibilityStatus() (+16 more)

### Community 23 - "tools.ts"
Cohesion: 0.12
Nodes (20): zod, StoryAct, advanceActTool, campaignContextSchema, characterUpdatesSchema, dmTools, fetchPageTool, formatAct() (+12 more)

### Community 24 - "story-arc.ts"
Cohesion: 0.11
Nodes (31): main(), maxDuration, POST(), GET(), maxDuration, POST(), AuthMode, CompactOptions (+23 more)

### Community 25 - "loot-generator.ts"
Cohesion: 0.15
Nodes (17): BOSS_POTION_ITEM, BOSS_SCROLL_ITEM, CR_TO_XP, generateCombatLoot(), getXpForCr(), parseEnemyCr(), rollDice(), THEMATIC_BIOME_DROPS (+9 more)

### Community 26 - "preset-data.ts"
Cohesion: 0.15
Nodes (14): POST(), GET(), POST(), PresetsModalProps, createMonsterDefinitionFromManifest(), loadDefaultManifest(), loadMonsterDefinition(), CAMPAIGN_HEROES_PRESETS (+6 more)

### Community 27 - "encounter-generator.ts"
Cohesion: 0.25
Nodes (11): mockManifest, EncounterDifficulty, EncounterRequest, GeneratedEncounter, PartyMember, SpawnedEnemy, calculateAwardedXP(), calculatePartyXPBudget() (+3 more)

### Community 28 - "maps/types.ts"
Cohesion: 0.23
Nodes (12): OpenBattlemap, BiomeType, SpawnZoneDefinition, UniversalVTT, UVTTLight, UVTTPoint, UVTTPortal, UVTTResolution (+4 more)

### Community 29 - "alert-dialog.tsx"
Cohesion: 0.09
Nodes (19): @radix-ui/react-alert-dialog, AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay() (+11 more)

### Community 30 - "use-toast.ts"
Cohesion: 0.12
Nodes (25): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle (+17 more)

### Community 31 - "adapter.ts"
Cohesion: 0.07
Nodes (31): GET(), LibraryAbility, LibrarySpell, AbilityItem, AttackItem, SpellItem, SpellDefinitionLike, AbilityDefinition (+23 more)

### Community 32 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 33 - "bot.ts"
Cohesion: 0.16
Nodes (33): CombatantDetails(), alliesOf(), bestAttack(), BotArchetype, BotStep, BotTurnResult, determineFacingTowards(), evaluateTargetScore() (+25 more)

### Community 34 - "RoomService"
Cohesion: 0.15
Nodes (15): verifyMultiplayerRoomFlow(), DELETE(), GET(), GET(), POST(), GET(), POST(), POST() (+7 more)

### Community 35 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 36 - "import-character/route.ts"
Cohesion: 0.26
Nodes (12): ABILITY_RU_TO_EN, DAMAGE_TYPE_RU, detectActionCost(), detectWeapon(), parseBonus(), parseDamageString(), POST(), abilitiesForClass() (+4 more)

### Community 37 - "library-data.ts"
Cohesion: 0.20
Nodes (14): ABILITY_ALIASES, ABILITY_LIBRARY, ATTACK_LIBRARY, getAttackDefinition(), SPELL_LIBRARY, getAllCombatSpells(), getAllSRDSpells(), getAllSRDWeapons() (+6 more)

### Community 38 - "context-menu.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-context-menu, ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut() (+2 more)

### Community 39 - "input-otp.tsx"
Cohesion: 0.33
Nodes (4): input-otp, InputOTP(), InputOTPGroup(), InputOTPSlot()

### Community 40 - "vitest"
Cohesion: 0.13
Nodes (22): vitest, POST(), PartyTurnBarProps, PartyAwareAct1, ResolveActiveRoomTurnOptions, ResolveActiveRoomTurnResult, resolveRoomTurn(), startRoomCampaign() (+14 more)

### Community 41 - "models.ts"
Cohesion: 0.18
Nodes (9): main(), maxDuration, CHEAP_MODEL, DEFAULT_CHEAP_MODEL, DEFAULT_DM_MODEL, DEFAULT_STORY_MODEL, FEATURED_MODELS, FeaturedModelInfo (+1 more)

### Community 42 - "lucide-react"
Cohesion: 0.16
Nodes (16): lucide-react, ImportCharacterModalProps, COMMON_CONDITIONS, DAMAGE_TYPES, EditableLibraryItem, Props, Checkbox(), Label() (+8 more)

### Community 43 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 44 - "TacticalMapPreset"
Cohesion: 0.36
Nodes (4): mapRegistry, MapManifestEntry, MapTagQuery, TacticalMapPreset

### Community 45 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 46 - "spawn-director.ts"
Cohesion: 0.18
Nodes (11): forestAmbushPreset, templePreset, assignTacticalSpawns(), BACKLINE_CLASSES, BOSS_KEYWORDS, createDefaultSpawnZones(), findClosestPassableCell(), inferCombatantRole() (+3 more)

### Community 47 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 48 - "system-prompt.ts"
Cohesion: 0.20
Nodes (14): main(), main(), streamTurn(), StoryArc, buildArcSection(), buildSystemPrompt(), CampaignContext, difficultyDescriptions (+6 more)

### Community 49 - "pacing-director.test.ts"
Cohesion: 0.39
Nodes (6): DMAssistAction, evaluateCombatPacing(), PacingEvaluation, PacingThreatLevel, shouldTriggerEncounterRelief(), createMockState()

### Community 50 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.25
Nodes (7): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), 🗺️ 4. Категорический запрет визуальных заглушек и обязательный VTT-рендеринг (No Visual Stubs & Mandatory Real Battlemap Rendering), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 51 - "Combatant"
Cohesion: 0.09
Nodes (22): WeaponProfile, AttackOutcome, CombatState, toggleDoor(), checkLegendaryResistance(), triggerAILegendaryActions(), applyMoraleFailure(), checkMoraleTrigger() (+14 more)

### Community 52 - "supabase/types.ts"
Cohesion: 0.25
Nodes (7): PartyBond, RoomParticipantRecord, RoomRecord, RoomStatus, RoomTurnRecord, SupabaseCharacterRecord, TurnStatus

### Community 53 - "canonical-biomes.ts"
Cohesion: 0.11
Nodes (17): astralRiftPreset, banditCampPreset, bridgeChasmPreset, CANONICAL_PRESETS_EXTENDED, castleCourtyardPreset, desertDunesPreset, docksHarborPreset, foundryForgePreset (+9 more)

### Community 54 - "CombatView"
Cohesion: 0.20
Nodes (16): CombatView(), addCombatant(), applyMultiSpell(), cancelTargeting(), continueAfterBot(), doAction(), endCombat(), executeOnTarget() (+8 more)

### Community 55 - "monsters/types.ts"
Cohesion: 0.13
Nodes (25): cheerio, DAMAGE_TYPE_MAP, normalizeDamageType(), parseAbilities(), parseAction(), parseCR(), parseDamageTypes(), ParseMeta (+17 more)

### Community 56 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 57 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 58 - "engine.ts"
Cohesion: 0.08
Nodes (22): BEAST_FORMS, BeastForm, getBeastFormById(), addDiceCount(), allyAdjacentTo(), CastContext, CastResult, findSneakAttack() (+14 more)

### Community 59 - "LibraryManagerModal.tsx"
Cohesion: 0.10
Nodes (28): sonner, LibraryCategory, Props, CharacterInventoryModal(), handleAddPotion(), handleDrinkPotion(), createUniqueId(), getSyncTimestamp() (+20 more)

### Community 60 - "rules.ts"
Cohesion: 0.14
Nodes (20): ActionCostCheck, AdvantageResult, applyHealing(), AttackResolution, computeAttackAdvantage(), consumeAttackConditions(), DamageResult, DeathSaveResult (+12 more)

### Community 61 - "serialize.ts"
Cohesion: 0.18
Nodes (18): GET(), getHostPort(), getLanIps(), POST(), TEST_ENEMIES, TestEnemy, GET(), POST() (+10 more)

### Community 62 - "form.tsx"
Cohesion: 0.19
Nodes (12): @radix-ui/react-label, react-hook-form, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext (+4 more)

### Community 63 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.29
Nodes (6): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 64 - "combat/types.ts"
Cohesion: 0.10
Nodes (21): createTestCombatState(), mockBite, mockClaw, createTestCombatState(), mockBite, mockClaw, ABILITY_LABELS, AppliedEffect (+13 more)

### Community 65 - "find-dragons.ts"
Cohesion: 0.40
Nodes (4): dragons, manifest, MANIFEST_PATH, raw

### Community 66 - "Hotbar.tsx"
Cohesion: 0.15
Nodes (11): @radix-ui/react-popover, COST_LABEL, damageSummary(), extractWeaponBase(), Hotbar(), spellSummary(), Popover(), PopoverContent() (+3 more)

### Community 68 - "db.ts"
Cohesion: 0.21
Nodes (8): @prisma/client, isEnemyDefeatedOrFled(), POST(), awardCombatVictoryXP(), AwardCombatXPResult, CR_TO_XP_TABLE, db, globalForPrisma

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

### Community 76 - "generator.ts"
Cohesion: 0.18
Nodes (13): main(), createCombatantStub(), generateEncounter(), createTacticalEncounter(), EnemyInput, EnvironmentType, GeneratedMapElement, generateTacticalMap() (+5 more)

### Community 78 - "layout.tsx"
Cohesion: 0.20
Nodes (7): nextConfig, next, next-themes, geistMono, geistSans, metadata, Toaster()

### Community 80 - "MonsterManifestEntry"
Cohesion: 0.17
Nodes (11): BossMinionsCandidate, PackCandidate, TacticalCandidate, GenerateEncounterOptions, createManifestEntry(), filterMonsters(), COMPENDIUM_DIR, MANIFEST_PATH (+3 more)

### Community 81 - "supabase/client.ts"
Cohesion: 0.12
Nodes (19): checkAllTables(), inspectCharactersSchema(), inspectData(), listCharacters(), listUsers(), GET(), POST(), POST() (+11 more)

### Community 89 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): vaul, DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 105 - "CombatGrid.tsx"
Cohesion: 0.22
Nodes (14): CombatEffectsLayer(), CombatEffectsLayerProps, CombatGridProps, HotbarProps, calculateAttackVector(), CombatEffect, CombatOutcomeType, DamagePopup (+6 more)

### Community 107 - "DnDApp"
Cohesion: 0.10
Nodes (5): DnDApp(), handleGenerateStory(), startArcGeneration(), getMessageError(), getMessageText()

### Community 120 - "navigation-menu.tsx"
Cohesion: 0.20
Nodes (10): @radix-ui/react-navigation-menu, NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger() (+2 more)

### Community 121 - "open-map-service.ts"
Cohesion: 0.35
Nodes (8): GET(), getOpenMapById(), getPopularTags(), OPEN_BATTLEMAP_CATALOG, OpenMapSearchQuery, POPULAR_MAP_TAGS, resolveBattlemapForNarrative(), searchOpenMaps()

### Community 122 - "CombatView.tsx"
Cohesion: 0.10
Nodes (12): CombatEndSummary, CombatViewProps, ELEMENT_TYPES, LOG_ICONS, ImportCharacterModal(), InitiativeTracker(), InitiativeTrackerProps, LibraryManagerModal() (+4 more)

### Community 123 - "radio-group.tsx"
Cohesion: 0.50
Nodes (3): @radix-ui/react-radio-group, RadioGroup(), RadioGroupItem()

### Community 124 - "RoomLobby.tsx"
Cohesion: 0.14
Nodes (19): canSubmitPlayerTurn(), CoopTurnBar(), CoopTurnBarProps, validatePlayerAction(), formatTypingMessage(), LiveTypingIndicator(), LiveTypingIndicatorProps, TypingUser (+11 more)

### Community 125 - "CombatGrid"
Cohesion: 0.24
Nodes (10): CombatGrid(), getCellFromEvent(), handleGlobalMouseMove(), handleGlobalMouseUp(), handleSvgClick(), handleSvgMouseMove(), handleSvgMouseUp(), cellKey() (+2 more)

### Community 127 - "validation.ts"
Cohesion: 0.29
Nodes (8): GET(), CharacterCandidate, EvaluatedCharacter, EvaluatedCharacterList, extractCharacterLevel(), filterUserCharactersForRoom(), LevelValidationResult, validateCharacterForRoom()

### Community 129 - "scripts"
Cohesion: 0.18
Nodes (11): scripts, build, db:generate, db:migrate, db:push, db:reset, dev, lint (+3 more)

### Community 130 - "proficiencyBonus"
Cohesion: 0.25
Nodes (5): POST(), calculateTool, createCharacterTool, updateCharacterTool, proficiencyBonus()

### Community 131 - "breadcrumb.tsx"
Cohesion: 0.25
Nodes (6): BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage(), BreadcrumbSeparator()

### Community 132 - "search.ts"
Cohesion: 0.43
Nodes (6): searchWebTool, decodeDDGUrl(), parseDDGResults(), searchDuckDuckGo(), SearchResult, stripTags()

### Community 133 - "prepare-prisma-for-env.js"
Cohesion: 0.33
Nodes (5): fs, isVercel, path, schema, schemaPath

### Community 134 - "alert.tsx"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 135 - "chat/route.ts"
Cohesion: 0.21
Nodes (13): cleanAssistantNarrative(), maxDuration, POST(), compactHistory(), inFlight, loadSummaries(), VERBATIM_MESSAGES, BOOKKEEPING_TOOLS (+5 more)

### Community 136 - "tailwind.config.ts"
Cohesion: 0.50
Nodes (3): tailwindcss, tailwindcss-animate, config

### Community 140 - "manual-combat-runner.ts"
Cohesion: 0.13
Nodes (28): createHeroes(), ensureDir(), initCombat(), initDragonCombat(), loadSession(), main(), printStatus(), saveState() (+20 more)

### Community 143 - "party-arc-generator.ts"
Cohesion: 0.28
Nodes (11): buildPartyAct1Prompt(), CombatDifficultyConfig, extractJson(), extractPartyRosterFromParticipants(), generatePartyAwareAct1(), getCombatDifficultyConfig(), PartyArcGenerationParams, partyAwareAct1Schema (+3 more)

### Community 145 - "toggle-group.tsx"
Cohesion: 0.31
Nodes (7): @radix-ui/react-toggle, @radix-ui/react-toggle-group, ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 150 - "sidebar.tsx"
Cohesion: 0.05
Nodes (42): @radix-ui/react-dialog, @radix-ui/react-tooltip, Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay() (+34 more)

### Community 153 - "biome-matcher.ts"
Cohesion: 0.22
Nodes (11): BIOME_CONFIGS, BiomeAffinity, entryMatchesKeywords(), getBiomeCandidatePool(), UNIVERSAL_FALLBACK_KEYWORDS, UNIVERSAL_FALLBACK_TYPES, mockManifest, SquadArchetype (+3 more)

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
- **586 isolated node(s):** `supabase`, `$schema`, `style`, `rsc`, `tsx` (+581 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 793 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **43 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `scene-synchronizer.ts`, `package.json`, `utils.ts`, `monster-adapter.ts`, `chat/route.ts`, `presets/index.ts`, `import-character.ts`, `manual-combat-runner.ts`, `D20RollModal.tsx`, `JoinRoomModal.tsx`, `party-arc-generator.ts`, `archetype-solver.ts`, `movement.ts`, `biome-matcher.ts`, `loot-generator.ts`, `encounter-generator.ts`, `maps/types.ts`, `preset-data.ts`, `bot.ts`, `RoomService`, `library-data.ts`, `TacticalMapPreset`, `spawn-director.ts`, `system-prompt.ts`, `pacing-director.test.ts`, `Combatant`, `monsters/types.ts`, `engine.ts`, `LibraryManagerModal.tsx`, `rules.ts`, `serialize.ts`, `combat/types.ts`, `db.ts`, `aoe-templates.ts`, `generator.ts`, `MonsterManifestEntry`, `supabase/client.ts`, `CombatGrid.tsx`, `open-map-service.ts`, `RoomLobby.tsx`, `validation.ts`?**
  _High betweenness centrality (0.121) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `cn`, `package.json`, `breadcrumb.tsx`, `DnDApp.tsx`, `utils.ts`, `alert.tsx`, `useSupabaseAuth`, `switch.tsx`, `accordion.tsx`, `D20RollModal.tsx`, `JoinRoomModal.tsx`, `toggle-group.tsx`, `sidebar.tsx`, `alert-dialog.tsx`, `use-toast.ts`, `context-menu.tsx`, `input-otp.tsx`, `vitest`, `lucide-react`, `carousel.tsx`, `LibraryManagerModal.tsx`, `form.tsx`, `Hotbar.tsx`, `chart.tsx`, `dropdown-menu.tsx`, `drawer.tsx`, `CombatGrid.tsx`, `navigation-menu.tsx`, `CombatView.tsx`, `radio-group.tsx`, `RoomLobby.tsx`, `hover-card.tsx`?**
  _High betweenness centrality (0.107) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `breadcrumb.tsx`, `DnDApp.tsx`, `utils.ts`, `alert.tsx`, `switch.tsx`, `accordion.tsx`, `toggle-group.tsx`, `react`, `sidebar.tsx`, `alert-dialog.tsx`, `use-toast.ts`, `context-menu.tsx`, `input-otp.tsx`, `lucide-react`, `carousel.tsx`, `LibraryManagerModal.tsx`, `form.tsx`, `Hotbar.tsx`, `chart.tsx`, `dropdown-menu.tsx`, `drawer.tsx`, `navigation-menu.tsx`, `radio-group.tsx`, `hover-card.tsx`?**
  _High betweenness centrality (0.095) - this node is a cross-community bridge._
- **What connects `supabase`, `$schema`, `style` to the rest of the system?**
  _586 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.06033182503770739 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.045454545454545456 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.02702702702702703 - nodes in this community are weakly interconnected._