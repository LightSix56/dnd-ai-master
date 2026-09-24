# Graph Report - battle+ai  (2026-09-24)

## Corpus Check
- 3228 files · ~2,005,733 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2128 nodes · 5391 edges · 139 communities (91 shown, 45 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 66 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `55acf15b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- encounter-generator.ts
- cn
- package.json
- dependencies
- engine.ts
- DnDApp.tsx
- aoe-templates.ts
- presets/index.ts
- MonsterManifestEntry
- react
- tools.ts
- createClient
- AttacksAbilitiesEditor.tsx
- D20RollModal.tsx
- code-gen.ts
- archetype-solver.ts
- Supabase
- menubar.tsx
- AI Dungeon Master — D&D 5e Solo
- CombatView.tsx
- Changelog
- action/route.ts
- movement.ts
- context-menu.tsx
- story-arc.ts
- loot-generator.ts
- useSupabaseAuth
- Hotbar.tsx
- maps/types.ts
- alert-dialog.tsx
- use-toast.ts
- library-data.ts
- Changelog
- bot.ts
- room-service.ts
- Writing Guidelines for Postgres References
- import-character/route.ts
- scene-synchronizer.ts
- dice.ts
- generator.ts
- dnd-icons.tsx
- navigation-menu.tsx
- import-character.ts
- compilerOptions
- TacticalMapPreset
- Section Definitions
- spawn-director.ts
- components.json
- system-prompt.ts
- pacing-director.test.ts
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- RoomLobby
- supabase/types.ts
- canonical-biomes.ts
- CombatGrid.tsx
- monsters/types.ts
- Supabase Postgres Best Practices
- carousel.tsx
- accordion.tsx
- Combatant
- rules.ts
- combat/types.ts
- form.tsx
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- grid.ts
- hover-card.tsx
- radio-group.tsx
- start-campaign/route.ts
- vitest
- chart.tsx
- ImportCharacterModal
- devDependencies
- advanced-full-text-search.md
- scripts
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- monster-adapter.ts
- conn-limits.md
- layout.tsx
- conn-pooling.md
- resolve/route.ts
- supabase/client.ts
- conn-prepared-statements.md
- data-batch-inserts.md
- @supabase/ssr
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- collapsible.tsx
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
- @radix-ui/react-aspect-ratio
- tailwind.config.ts
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
- open-map-service.ts
- CharacterPickerModal.tsx
- chat/route.ts
- RoomLobby.tsx
- manual-combat-runner.ts
- dropdown-menu.tsx
- party-arc-generator.ts
- toggle-group.tsx
- models.ts
- preset-data.ts
- sidebar.tsx
- drawer.tsx
- encounters/types.ts
- Global Constraints
- network-banner.js
- LibraryManagerModal.tsx
- Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

## God Nodes (most connected - your core abstractions)
1. `cn()` - 232 edges
2. `react` - 74 edges
3. `vitest` - 65 edges
4. `Combatant` - 58 edges
5. `runBotTurn()` - 46 edges
6. `CombatState` - 46 edges
7. `lucide-react` - 45 edges
8. `db` - 41 edges
9. `POST()` - 39 edges
10. `RoomService` - 39 edges

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

## Communities (139 total, 45 thin omitted)

### Community 0 - "encounter-generator.ts"
Cohesion: 0.29
Nodes (8): main(), createCombatantStub(), generateEncounter(), mockManifest, EncounterRequest, PartyMember, calculateAwardedXP(), calculatePartyXPBudget()

### Community 1 - "cn"
Cohesion: 0.06
Nodes (45): cmdk, input-otp, @radix-ui/react-avatar, @radix-ui/react-switch, react-resizable-panels, Avatar(), AvatarFallback(), AvatarImage() (+37 more)

### Community 2 - "package.json"
Cohesion: 0.04
Nodes (45): name, private, version, @ai-sdk/openai, @ai-sdk/react, bun-types, clsx, date-fns (+37 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (74): dependencies, ai, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, cmdk, date-fns (+66 more)

### Community 4 - "engine.ts"
Cohesion: 0.12
Nodes (24): addDiceCount(), allyAdjacentTo(), applyActionParameters(), CastContext, CastResult, findSneakAttack(), MoveOutcome, MultiattackResult (+16 more)

### Community 5 - "DnDApp.tsx"
Cohesion: 0.10
Nodes (15): CostStatsModal(), ArcState, ChatMessage, emptySubscribe(), formatInline(), MarkdownRenderer(), MessageBubble(), StoryAct (+7 more)

### Community 6 - "aoe-templates.ts"
Cohesion: 0.27
Nodes (11): ClassifiedTargets, classifyAoeTargets(), DIRECTION_STEPS, DirStep, getConeCells(), getCubeCells(), getLineCells(), getSphereCells() (+3 more)

### Community 7 - "presets/index.ts"
Cohesion: 0.16
Nodes (13): OpenBattlemap, cityStreetPreset, dungeonPrisonPreset, gladiatorArenaPreset, ALL_PRESETS, getPresetByBiome(), getPresetById(), PRESETS_BY_BIOME (+5 more)

### Community 8 - "MonsterManifestEntry"
Cohesion: 0.12
Nodes (16): dragons, manifest, MANIFEST_PATH, raw, BossMinionsCandidate, PackCandidate, TacticalCandidate, GenerateEncounterOptions (+8 more)

### Community 9 - "react"
Cohesion: 0.14
Nodes (19): lucide-react, @radix-ui/react-slot, react, ImportCharacterModalProps, COMMON_CONDITIONS, DAMAGE_TYPES, Props, RoleSelectorModal() (+11 more)

### Community 10 - "tools.ts"
Cohesion: 0.12
Nodes (23): advanceActTool, campaignContextSchema, characterUpdatesSchema, dmTools, fetchPageTool, formatAct(), getCharacterTool, getCombatStatusTool (+15 more)

### Community 11 - "createClient"
Cohesion: 0.18
Nodes (14): ai, main(), extractJson(), main(), main(), main(), clientWithCustomUrl, cost (+6 more)

### Community 12 - "AttacksAbilitiesEditor.tsx"
Cohesion: 0.10
Nodes (22): AttacksAbilitiesEditor(), save(), COST_OPTIONS, emptyAttack(), KIND_LABELS, Props, rebuildHotbar(), Tab (+14 more)

### Community 13 - "D20RollModal.tsx"
Cohesion: 0.13
Nodes (29): zustand, D20RollModal(), executeRoll(), handleAttackRoll(), handleCustomRoll(), handleSaveRoll(), handleSkillRoll(), D20RollModalProps (+21 more)

### Community 14 - "code-gen.ts"
Cohesion: 0.53
Nodes (4): DND_ROOM_WORDS, generateRoomCode(), isValidRoomCode(), normalizeRoomCode()

### Community 15 - "archetype-solver.ts"
Cohesion: 0.21
Nodes (17): inferBacklineRole(), isFrontlineCandidate(), RANGED_KEYWORDS, resolveArchetype(), solveBossMinions(), solveGreedyFallback(), solvePack(), solveSoloBoss() (+9 more)

### Community 16 - "Supabase"
Cohesion: 0.11
Nodes (15): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Debugging, Making and Committing Schema Changes (+7 more)

### Community 17 - "menubar.tsx"
Cohesion: 0.11
Nodes (12): @radix-ui/react-menubar, Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarRadioItem(), MenubarSeparator() (+4 more)

### Community 18 - "AI Dungeon Master — D&D 5e Solo"
Cohesion: 0.06
Nodes (34): AI Dungeon Master — D&D 5e Solo, AI забывает персонажей, API-ключ не работает, "Cannot find module 'xxx'", "Database is readonly" / "SQLite error", "Port 3000 is already in use", Быстрые кнопки, Ввод ключа в приложении (+26 more)

### Community 19 - "CombatView.tsx"
Cohesion: 0.09
Nodes (37): sonner, BestiaryBrowser(), BestiaryBrowserProps, CR_OPTIONS, CREATURE_TYPES, CombatEndSummary, CombatViewProps, ELEMENT_TYPES (+29 more)

### Community 20 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 21 - "action/route.ts"
Cohesion: 0.19
Nodes (34): loadState(), POST(), respond(), saveState(), syncCharacterPotionConsumed(), isBotTurn(), applyEffect(), assertTurn() (+26 more)

### Community 22 - "movement.ts"
Cohesion: 0.15
Nodes (24): GET(), hostilesOf(), isPerceivableByBot(), checkSpellRange(), createMockCombatState(), cellCost(), computeVisibilityStatus(), coversCell() (+16 more)

### Community 23 - "context-menu.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-context-menu, ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut() (+2 more)

### Community 24 - "story-arc.ts"
Cohesion: 0.13
Nodes (27): main(), maxDuration, POST(), GET(), maxDuration, POST(), resolveStoryModel(), actSchema (+19 more)

### Community 25 - "loot-generator.ts"
Cohesion: 0.15
Nodes (17): BOSS_POTION_ITEM, BOSS_SCROLL_ITEM, CR_TO_XP, generateCombatLoot(), getXpForCr(), parseEnemyCr(), rollDice(), THEMATIC_BIOME_DROPS (+9 more)

### Community 26 - "useSupabaseAuth"
Cohesion: 0.21
Nodes (9): @supabase/supabase-js, testAuth(), SupabaseAuthModal(), SupabaseAuthModalProps, CreateRoomModal(), CreateRoomModalProps, useRoomRealtime(), useSupabaseAuth() (+1 more)

### Community 27 - "Hotbar.tsx"
Cohesion: 0.16
Nodes (10): @radix-ui/react-popover, COST_LABEL, damageSummary(), extractWeaponBase(), Hotbar(), spellSummary(), Popover(), PopoverContent() (+2 more)

### Community 28 - "maps/types.ts"
Cohesion: 0.22
Nodes (12): BiomeType, SpawnZoneDefinition, UniversalVTT, UVTTLight, UVTTPoint, UVTTPortal, UVTTResolution, computeSpawnZones() (+4 more)

### Community 29 - "alert-dialog.tsx"
Cohesion: 0.09
Nodes (19): @radix-ui/react-alert-dialog, AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay() (+11 more)

### Community 30 - "use-toast.ts"
Cohesion: 0.12
Nodes (25): @radix-ui/react-toast, Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle (+17 more)

### Community 31 - "library-data.ts"
Cohesion: 0.08
Nodes (45): LibraryAbility, LibrarySpell, EditableLibraryItem, AbilityItem, AttackItem, SpellItem, SpellDefinitionLike, ABILITY_ALIASES (+37 more)

### Community 32 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 33 - "bot.ts"
Cohesion: 0.14
Nodes (35): CombatantDetails(), alliesOf(), bestAttack(), BotArchetype, BotStep, BotTurnResult, determineFacingTowards(), evaluateTargetScore() (+27 more)

### Community 34 - "room-service.ts"
Cohesion: 0.14
Nodes (18): verifyMultiplayerRoomFlow(), DELETE(), GET(), GET(), PartyAwareAct1, mapParticipantFromDb(), mapRoomFromDb(), resolveRoomTurn() (+10 more)

### Community 35 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 36 - "import-character/route.ts"
Cohesion: 0.24
Nodes (12): ABILITY_RU_TO_EN, DAMAGE_TYPE_RU, detectActionCost(), detectWeapon(), parseBonus(), parseDamageString(), POST(), WeaponProfile (+4 more)

### Community 37 - "scene-synchronizer.ts"
Cohesion: 0.21
Nodes (13): zod, AuthMode, CompactOptions, applyStatusToNotes(), extractJson(), extractStatusFromNotes(), newNpcSchema, SceneUpdate (+5 more)

### Community 38 - "dice.ts"
Cohesion: 0.20
Nodes (7): POST(), calculateTool, createCharacterTool, updateCharacterTool, DiceRoll, parseDiceNotation(), proficiencyBonus()

### Community 39 - "generator.ts"
Cohesion: 0.24
Nodes (11): startCombatTool, createTacticalEncounter(), EnemyInput, EnvironmentType, GeneratedMapElement, generateTacticalMap(), resolveEnemyAttacks(), TacticalEncounterResult (+3 more)

### Community 40 - "dnd-icons.tsx"
Cohesion: 0.05
Nodes (3): D20Icon(), IconProps, RunedKeyIcon()

### Community 41 - "navigation-menu.tsx"
Cohesion: 0.20
Nodes (10): @radix-ui/react-navigation-menu, NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger() (+2 more)

### Community 42 - "import-character.ts"
Cohesion: 0.19
Nodes (16): fetchSharedCharacter(), maxDuration, POST(), ShareFetchError, SHEET_BASE_URL, ABILITY_KEYS, clampLevel(), DerivedMemory (+8 more)

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
Cohesion: 0.19
Nodes (15): main(), main(), streamTurn(), main(), StoryArc, buildArcSection(), buildSystemPrompt(), CampaignContext (+7 more)

### Community 49 - "pacing-director.test.ts"
Cohesion: 0.39
Nodes (6): DMAssistAction, evaluateCombatPacing(), PacingEvaluation, PacingThreatLevel, shouldTriggerEncounterRelief(), createMockState()

### Community 50 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.25
Nodes (7): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), 🗺️ 4. Категорический запрет визуальных заглушек и обязательный VTT-рендеринг (No Visual Stubs & Mandatory Real Battlemap Rendering), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 52 - "supabase/types.ts"
Cohesion: 0.25
Nodes (7): PartyBond, RoomParticipantRecord, RoomRecord, RoomStatus, RoomTurnRecord, SupabaseCharacterRecord, TurnStatus

### Community 53 - "canonical-biomes.ts"
Cohesion: 0.11
Nodes (17): astralRiftPreset, banditCampPreset, bridgeChasmPreset, CANONICAL_PRESETS_EXTENDED, castleCourtyardPreset, desertDunesPreset, docksHarborPreset, foundryForgePreset (+9 more)

### Community 54 - "CombatGrid.tsx"
Cohesion: 0.07
Nodes (40): CombatEffectsLayer(), CombatEffectsLayerProps, CombatGrid(), getCellFromEvent(), handleGlobalMouseMove(), handleGlobalMouseUp(), handleSvgClick(), handleSvgMouseMove() (+32 more)

### Community 55 - "monsters/types.ts"
Cohesion: 0.13
Nodes (25): cheerio, DAMAGE_TYPE_MAP, normalizeDamageType(), parseAbilities(), parseAction(), parseCR(), parseDamageTypes(), ParseMeta (+17 more)

### Community 56 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 57 - "carousel.tsx"
Cohesion: 0.17
Nodes (14): embla-carousel-react, Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext() (+6 more)

### Community 58 - "accordion.tsx"
Cohesion: 0.33
Nodes (4): @radix-ui/react-accordion, AccordionContent(), AccordionItem(), AccordionTrigger()

### Community 59 - "Combatant"
Cohesion: 0.08
Nodes (28): BEAST_FORMS, BeastForm, getBeastFormById(), AttackOutcome, CombatState, checkLegendaryResistance(), performLegendaryAction(), triggerAILegendaryActions() (+20 more)

### Community 60 - "rules.ts"
Cohesion: 0.14
Nodes (23): ActionCostCheck, AdvantageResult, applyDamage(), applyHealing(), AttackResolution, computeAttackAdvantage(), DamageResult, DeathSaveResult (+15 more)

### Community 61 - "combat/types.ts"
Cohesion: 0.11
Nodes (25): POST(), TEST_ENEMIES, TestEnemy, GET(), POST(), GET(), DEFAULT_SPELLS, hydrateCombat() (+17 more)

### Community 62 - "form.tsx"
Cohesion: 0.19
Nodes (12): @radix-ui/react-label, react-hook-form, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext (+4 more)

### Community 63 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.29
Nodes (6): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 66 - "radio-group.tsx"
Cohesion: 0.50
Nodes (3): @radix-ui/react-radio-group, RadioGroup(), RadioGroupItem()

### Community 68 - "vitest"
Cohesion: 0.10
Nodes (12): @prisma/client, vitest, GET(), getHostPort(), getLanIps(), isEnemyDefeatedOrFled(), POST(), awardCombatVictoryXP() (+4 more)

### Community 69 - "chart.tsx"
Cohesion: 0.23
Nodes (10): recharts, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload() (+2 more)

### Community 71 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, bun-types, cheerio, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tw-animate-css (+5 more)

### Community 73 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, db:generate, db:migrate, db:push, db:reset, dev, lint (+2 more)

### Community 76 - "monster-adapter.ts"
Cohesion: 0.18
Nodes (14): crToProfBonus(), getAttackStem(), MonsterAdapterOptions, monsterDefinitionToCombatant(), parseCountBeforeStem(), parseMultiattack(), safeId(), CombatantType (+6 more)

### Community 78 - "layout.tsx"
Cohesion: 0.20
Nodes (7): nextConfig, next, next-themes, geistMono, geistSans, metadata, Toaster()

### Community 80 - "resolve/route.ts"
Cohesion: 0.19
Nodes (11): POST(), GET(), POST(), getActiveTurn(), mapTurnFromDb(), bundleTurnInputs(), BundleTurnOptions, calculateTurnReadiness() (+3 more)

### Community 81 - "supabase/client.ts"
Cohesion: 0.17
Nodes (13): checkAllTables(), inspectCharactersSchema(), inspectData(), listCharacters(), listUsers(), GET(), POST(), POST() (+5 more)

### Community 105 - "tailwind.config.ts"
Cohesion: 0.50
Nodes (3): tailwindcss, tailwindcss-animate, config

### Community 107 - "DnDApp"
Cohesion: 0.08
Nodes (9): DnDApp(), copyRoomLink(), deleteCampaign(), handleGenerateStory(), loadCampaignsList(), startArcGeneration(), getMessageError(), getMessageText() (+1 more)

### Community 121 - "open-map-service.ts"
Cohesion: 0.35
Nodes (8): GET(), getOpenMapById(), getPopularTags(), OPEN_BATTLEMAP_CATALOG, OpenMapSearchQuery, POPULAR_MAP_TAGS, resolveBattlemapForNarrative(), searchOpenMaps()

### Community 127 - "CharacterPickerModal.tsx"
Cohesion: 0.18
Nodes (12): GET(), CharacterPickerModal(), CharacterPickerModalProps, formatCharacterCardForPicker(), FormattedCharacterCard, CharacterCandidate, EvaluatedCharacter, EvaluatedCharacterList (+4 more)

### Community 135 - "chat/route.ts"
Cohesion: 0.22
Nodes (13): cleanAssistantNarrative(), maxDuration, POST(), compactHistory(), inFlight, loadSummaries(), VERBATIM_MESSAGES, calculateCostRub() (+5 more)

### Community 137 - "RoomLobby.tsx"
Cohesion: 0.15
Nodes (19): canSubmitPlayerTurn(), CoopTurnBar(), CoopTurnBarProps, validatePlayerAction(), formatTypingMessage(), LiveTypingIndicator(), LiveTypingIndicatorProps, TypingUser (+11 more)

### Community 140 - "manual-combat-runner.ts"
Cohesion: 0.14
Nodes (27): createHeroes(), ensureDir(), initCombat(), initDragonCombat(), loadSession(), main(), printStatus(), saveState() (+19 more)

### Community 141 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (10): @radix-ui/react-dropdown-menu, DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut() (+2 more)

### Community 143 - "party-arc-generator.ts"
Cohesion: 0.26
Nodes (11): buildPartyAct1Prompt(), CombatDifficultyConfig, extractJson(), extractPartyRosterFromParticipants(), generatePartyAwareAct1(), getCombatDifficultyConfig(), PartyArcGenerationParams, partyAwareAct1Schema (+3 more)

### Community 145 - "toggle-group.tsx"
Cohesion: 0.18
Nodes (12): class-variance-authority, @radix-ui/react-toggle, @radix-ui/react-toggle-group, Alert(), AlertDescription(), AlertTitle(), alertVariants, ToggleGroup() (+4 more)

### Community 147 - "models.ts"
Cohesion: 0.16
Nodes (10): main(), maxDuration, BOOKKEEPING_TOOLS, CHEAP_MODEL, DEFAULT_CHEAP_MODEL, DEFAULT_DM_MODEL, DEFAULT_STORY_MODEL, FEATURED_MODELS (+2 more)

### Community 148 - "preset-data.ts"
Cohesion: 0.15
Nodes (14): POST(), GET(), POST(), PresetsModalProps, createMonsterDefinitionFromManifest(), loadDefaultManifest(), loadMonsterDefinition(), CAMPAIGN_HEROES_PRESETS (+6 more)

### Community 150 - "sidebar.tsx"
Cohesion: 0.05
Nodes (42): @radix-ui/react-dialog, @radix-ui/react-tooltip, Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay() (+34 more)

### Community 152 - "drawer.tsx"
Cohesion: 0.17
Nodes (7): vaul, DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 153 - "encounters/types.ts"
Cohesion: 0.16
Nodes (15): BIOME_CONFIGS, BiomeAffinity, entryMatchesKeywords(), getBiomeCandidatePool(), UNIVERSAL_FALLBACK_KEYWORDS, UNIVERSAL_FALLBACK_TYPES, mockManifest, GeneratedEncounter (+7 more)

### Community 154 - "Global Constraints"
Cohesion: 0.29
Nodes (6): Global Constraints, Task 1: Backend Data Model & Combat Engine Potion Support, Task 2: Combat Hotbar & CombatView UI Integration, Task 3: Campaign Character Card & Inventory Modal, Task 4: Full Verification, Graphify & Git Delivery, Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою — Implementation Plan

### Community 158 - "network-banner.js"
Cohesion: 0.33
Nodes (5): interfaces, localIps, os, otherIps, radminIps

### Community 159 - "LibraryManagerModal.tsx"
Cohesion: 0.09
Nodes (20): LibraryCategory, LibraryItemEditorModal(), LibraryManagerModal(), Props, CharacterInventoryModal(), handleAddPotion(), handleDrinkPotion(), CharacterInventoryModalProps (+12 more)

### Community 160 - "Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою"
Cohesion: 0.50
Nodes (3): 1. Цель, 2. Глобальные ограничения, Спецификация: Инвентарь, Зелья и Расходники в ИИ-Мастере и Тактическом Бою

## Knowledge Gaps
- **563 isolated node(s):** `supabase`, `$schema`, `style`, `rsc`, `tsx` (+558 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 812 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `react` to `cn`, `package.json`, `DnDApp.tsx`, `RoomLobby.tsx`, `AttacksAbilitiesEditor.tsx`, `D20RollModal.tsx`, `dropdown-menu.tsx`, `toggle-group.tsx`, `menubar.tsx`, `CombatView.tsx`, `sidebar.tsx`, `context-menu.tsx`, `drawer.tsx`, `useSupabaseAuth`, `Hotbar.tsx`, `alert-dialog.tsx`, `use-toast.ts`, `LibraryManagerModal.tsx`, `dnd-icons.tsx`, `navigation-menu.tsx`, `CombatGrid.tsx`, `carousel.tsx`, `accordion.tsx`, `form.tsx`, `hover-card.tsx`, `radio-group.tsx`, `chart.tsx`, `CharacterPickerModal.tsx`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **Why does `vitest` connect `vitest` to `encounter-generator.ts`, `package.json`, `engine.ts`, `aoe-templates.ts`, `chat/route.ts`, `presets/index.ts`, `RoomLobby.tsx`, `MonsterManifestEntry`, `react`, `manual-combat-runner.ts`, `D20RollModal.tsx`, `code-gen.ts`, `party-arc-generator.ts`, `archetype-solver.ts`, `preset-data.ts`, `action/route.ts`, `movement.ts`, `encounters/types.ts`, `loot-generator.ts`, `maps/types.ts`, `library-data.ts`, `bot.ts`, `room-service.ts`, `scene-synchronizer.ts`, `TacticalMapPreset`, `spawn-director.ts`, `system-prompt.ts`, `pacing-director.test.ts`, `CombatGrid.tsx`, `monsters/types.ts`, `Combatant`, `rules.ts`, `combat/types.ts`, `start-campaign/route.ts`, `monster-adapter.ts`, `resolve/route.ts`, `supabase/client.ts`, `open-map-service.ts`, `CharacterPickerModal.tsx`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `DnDApp.tsx`, `react`, `AttacksAbilitiesEditor.tsx`, `dropdown-menu.tsx`, `toggle-group.tsx`, `menubar.tsx`, `CombatView.tsx`, `sidebar.tsx`, `context-menu.tsx`, `drawer.tsx`, `Hotbar.tsx`, `alert-dialog.tsx`, `use-toast.ts`, `LibraryManagerModal.tsx`, `navigation-menu.tsx`, `carousel.tsx`, `accordion.tsx`, `form.tsx`, `hover-card.tsx`, `radio-group.tsx`, `chart.tsx`?**
  _High betweenness centrality (0.082) - this node is a cross-community bridge._
- **What connects `supabase`, `$schema`, `style` to the rest of the system?**
  _563 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.05584415584415584 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.043478260869565216 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.02702702702702703 - nodes in this community are weakly interconnected._