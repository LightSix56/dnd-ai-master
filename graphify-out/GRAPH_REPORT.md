# Graph Report - battle+ai  (2026-09-24)

## Corpus Check
- 3246 files · ~2,020,889 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2185 nodes · 5621 edges · 136 communities (91 shown, 42 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 65 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7d831969`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Hotbar.tsx
- cn
- package.json
- dependencies
- DnDApp
- DnDApp.tsx
- monster-adapter.ts
- vitest
- RoomLobby.tsx
- Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)
- import-character.ts
- createClient
- accordion.tsx
- D20RollModal.tsx
- RoomService
- archetype-solver.ts
- Supabase
- Global Constraints
- AI Dungeon Master — D&D 5e Solo
- CombatView.tsx
- Changelog
- action/route.ts
- movement.ts
- Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness
- story-arc.ts
- loot-generator.ts
- preset-data.ts
- tools.ts
- LibraryManagerModal.tsx
- alert-dialog.tsx
- use-toast.ts
- adapter.ts
- Changelog
- bot.ts
- room-service.ts
- Writing Guidelines for Postgres References
- import-character/route.ts
- library-data.ts
- context-menu.tsx
- compact.ts
- resolve-turn-helper.ts
- models.ts
- react
- compilerOptions
- cost.ts
- Section Definitions
- dice.ts
- components.json
- system-prompt.ts
- pacing-director.test.ts
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- canAct
- supabase/types.ts
- canonical-biomes.ts
- CombatView
- monster-parser-engine.ts
- Supabase Postgres Best Practices
- carousel.tsx
- getSpellDefinition
- CharacterInventoryModal.tsx
- engine.ts
- serialize.ts
- form.tsx
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- combat/types.ts
- AttackKind
- ai
- LibraryItemEditorModal
- db.ts
- chart.tsx
- dropdown-menu.tsx
- devDependencies
- advanced-full-text-search.md
- search.ts
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
- input-otp.tsx
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
- navigation-menu.tsx
- generator.ts
- LibraryManagerModal
- useSupabaseAuth
- hover-card.tsx
- validation.ts
- prepare-prisma-for-env.js
- chat/route.ts
- CombatState
- party-arc-generator.ts
- toggle-group.tsx
- sidebar.tsx
- Global Constraints
- network-banner.js
- Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

## God Nodes (most connected - your core abstractions)
1. `cn()` - 234 edges
2. `react` - 76 edges
3. `vitest` - 72 edges
4. `Combatant` - 58 edges
5. `lucide-react` - 47 edges
6. `runBotTurn()` - 46 edges
7. `CombatState` - 46 edges
8. `db` - 45 edges
9. `RoomService` - 43 edges
10. `POST()` - 39 edges

## Surprising Connections (you probably didn't know these)
- `checkAllTables()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/check-supabase-rooms.ts → src/lib/supabase/client.ts
- `main()` --calls--> `buildSystemPrompt()`  [EXTRACTED]
  scripts/consult-dm-prompt.ts → src/lib/ai/system-prompt.ts
- `main()` --calls--> `resolveStoryModel()`  [EXTRACTED]
  scripts/generate-dragon-story.ts → src/lib/ai/models.ts
- `inspectCharactersSchema()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-characters.ts → src/lib/supabase/client.ts
- `inspectData()` --calls--> `getSupabaseAdminClient()`  [EXTRACTED]
  scripts/inspect-data.ts → src/lib/supabase/client.ts

## Import Cycles
- None detected.

## Communities (136 total, 42 thin omitted)

### Community 0 - "Hotbar.tsx"
Cohesion: 0.09
Nodes (15): @radix-ui/react-popover, AttacksAbilitiesEditor(), save(), COST_OPTIONS, emptyAttack(), KIND_LABELS, rebuildHotbar(), Tab (+7 more)

### Community 1 - "cn"
Cohesion: 0.05
Nodes (50): cmdk, @radix-ui/react-menubar, @radix-ui/react-radio-group, react-resizable-panels, BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList() (+42 more)

### Community 2 - "package.json"
Cohesion: 0.03
Nodes (51): name, private, version, @ai-sdk/openai, @ai-sdk/react, bun-types, clsx, date-fns (+43 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (74): dependencies, ai, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, cmdk, date-fns (+66 more)

### Community 4 - "DnDApp"
Cohesion: 0.09
Nodes (6): DnDApp(), copyRoomLink(), handleGenerateStory(), startArcGeneration(), getMessageError(), getMessageText()

### Community 5 - "DnDApp.tsx"
Cohesion: 0.07
Nodes (32): @radix-ui/react-avatar, CombatEndSummary, abilityMod(), CharacterCard(), getRelationTier(), modStr(), RelationTier, typeColors (+24 more)

### Community 6 - "monster-adapter.ts"
Cohesion: 0.18
Nodes (13): crToProfBonus(), getAttackStem(), MonsterAdapterOptions, monsterDefinitionToCombatant(), parseCountBeforeStem(), parseMultiattack(), safeId(), CombatantType (+5 more)

### Community 7 - "vitest"
Cohesion: 0.09
Nodes (31): vitest, ToggleDoorOutcome, mapRegistry, OpenBattlemap, cityStreetPreset, dungeonPrisonPreset, forestAmbushPreset, gladiatorArenaPreset (+23 more)

### Community 8 - "RoomLobby.tsx"
Cohesion: 0.10
Nodes (20): canSubmitPlayerTurn(), CoopTurnBar(), CoopTurnBarProps, validatePlayerAction(), formatTypingMessage(), LiveTypingIndicator(), LiveTypingIndicatorProps, TypingUser (+12 more)

### Community 9 - "Спецификация: Система совместного пошагового хода отряда (Cooperative Party Turns)"
Cohesion: 0.15
Nodes (12): 1. Контекст и проблема, 2. Цели и ключевые требования, 3. Архитектура и поток данных, 4.1. `POST /api/room/[code]/turn`, 4.2. `POST /api/room/[code]/turn/resolve`, 4.3. `GET /api/room/[code]/turn`, 4. Спецификация API и сервисов, 5.1. `PartyTurnBar` (`src/components/room/PartyTurnBar.tsx`) (+4 more)

### Community 10 - "import-character.ts"
Cohesion: 0.19
Nodes (16): fetchSharedCharacter(), maxDuration, POST(), ShareFetchError, SHEET_BASE_URL, ABILITY_KEYS, clampLevel(), DerivedMemory (+8 more)

### Community 11 - "createClient"
Cohesion: 0.24
Nodes (12): main(), main(), main(), extractJson(), main(), main(), main(), createClient() (+4 more)

### Community 12 - "accordion.tsx"
Cohesion: 0.33
Nodes (4): @radix-ui/react-accordion, AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 13 - "D20RollModal.tsx"
Cohesion: 0.13
Nodes (29): zustand, D20RollModal(), executeRoll(), handleAttackRoll(), handleCustomRoll(), handleSaveRoll(), handleSkillRoll(), D20RollModalProps (+21 more)

### Community 14 - "RoomService"
Cohesion: 0.17
Nodes (12): DELETE(), GET(), POST(), POST(), POST(), GET(), POST(), POST() (+4 more)

### Community 15 - "archetype-solver.ts"
Cohesion: 0.13
Nodes (27): inferBacklineRole(), isFrontlineCandidate(), RANGED_KEYWORDS, resolveArchetype(), solveBossMinions(), solveGreedyFallback(), solvePack(), solveSoloBoss() (+19 more)

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
Nodes (31): @radix-ui/react-slot, BestiaryBrowser(), CombatViewProps, ELEMENT_TYPES, LOG_ICONS, InitiativeTracker(), BiomeCategory, MapPresetsModal() (+23 more)

### Community 20 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 21 - "action/route.ts"
Cohesion: 0.20
Nodes (38): loadState(), POST(), respond(), saveState(), syncCharacterPotionConsumed(), isBotTurn(), applyActionParameters(), applyEffect() (+30 more)

### Community 22 - "movement.ts"
Cohesion: 0.10
Nodes (39): GET(), CombatGrid(), getCellFromEvent(), handleGlobalMouseMove(), handleGlobalMouseUp(), handleSvgClick(), handleSvgMouseMove(), handleSvgMouseUp() (+31 more)

### Community 23 - "Архитектурная спецификация: Оптимизация Prompt Caching по стандартам DeepSeek Harness"
Cohesion: 0.17
Nodes (11): 1.1. Механика работы KV-кэша DeepSeek (Prefix Caching), 1.2. Диагностика текущего состояния `dnd-ai-master` (Cache Hit ~0%), 1. Контекст и проблема, 2. Архитектура: Модульная 3-зонная модель контекста, 3.1. `src/lib/ai/caching/frozen-prefix.ts`, 3.2. `src/lib/ai/caching/ephemeral-tail.ts`, 3.3. `src/lib/ai/caching/milestone-compactor.ts`, 3. Компоненты и интерфейсы (+3 more)

### Community 24 - "story-arc.ts"
Cohesion: 0.12
Nodes (26): main(), maxDuration, POST(), GET(), maxDuration, POST(), actSchema, ArcGenerationParams (+18 more)

### Community 25 - "loot-generator.ts"
Cohesion: 0.12
Nodes (20): @prisma/client, isEnemyDefeatedOrFled(), POST(), BOSS_POTION_ITEM, BOSS_SCROLL_ITEM, CR_TO_XP, generateCombatLoot(), getXpForCr() (+12 more)

### Community 26 - "preset-data.ts"
Cohesion: 0.20
Nodes (9): POST(), PresetsModalProps, CAMPAIGN_HEROES_PRESETS, createCombatantFromPreset(), createPresetFromCombatant(), DEFAULT_PRESETS, getAllSRDMonsters(), getSRDMonster() (+1 more)

### Community 27 - "tools.ts"
Cohesion: 0.14
Nodes (18): advanceActTool, campaignContextSchema, characterUpdatesSchema, dmTools, fetchPageTool, formatAct(), getCharacterTool, getCombatStatusTool (+10 more)

### Community 28 - "LibraryManagerModal.tsx"
Cohesion: 0.14
Nodes (19): sonner, BestiaryBrowserProps, CR_OPTIONS, CREATURE_TYPES, LibraryCategory, calculateBaseStats(), CharacterPickerModal(), handleCreateAndSelect() (+11 more)

### Community 29 - "alert-dialog.tsx"
Cohesion: 0.09
Nodes (20): @radix-ui/react-alert-dialog, react-day-picker, AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader() (+12 more)

### Community 30 - "use-toast.ts"
Cohesion: 0.12
Nodes (25): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle (+17 more)

### Community 31 - "adapter.ts"
Cohesion: 0.09
Nodes (25): LibraryAbility, LibrarySpell, AbilityItem, SpellItem, SpellDefinitionLike, AbilityDefinition, SpellDefinition, allCombatSpellsList (+17 more)

### Community 32 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 33 - "bot.ts"
Cohesion: 0.12
Nodes (36): damageSummary(), extractWeaponBase(), Hotbar(), spellSummary(), alliesOf(), bestAttack(), BotArchetype, BotStep (+28 more)

### Community 34 - "room-service.ts"
Cohesion: 0.13
Nodes (19): POST(), handleSubmit(), PartyAwareAct1, DND_ROOM_WORDS, generateRoomCode(), isValidRoomCode(), normalizeRoomCode(), mapParticipantFromDb() (+11 more)

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

### Community 39 - "compact.ts"
Cohesion: 0.19
Nodes (11): AuthMode, CompactOptions, inFlight, loadSummaries(), VERBATIM_MESSAGES, buildSceneContext(), SceneContext, truncate() (+3 more)

### Community 40 - "resolve-turn-helper.ts"
Cohesion: 0.25
Nodes (12): buildFrozenRoomSystemPrompt(), resolveActiveRoomTurnHelper(), ResolveActiveRoomTurnOptions, ResolveActiveRoomTurnResult, bundleTurnInputs(), BundleTurnOptions, calculateTurnReadiness(), CharacterTurnStatus (+4 more)

### Community 41 - "models.ts"
Cohesion: 0.16
Nodes (10): main(), maxDuration, BOOKKEEPING_TOOLS, CHEAP_MODEL, DEFAULT_CHEAP_MODEL, DEFAULT_DM_MODEL, DEFAULT_STORY_MODEL, FEATURED_MODELS (+2 more)

### Community 42 - "react"
Cohesion: 0.16
Nodes (15): lucide-react, react, ImportCharacterModal(), ImportCharacterModalProps, COMMON_CONDITIONS, DAMAGE_TYPES, Props, Checkbox() (+7 more)

### Community 43 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 44 - "cost.ts"
Cohesion: 0.23
Nodes (11): clientWithCustomUrl, cost, customCost, CostStatsModal(), MessageBubble(), calculateCostRub(), formatRubles(), formatTokens() (+3 more)

### Community 45 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 46 - "dice.ts"
Cohesion: 0.18
Nodes (8): POST(), calculateTool, createCharacterTool, updateCharacterTool, DiceRoll, formatD20Roll(), parseDiceNotation(), proficiencyBonus()

### Community 47 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 48 - "system-prompt.ts"
Cohesion: 0.20
Nodes (15): main(), streamTurn(), buildFrozenSystemPrompt(), sanitizePartyMembers(), StoryArc, buildArcSection(), buildSystemPrompt(), CampaignContext (+7 more)

### Community 49 - "pacing-director.test.ts"
Cohesion: 0.39
Nodes (6): DMAssistAction, evaluateCombatPacing(), PacingEvaluation, PacingThreatLevel, shouldTriggerEncounterRelief(), createMockState()

### Community 50 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.25
Nodes (7): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), 🗺️ 4. Категорический запрет визуальных заглушек и обязательный VTT-рендеринг (No Visual Stubs & Mandatory Real Battlemap Rendering), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 51 - "canAct"
Cohesion: 0.43
Nodes (5): performLegendaryAction(), triggerAILegendaryActions(), canAct(), createTestCombatState(), mockTailAttack

### Community 52 - "supabase/types.ts"
Cohesion: 0.25
Nodes (7): PartyBond, RoomParticipantRecord, RoomRecord, RoomStatus, RoomTurnRecord, SupabaseCharacterRecord, TurnStatus

### Community 53 - "canonical-biomes.ts"
Cohesion: 0.11
Nodes (17): astralRiftPreset, banditCampPreset, bridgeChasmPreset, CANONICAL_PRESETS_EXTENDED, castleCourtyardPreset, desertDunesPreset, docksHarborPreset, foundryForgePreset (+9 more)

### Community 54 - "CombatView"
Cohesion: 0.11
Nodes (27): CombatEffectsLayer(), CombatEffectsLayerProps, CombatGridProps, CombatView(), addCombatant(), applyMultiSpell(), cancelTargeting(), continueAfterBot() (+19 more)

### Community 55 - "monster-parser-engine.ts"
Cohesion: 0.18
Nodes (17): cheerio, DAMAGE_TYPE_MAP, normalizeDamageType(), parseAbilities(), parseAction(), parseCR(), parseDamageTypes(), ParseMeta (+9 more)

### Community 56 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 57 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 59 - "CharacterInventoryModal.tsx"
Cohesion: 0.19
Nodes (13): CharacterInventoryModal(), handleAddPotion(), handleDrinkPotion(), CharacterInventoryModalProps, createUniqueId(), getSyncTimestamp(), InventoryGear, InventoryPotion (+5 more)

### Community 60 - "engine.ts"
Cohesion: 0.10
Nodes (36): CombatantDetails(), addDiceCount(), allyAdjacentTo(), CastResult, findSneakAttack(), MultiattackResult, prepareDamage(), scaleDice() (+28 more)

### Community 61 - "serialize.ts"
Cohesion: 0.20
Nodes (15): GET(), getHostPort(), getLanIps(), POST(), TEST_ENEMIES, TestEnemy, DEFAULT_SPELLS, hydrateCombat() (+7 more)

### Community 62 - "form.tsx"
Cohesion: 0.19
Nodes (12): @radix-ui/react-label, react-hook-form, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext (+4 more)

### Community 63 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.29
Nodes (6): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 64 - "combat/types.ts"
Cohesion: 0.05
Nodes (48): WeaponProfile, Props, InitiativeTrackerProps, Props, RoleSelectorModalProps, WildShapeModalProps, ClassifiedTargets, classifyAoeTargets() (+40 more)

### Community 65 - "AttackKind"
Cohesion: 0.31
Nodes (8): GET(), EditableLibraryItem, AttackItem, AttackDefinition, SRDWeapon, ActionCost, AttackKind, DamageRoll

### Community 66 - "ai"
Cohesion: 0.40
Nodes (8): ai, compactHistoryWithMilestones(), DEFAULT_CHUNK_SIZE, DEFAULT_MAX_VERBATIM, extractExistingChronicleBullets(), extractMessageText(), formatMessageBullet(), MilestoneCompactorOptions

### Community 68 - "db.ts"
Cohesion: 0.20
Nodes (11): POST(), GET(), POST(), GET(), GET(), PATCH(), POST(), GET() (+3 more)

### Community 69 - "chart.tsx"
Cohesion: 0.23
Nodes (10): recharts, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 70 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-dropdown-menu, DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut() (+2 more)

### Community 71 - "devDependencies"
Cohesion: 0.08
Nodes (24): devDependencies, bun-types, cheerio, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tw-animate-css (+16 more)

### Community 73 - "search.ts"
Cohesion: 0.43
Nodes (6): searchWebTool, decodeDDGUrl(), parseDDGResults(), searchDuckDuckGo(), SearchResult, stripTags()

### Community 76 - "encounter-generator.ts"
Cohesion: 0.13
Nodes (22): main(), GET(), POST(), GET(), POST(), createCombatantStub(), createMonsterDefinitionFromManifest(), generateEncounter() (+14 more)

### Community 78 - "layout.tsx"
Cohesion: 0.20
Nodes (7): nextConfig, next, next-themes, geistMono, geistSans, metadata, Toaster()

### Community 80 - "monsters/types.ts"
Cohesion: 0.08
Nodes (34): dragons, manifest, MANIFEST_PATH, raw, BossMinionsCandidate, PackCandidate, TacticalCandidate, BIOME_CONFIGS (+26 more)

### Community 81 - "supabase/client.ts"
Cohesion: 0.16
Nodes (11): @supabase/supabase-js, checkAllTables(), inspectCharactersSchema(), inspectData(), listCharacters(), listUsers(), verifyMultiplayerRoomFlow(), GET() (+3 more)

### Community 89 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): vaul, DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 104 - "input-otp.tsx"
Cohesion: 0.33
Nodes (4): input-otp, InputOTP(), InputOTPGroup(), InputOTPSlot()

### Community 105 - "Global Constraints"
Cohesion: 0.25
Nodes (7): Global Constraints, Prompt Caching Architecture (DeepSeek Harness Parity) Implementation Plan, Task 1: Core Caching Utilities — `frozen-prefix.ts` and `ephemeral-tail.ts`, Task 2: Discrete Milestone History Compactor — `milestone-compactor.ts`, Task 3: Integration into Solo Chat Endpoint (`src/app/api/chat/route.ts`), Task 4: Integration into Multiplayer Co-op Turn Helper (`src/lib/room/resolve-turn-helper.ts`), Task 5: End-to-End Verification & Cost Calculation Audit

### Community 120 - "navigation-menu.tsx"
Cohesion: 0.20
Nodes (10): @radix-ui/react-navigation-menu, NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger() (+2 more)

### Community 121 - "generator.ts"
Cohesion: 0.14
Nodes (19): GET(), GeneratedEncounter, createTacticalEncounter(), EnemyInput, EnvironmentType, GeneratedMapElement, generateTacticalMap(), resolveEnemyAttacks() (+11 more)

### Community 124 - "useSupabaseAuth"
Cohesion: 0.23
Nodes (8): testAuth(), SupabaseAuthModal(), SupabaseAuthModalProps, CreateRoomModal(), CreateRoomModalProps, useRoomRealtime(), useSupabaseAuth(), getSupabaseBrowserClient()

### Community 127 - "validation.ts"
Cohesion: 0.29
Nodes (8): GET(), CharacterCandidate, EvaluatedCharacter, EvaluatedCharacterList, extractCharacterLevel(), filterUserCharactersForRoom(), LevelValidationResult, validateCharacterForRoom()

### Community 133 - "prepare-prisma-for-env.js"
Cohesion: 0.33
Nodes (5): fs, isVercel, path, schema, schemaPath

### Community 135 - "chat/route.ts"
Cohesion: 0.13
Nodes (23): cleanAssistantNarrative(), maxDuration, POST(), { mockStreamText }, buildEphemeralSceneTail, EphemeralNpcState, EphemeralPartyMemberState, EphemeralRecentEvent (+15 more)

### Community 140 - "CombatState"
Cohesion: 0.09
Nodes (34): createHeroes(), ensureDir(), initCombat(), initDragonCombat(), loadSession(), main(), printStatus(), saveState() (+26 more)

### Community 143 - "party-arc-generator.ts"
Cohesion: 0.25
Nodes (12): zod, buildPartyAct1Prompt(), CombatDifficultyConfig, extractJson(), extractPartyRosterFromParticipants(), generatePartyAwareAct1(), getCombatDifficultyConfig(), PartyArcGenerationParams (+4 more)

### Community 145 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (12): class-variance-authority, @radix-ui/react-toggle, @radix-ui/react-toggle-group, Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup() (+4 more)

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
- **606 isolated node(s):** `supabase`, `$schema`, `style`, `rsc`, `tsx` (+601 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 815 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `package.json`, `DnDApp.tsx`, `monster-adapter.ts`, `chat/route.ts`, `RoomLobby.tsx`, `CombatState`, `D20RollModal.tsx`, `RoomService`, `party-arc-generator.ts`, `archetype-solver.ts`, `movement.ts`, `loot-generator.ts`, `preset-data.ts`, `LibraryManagerModal.tsx`, `bot.ts`, `room-service.ts`, `library-data.ts`, `resolve-turn-helper.ts`, `system-prompt.ts`, `pacing-director.test.ts`, `canAct`, `CombatView`, `monster-parser-engine.ts`, `getSpellDefinition`, `engine.ts`, `serialize.ts`, `combat/types.ts`, `ai`, `db.ts`, `encounter-generator.ts`, `monsters/types.ts`, `supabase/client.ts`, `generator.ts`, `validation.ts`?**
  _High betweenness centrality (0.140) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `Hotbar.tsx`, `package.json`, `DnDApp.tsx`, `accordion.tsx`, `toggle-group.tsx`, `CombatView.tsx`, `sidebar.tsx`, `LibraryManagerModal.tsx`, `alert-dialog.tsx`, `use-toast.ts`, `context-menu.tsx`, `react`, `carousel.tsx`, `CharacterInventoryModal.tsx`, `form.tsx`, `chart.tsx`, `dropdown-menu.tsx`, `drawer.tsx`, `input-otp.tsx`, `navigation-menu.tsx`, `hover-card.tsx`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `Hotbar.tsx`, `cn`, `package.json`, `DnDApp.tsx`, `RoomLobby.tsx`, `accordion.tsx`, `D20RollModal.tsx`, `toggle-group.tsx`, `CombatView.tsx`, `movement.ts`, `sidebar.tsx`, `LibraryManagerModal.tsx`, `alert-dialog.tsx`, `use-toast.ts`, `context-menu.tsx`, `CombatView`, `carousel.tsx`, `CharacterInventoryModal.tsx`, `form.tsx`, `chart.tsx`, `dropdown-menu.tsx`, `drawer.tsx`, `input-otp.tsx`, `navigation-menu.tsx`, `useSupabaseAuth`, `hover-card.tsx`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **What connects `supabase`, `$schema`, `style` to the rest of the system?**
  _606 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Hotbar.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09259259259259259 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.0496031746031746 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.03389830508474576 - nodes in this community are weakly interconnected._