# Graph Report - battle+ai  (2026-09-21)

## Corpus Check
- 6162 files · ~3,463,222 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3055 nodes · 7390 edges · 136 communities (111 shown, 18 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 19 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `27822e4b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cn
- BATTLE/src/lib/combat/engine.ts
- package.json
- dependencies
- BATTLE/package.json
- d20-helper.ts
- BATTLE/src/app/api/combat/action/route.ts
- dependencies
- cn
- BATTLE/src/components/ui/menubar.tsx
- tools.ts
- BATTLE/src/lib/combat/library-data.ts
- chat/route.ts
- DnDApp.tsx
- BATTLE/src/components/combat/ImportCharacterModal.tsx
- BATTLE/src/lib/combat/serialize.ts
- src/lib/utils.ts
- BATTLE/src/lib/combat/bot.ts
- AI Dungeon Master — D&D 5e Solo
- src/components/combat/CombatView.tsx
- BATTLE/src/hooks/use-toast.ts
- src/app/api/combat/action/route.ts
- CombatGrid
- Боевой движок D&D 5e — Автономный
- story-arc.ts
- src/lib/combat/types.ts
- BATTLE/src/lib/combat/movement.ts
- src/lib/combat/engine.ts
- BATTLE/src/lib/combat/rules.ts
- src/components/ui/alert-dialog.tsx
- src/hooks/use-toast.ts
- src/lib/combat/library-data.ts
- BATTLE/src/components/ui/alert-dialog.tsx
- src/lib/combat/bot.ts
- BATTLE/src/components/combat/CombatView.tsx
- src/lib/combat/rules.ts
- src/lib/db.ts
- src/lib/combat/serialize.ts
- BATTLE/src/components/ui/context-menu.tsx
- compilerOptions
- src/components/ui/dropdown-menu.tsx
- BATTLE/src/lib/combat/types.ts
- import-character.ts
- compilerOptions
- BATTLE/components.json
- CombatView
- BATTLE/src/components/combat/Hotbar.tsx
- components.json
- models.ts
- BATTLE/src/lib/combat/maps/types.ts
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- devDependencies
- BATTLE/src/components/ui/dropdown-menu.tsx
- src/lib/combat/maps/types.ts
- CombatView
- src/lib/combat/monsters/monster-parser-engine.ts
- BATTLE/src/components/ui/carousel.tsx
- src/components/ui/carousel.tsx
- BATTLE/src/components/ui/form.tsx
- src/lib/combat/encounters/encounter-generator.ts
- src/app/api/combat/import-character/route.ts
- sync-dndsu-bestiary.ts
- src/components/ui/form.tsx
- 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)
- scripts
- 📜 Журнал Партии и Состояние Кампании (Party Ledger)
- ⚔️ D&D 5e Combat Engine — Полное руководство по проекту и архитектуре
- BATTLE/src/components/ui/chart.tsx
- BATTLE/src/lib/utils.ts
- src/components/ui/chart.tsx
- src/lib/combat/movement.ts
- devDependencies
- 🎲 Руководство Мастера Подземелий (DM Guide)
- scripts
- DM_GUIDE.md
- BATTLE/src/lib/combat/encounters/archetype-solver.ts
- BATTLE/src/lib/combat/monsters/monster-parser-engine.ts
- audit-combat-engine.ts
- src/app/layout.tsx
- Design Spec: D&D 5e SRD 5.1 Official Compendium Migration
- BATTLE/src/lib/combat/encounters/encounter-generator.ts
- DnDApp
- 🎯 2. Протокол запуска кампании: Выбор стороны, Персонажи и Генерация
- 🗺️ 3. Создание карт и окружения
- LibraryItemEditorModal
- 🥷 7. Механики Скрытности, Обзора и Телепортации
- BATTLE/eslint.config.mjs
- spawn-test-combat.ts
- src/components/combat/Hotbar.tsx
- Architectural Specification: D&D 5e Encounter Generator
- localtunnel.mjs
- ngrok-tunnel.mjs
- tunnel.mjs
- test-key/route.ts
- BATTLE/next.config.ts
- BATTLE/postcss.config.mjs
- BATTLE/tailwind.config.ts
- eslint.config.mjs
- next.config.ts
- postcss.config.mjs
- tailwind.config.ts
- src/lib/combat/encounters/archetype-solver.ts
- src/lib/combat/maps/spawn-director.ts
- BATTLE/src/components/ui/drawer.tsx
- BATTLE/src/lib/combat/maps/presets/canonical-biomes.ts
- src/lib/combat/maps/presets/canonical-biomes.ts
- migrate-combat-spells.cjs
- Спецификация: Архитектура тактических карт, парсер Universal VTT и библиотека биомов (Этап 1)
- Спецификация: Перенос механик монстров, легендарных действий и тактического ИИ в боевой движок (Этап 3)
- File Structure
- BATTLE/src/lib/combat/encounters/biome-matcher.ts
- Global Constraints
- Задачи
- Global Constraints
- Спецификация: Полномасштабный парсер официального бестиария D&D 5e с dnd.su
- open-map-service.ts
- LibraryManagerModal
- generate-vtt-overlay.cjs
- render-vtt-svg.cjs
- test-dndsu-monster.cjs
- test-jev-decision.ts
- src/lib/combat/monsters/monster-adapter.ts
- BATTLE/src/components/ui/command.tsx
- src/lib/combat/__tests__/mage-3rd-level-spells.test.ts
- LibraryItemEditorModal
- src/lib/combat/encounters/biome-matcher.ts
- 👥 4. Добавление и настройка бойцов
- canAct
- AttacksAbilitiesEditor

## God Nodes (most connected - your core abstractions)
1. `cn()` - 232 edges
2. `cn()` - 232 edges
3. `Combatant` - 49 edges
4. `Combatant` - 48 edges
5. `db` - 34 edges
6. `CombatState` - 33 edges
7. `runBotTurn()` - 32 edges
8. `runBotTurn()` - 32 edges
9. `performAttack()` - 31 edges
10. `POST()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Props` --references--> `Combatant`  [EXTRACTED]
  BATTLE/src/components/combat/AttacksAbilitiesEditor.tsx → BATTLE/src/lib/combat/types.ts
- `InitiativeTrackerProps` --references--> `Combatant`  [EXTRACTED]
  BATTLE/src/components/combat/InitiativeTracker.tsx → BATTLE/src/lib/combat/types.ts
- `Props` --references--> `Combatant`  [EXTRACTED]
  BATTLE/src/components/combat/LibraryManagerModal.tsx → BATTLE/src/lib/combat/types.ts
- `RoleSelectorModalProps` --references--> `Combatant`  [EXTRACTED]
  BATTLE/src/components/combat/RoleSelectorModal.tsx → BATTLE/src/lib/combat/types.ts
- `WildShapeModalProps` --references--> `Combatant`  [EXTRACTED]
  BATTLE/src/components/combat/WildShapeModal.tsx → BATTLE/src/lib/combat/types.ts

## Import Cycles
- None detected.

## Communities (136 total, 18 thin omitted)

### Community 0 - "cn"
Cohesion: 0.03
Nodes (105): AccordionContent(), AccordionItem(), AccordionTrigger(), Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem() (+97 more)

### Community 1 - "BATTLE/src/lib/combat/engine.ts"
Cohesion: 0.08
Nodes (29): addDiceCount(), allyAdjacentTo(), CastContext, CastResult, findSneakAttack(), MoveOutcome, MultiattackResult, prepareDamage() (+21 more)

### Community 2 - "package.json"
Cohesion: 0.02
Nodes (81): bun-types, cheerio, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, eslint (+73 more)

### Community 3 - "dependencies"
Cohesion: 0.03
Nodes (72): dependencies, ai, @ai-sdk/openai, @ai-sdk/react, class-variance-authority, clsx, cmdk, date-fns (+64 more)

### Community 4 - "BATTLE/package.json"
Cohesion: 0.03
Nodes (65): bun-types, cheerio, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, eslint (+57 more)

### Community 5 - "d20-helper.ts"
Cohesion: 0.11
Nodes (30): zustand, D20RollModal(), executeRoll(), handleAttackRoll(), handleCustomRoll(), handleSaveRoll(), handleSkillRoll(), D20RollModalProps (+22 more)

### Community 6 - "BATTLE/src/app/api/combat/action/route.ts"
Cohesion: 0.17
Nodes (42): executeActions(), saveState(), db, main(), loadState(), POST(), respond(), saveState() (+34 more)

### Community 7 - "dependencies"
Cohesion: 0.04
Nodes (52): dependencies, cheerio, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, framer-motion (+44 more)

### Community 8 - "cn"
Cohesion: 0.04
Nodes (72): AccordionContent(), AccordionItem(), AccordionTrigger(), Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem() (+64 more)

### Community 9 - "BATTLE/src/components/ui/menubar.tsx"
Cohesion: 0.12
Nodes (11): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarRadioItem(), MenubarSeparator(), MenubarShortcut() (+3 more)

### Community 10 - "tools.ts"
Cohesion: 0.08
Nodes (32): POST(), advanceActTool, calculateTool, campaignContextSchema, characterUpdatesSchema, createCharacterTool, dmTools, fetchPageTool (+24 more)

### Community 11 - "BATTLE/src/lib/combat/library-data.ts"
Cohesion: 0.05
Nodes (58): db, POST(), POST(), LibraryAbility, LibrarySpell, EditableLibraryItem, AbilityItem, AttackItem (+50 more)

### Community 12 - "chat/route.ts"
Cohesion: 0.11
Nodes (32): ai, @ai-sdk/openai, clientWithCustomUrl, cost, customCost, maxDuration, POST(), AuthMode (+24 more)

### Community 13 - "DnDApp.tsx"
Cohesion: 0.05
Nodes (46): AttacksAbilitiesEditor(), save(), COST_OPTIONS, emptyAttack(), KIND_LABELS, rebuildHotbar(), Tab, CombatEndSummary (+38 more)

### Community 14 - "BATTLE/src/components/combat/ImportCharacterModal.tsx"
Cohesion: 0.08
Nodes (21): Home(), ImportCharacterModal(), ImportCharacterModalProps, LibraryManagerModal(), Card(), CardAction(), CardContent(), CardDescription() (+13 more)

### Community 15 - "BATTLE/src/lib/combat/serialize.ts"
Cohesion: 0.09
Nodes (32): GET(), getLanIps(), POST(), TEST_ENEMIES, TestEnemy, ABILITY_RU_TO_EN, DAMAGE_TYPE_RU, detectActionCost() (+24 more)

### Community 16 - "src/lib/utils.ts"
Cohesion: 0.06
Nodes (20): Alert(), AlertDescription(), AlertTitle(), alertVariants, Checkbox(), DrawerContent(), DrawerDescription(), DrawerFooter() (+12 more)

### Community 17 - "BATTLE/src/lib/combat/bot.ts"
Cohesion: 0.10
Nodes (43): CombatGrid(), getCellFromEvent(), handleGlobalMouseMove(), handleGlobalMouseUp(), handleSvgClick(), handleSvgMouseMove(), handleSvgMouseUp(), CombatantDetails() (+35 more)

### Community 18 - "AI Dungeon Master — D&D 5e Solo"
Cohesion: 0.06
Nodes (34): AI Dungeon Master — D&D 5e Solo, AI забывает персонажей, API-ключ не работает, "Cannot find module 'xxx'", "Database is readonly" / "SQLite error", "Port 3000 is already in use", Быстрые кнопки, Ввод ключа в приложении (+26 more)

### Community 19 - "src/components/combat/CombatView.tsx"
Cohesion: 0.09
Nodes (47): Props, BestiaryBrowser(), BestiaryBrowserProps, CR_OPTIONS, CREATURE_TYPES, CombatViewProps, ELEMENT_TYPES, LOG_ICONS (+39 more)

### Community 20 - "BATTLE/src/hooks/use-toast.ts"
Cohesion: 0.09
Nodes (28): geistMono, geistSans, metadata, Toaster(), Toast, ToastAction, ToastActionElement, ToastClose (+20 more)

### Community 21 - "src/app/api/combat/action/route.ts"
Cohesion: 0.17
Nodes (37): loadState(), POST(), respond(), saveState(), getBeastFormById(), isBotTurn(), applyActionParameters(), applyEffect() (+29 more)

### Community 22 - "CombatGrid"
Cohesion: 0.16
Nodes (10): CombatGrid(), getCellFromEvent(), handleGlobalMouseMove(), handleGlobalMouseUp(), handleSvgClick(), handleSvgMouseMove(), handleSvgMouseUp(), cellKey() (+2 more)

### Community 23 - "Боевой движок D&D 5e — Автономный"
Cohesion: 0.07
Nodes (27): 1. Установить Node.js 20+, 2. Распаковать, 3. Установить зависимости, 4. Инициализировать БД, 5. Запустить, "Cannot find module", "Database is readonly", "Port 3000 is already in use" (+19 more)

### Community 24 - "story-arc.ts"
Cohesion: 0.14
Nodes (24): GET(), maxDuration, POST(), resolveStoryModel(), actSchema, ArcGenerationParams, ArcProgress, describeCampaign() (+16 more)

### Community 25 - "src/lib/combat/types.ts"
Cohesion: 0.07
Nodes (32): CombatEffectsLayer(), CombatEffectsLayerProps, CombatGridProps, CombatEffect, DamagePopup, CombatState, createMockCombatState(), createTestCombatState() (+24 more)

### Community 26 - "BATTLE/src/lib/combat/movement.ts"
Cohesion: 0.16
Nodes (25): getActiveCombat(), printContext(), GET(), checkSpellRange(), getSpellDefinition(), createMockCombatState(), cellCost(), computeVisibilityStatus() (+17 more)

### Community 27 - "src/lib/combat/engine.ts"
Cohesion: 0.11
Nodes (25): addDiceCount(), allyAdjacentTo(), CastContext, CastResult, findSneakAttack(), MoveOutcome, MultiattackResult, prepareDamage() (+17 more)

### Community 28 - "BATTLE/src/lib/combat/rules.ts"
Cohesion: 0.12
Nodes (28): ActionCostCheck, AdvantageResult, applyDamage(), applyHealing(), AttackResolution, computeAttackAdvantage(), consumeAttackConditions(), DamageResult (+20 more)

### Community 29 - "src/components/ui/alert-dialog.tsx"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+10 more)

### Community 30 - "src/hooks/use-toast.ts"
Cohesion: 0.12
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 31 - "src/lib/combat/library-data.ts"
Cohesion: 0.06
Nodes (56): POST(), LibraryAbility, LibrarySpell, EditableLibraryItem, AbilityItem, AttackItem, SpellItem, PresetsModalProps (+48 more)

### Community 32 - "BATTLE/src/components/ui/alert-dialog.tsx"
Cohesion: 0.10
Nodes (18): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+10 more)

### Community 33 - "src/lib/combat/bot.ts"
Cohesion: 0.14
Nodes (38): CombatantDetails(), damageSummary(), extractWeaponBase(), Hotbar(), spellSummary(), alliesOf(), bestAttack(), BotArchetype (+30 more)

### Community 34 - "BATTLE/src/components/combat/CombatView.tsx"
Cohesion: 0.08
Nodes (43): COST_OPTIONS, KIND_LABELS, Props, Tab, CombatViewProps, ELEMENT_TYPES, LOG_ICONS, InitiativeTracker() (+35 more)

### Community 35 - "src/lib/combat/rules.ts"
Cohesion: 0.10
Nodes (31): rollInitiativeFor(), rollInitiativeForAll(), ActionCostCheck, AdvantageResult, applyDamage(), applyHealing(), AttackResolution, computeAttackAdvantage() (+23 more)

### Community 36 - "src/lib/db.ts"
Cohesion: 0.10
Nodes (10): POST(), TEST_ENEMIES, TestEnemy, GET(), POST(), awardCombatVictoryXP(), AwardCombatXPResult, CR_TO_XP_TABLE (+2 more)

### Community 37 - "src/lib/combat/serialize.ts"
Cohesion: 0.21
Nodes (12): GET(), getLanIps(), GET(), DEFAULT_SPELLS, hydrateCombat(), hydrateCombatant(), hydrateMapElement(), normalizeAttack() (+4 more)

### Community 38 - "BATTLE/src/components/ui/context-menu.tsx"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 39 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 40 - "src/components/ui/dropdown-menu.tsx"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 41 - "BATTLE/src/lib/combat/types.ts"
Cohesion: 0.06
Nodes (47): CombatGridProps, HotbarProps, CombatState, checkLegendaryResistance(), performLegendaryAction(), triggerAILegendaryActions(), crToProfBonus(), getAttackStem() (+39 more)

### Community 42 - "import-character.ts"
Cohesion: 0.19
Nodes (16): fetchSharedCharacter(), maxDuration, POST(), ShareFetchError, SHEET_BASE_URL, ABILITY_KEYS, clampLevel(), DerivedMemory (+8 more)

### Community 43 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 44 - "BATTLE/components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 45 - "CombatView"
Cohesion: 0.12
Nodes (25): CombatEffectsLayer(), CombatEffectsLayerProps, CombatView(), addCombatant(), applyMultiSpell(), cancelTargeting(), continueAfterBot(), doAction() (+17 more)

### Community 46 - "BATTLE/src/components/combat/Hotbar.tsx"
Cohesion: 0.19
Nodes (8): COST_LABEL, damageSummary(), extractWeaponBase(), Hotbar(), spellSummary(), Popover(), PopoverContent(), PopoverTrigger()

### Community 47 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 48 - "models.ts"
Cohesion: 0.10
Nodes (19): main(), maxDuration, BOOKKEEPING_TOOLS, CHEAP_MODEL, DEFAULT_CHEAP_MODEL, DEFAULT_DM_MODEL, DEFAULT_STORY_MODEL, FEATURED_MODELS (+11 more)

### Community 49 - "BATTLE/src/lib/combat/maps/types.ts"
Cohesion: 0.11
Nodes (26): mapRegistry, cityStreetPreset, dungeonPrisonPreset, forestAmbushPreset, gladiatorArenaPreset, PRESETS_BY_ID, lavaCavePreset, shipBattlePreset (+18 more)

### Community 50 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.33
Nodes (6): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), 🗺️ 4. Категорический запрет визуальных заглушек и обязательный VTT-рендеринг (No Visual Stubs & Mandatory Real Battlemap Rendering), ⚔️ D&D 5e Combat Engine & DM Assistant, 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 51 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, bun-types, eslint, eslint-config-next, localtunnel, @ngrok/ngrok, selfsigned, @sentropic/graphify (+8 more)

### Community 52 - "BATTLE/src/components/ui/dropdown-menu.tsx"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 53 - "src/lib/combat/maps/types.ts"
Cohesion: 0.11
Nodes (27): mapRegistry, OpenBattlemap, cityStreetPreset, gladiatorArenaPreset, ALL_PRESETS, getPresetByBiome(), getPresetById(), PRESETS_BY_BIOME (+19 more)

### Community 54 - "CombatView"
Cohesion: 0.14
Nodes (21): CombatView(), addCombatant(), applyMultiSpell(), cancelTargeting(), continueAfterBot(), doAction(), endCombat(), executeOnTarget() (+13 more)

### Community 55 - "src/lib/combat/monsters/monster-parser-engine.ts"
Cohesion: 0.15
Nodes (20): DAMAGE_TYPE_MAP, normalizeDamageType(), parseAbilities(), parseAction(), parseCR(), parseDamageTypes(), ParseMeta, parseMonsterHtml() (+12 more)

### Community 56 - "BATTLE/src/components/ui/carousel.tsx"
Cohesion: 0.19
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 57 - "src/components/ui/carousel.tsx"
Cohesion: 0.19
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 58 - "BATTLE/src/components/ui/form.tsx"
Cohesion: 0.23
Nodes (10): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+2 more)

### Community 59 - "src/lib/combat/encounters/encounter-generator.ts"
Cohesion: 0.11
Nodes (30): GET(), POST(), createCombatantStub(), createMonsterDefinitionFromManifest(), generateEncounter(), loadDefaultManifest(), loadMonsterDefinition(), mockManifest (+22 more)

### Community 60 - "src/app/api/combat/import-character/route.ts"
Cohesion: 0.23
Nodes (13): ABILITY_RU_TO_EN, DAMAGE_TYPE_RU, detectActionCost(), detectWeapon(), parseBonus(), parseDamageString(), POST(), WeaponProfile (+5 more)

### Community 61 - "sync-dndsu-bestiary.ts"
Cohesion: 0.10
Nodes (27): CACHE_DIR, CANONICAL_TYPES, CATALOG_CACHE_PATH, CatalogItem, CliOptions, COMPENDIUM_BASE_DIR, delay(), ensureDirectories() (+19 more)

### Community 62 - "src/components/ui/form.tsx"
Cohesion: 0.21
Nodes (11): react-hook-form, FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue (+3 more)

### Community 63 - "🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)"
Cohesion: 0.50
Nodes (4): 1. Кнопки и Акценты, 2. Единая сетка и высота элементов управления в навигации, 3. Безопасность SSR и гидратации (Zero Hydration Mismatch), 🎨 Обязательный стандарт дизайна (Warm D&D & Amber Medieval Theme)

### Community 64 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, db:generate, db:push, dev, graph:build, graph:studio, graph:watch (+4 more)

### Community 65 - "📜 Журнал Партии и Состояние Кампании (Party Ledger)"
Cohesion: 0.18
Nodes (10): 🛡️ 1. Текущий состав отряда (Все персонажи — 4 УРОВЕНЬ / Злые [Evil]), 📈 2. Прогресс и Уровни, 🎒 3. Казна и Военная Мощь партии, 🗺️ 4. Журнал Квестов (Quest Log), 💀 Армия Карробургского Тёмного Доминиона:, 💰 Деньги и Казна Карробурга (Общая сумма: 2,000 зм, 33 сш):, 📜 Журнал Партии и Состояние Кампании (Party Ledger), 🔮 Легендарный Арсенал партии: (+2 more)

### Community 66 - "⚔️ D&D 5e Combat Engine — Полное руководство по проекту и архитектуре"
Cohesion: 0.14
Nodes (14): 📌 1. Суть проекта, 📂 2. Структура директорий и файлов, 🗄️ 3. Схема базы данных (Prisma SQLite), ⚙️ 4. Архитектура движка боя, 🚀 5. Полезные команды для разработки, 🧩 6. Как добавлять и расширять функционал, 🤖 7. Управление боем для ИИ-Мастера (Live AI DM API & CLI), ⚔️ D&D 5e Combat Engine — Полное руководство по проекту и архитектуре (+6 more)

### Community 67 - "BATTLE/src/components/ui/chart.tsx"
Cohesion: 0.25
Nodes (9): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload(), THEMES (+1 more)

### Community 68 - "BATTLE/src/lib/utils.ts"
Cohesion: 0.07
Nodes (19): Alert(), AlertDescription(), AlertTitle(), alertVariants, Checkbox(), HoverCardContent(), InputOTP(), InputOTPGroup() (+11 more)

### Community 69 - "src/components/ui/chart.tsx"
Cohesion: 0.25
Nodes (9): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), getPayloadConfigFromPayload(), THEMES (+1 more)

### Community 70 - "src/lib/combat/movement.ts"
Cohesion: 0.22
Nodes (20): GET(), checkSpellRange(), cellCost(), computeVisibilityStatus(), coversCell(), FACING_VECTORS, findOpportunityAttackers(), FT_PER_CELL (+12 more)

### Community 71 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, bun-types, cheerio, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tw-animate-css (+5 more)

### Community 72 - "🎲 Руководство Мастера Подземелий (DM Guide)"
Cohesion: 0.17
Nodes (12): ⚡ 1. Быстрый старт, 📚 5. Управление Библиотекой «на лету», 🤖 6. Ведение боя: ИИ-Мастер в реальном времени и Боты, 📜 8. Готовые шаблоны для спавна боя, 📋 9. Ведение Журнала Партии (`PARTY_LOG.md`), Адрес боевого интерфейса:, Добавление способности/заклинания прямо во время боя:, Режим А: Прямое управление врагами ИИ-Мастером (Live AI DM) (+4 more)

### Community 73 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, db:generate, db:migrate, db:push, db:reset, dev, lint (+1 more)

### Community 74 - "DM_GUIDE.md"
Cohesion: 0.27
Nodes (5): This is NOT the Next.js you know, ⚔️ D&D 5e Combat Engine, This is NOT the Next.js you know, ⚔️ D&D 5e Combat Engine & DM Assistant, This is NOT the Next.js you know

### Community 75 - "BATTLE/src/lib/combat/encounters/archetype-solver.ts"
Cohesion: 0.17
Nodes (21): inferBacklineRole(), isFrontlineCandidate(), RANGED_KEYWORDS, resolveArchetype(), solveBossMinions(), solveGreedyFallback(), solvePack(), solveSoloBoss() (+13 more)

### Community 76 - "BATTLE/src/lib/combat/monsters/monster-parser-engine.ts"
Cohesion: 0.13
Nodes (24): DAMAGE_TYPE_MAP, normalizeDamageType(), parseAbilities(), parseAction(), parseCR(), parseDamageTypes(), ParseMeta, parseMonsterHtml() (+16 more)

### Community 77 - "audit-combat-engine.ts"
Cohesion: 0.24
Nodes (8): AuditIssue, createCombatant(), createFreshState(), runAudit(), BEAST_FORMS, BeastForm, getBeastFormById(), CombatAbility

### Community 78 - "src/app/layout.tsx"
Cohesion: 0.33
Nodes (4): geistMono, geistSans, metadata, Toaster()

### Community 79 - "Design Spec: D&D 5e SRD 5.1 Official Compendium Migration"
Cohesion: 0.40
Nodes (4): 1. Objective & Scope, 2. Architecture & Data Flow, 3. Verification & Testing, Design Spec: D&D 5e SRD 5.1 Official Compendium Migration

### Community 80 - "BATTLE/src/lib/combat/encounters/encounter-generator.ts"
Cohesion: 0.12
Nodes (22): createCombatantStub(), createMonsterDefinitionFromManifest(), generateEncounter(), loadDefaultManifest(), loadMonsterDefinition(), mockManifest, EncounterRequest, GeneratedEncounter (+14 more)

### Community 81 - "DnDApp"
Cohesion: 0.09
Nodes (15): CostStatsModal(), CostStatsModalProps, DnDApp(), createCampaign(), deleteCampaign(), loadCampaignsList(), startArcGeneration(), getMessageError() (+7 more)

### Community 82 - "🎯 2. Протокол запуска кампании: Выбор стороны, Персонажи и Генерация"
Cohesion: 0.50
Nodes (4): 🎯 2. Протокол запуска кампании: Выбор стороны, Персонажи и Генерация, Шаг 1. Сбор параметров (5 ключевых вопросов):, Шаг 2. Предоставление персонажей ДО генерации сюжета:, Шаг 3. Детальная генерация мастерского плана (1–20 уровень):

### Community 83 - "🗺️ 3. Создание карт и окружения"
Cohesion: 0.50
Nodes (4): 🗺️ 3. Создание карт и окружения, Способ А: Создание через веб-интерфейс, Способ Б: Программный спавн карты в скрипте, Типы элементов карты (`MapElementType`):

### Community 85 - "🥷 7. Механики Скрытности, Обзора и Телепортации"
Cohesion: 0.50
Nodes (4): 🥷 7. Механики Скрытности, Обзора и Телепортации, Невидимость (`invisible`):, Скрытность (`isHidden`):, Теневой шаг и Туманный шаг (Телепортация):

### Community 86 - "BATTLE/eslint.config.mjs"
Cohesion: 0.50
Nodes (3): __dirname, eslintConfig, __filename

### Community 87 - "spawn-test-combat.ts"
Cohesion: 0.67
Nodes (3): db, main(), rollD20()

### Community 90 - "src/components/combat/Hotbar.tsx"
Cohesion: 0.14
Nodes (12): COST_LABEL, HotbarProps, Popover(), PopoverContent(), PopoverTrigger(), BEAST_FORMS, BeastForm, AttackOutcome (+4 more)

### Community 91 - "Architectural Specification: D&D 5e Encounter Generator"
Cohesion: 0.09
Nodes (21): 1. Executive Summary & Goals, 2.1. Individual Character XP Thresholds (DMG p. 82), 2.2. Party XP Budget, 2.3. Monster Count Multiplier & Party Size Adjustment, 2.4. XP Reward vs Adjusted XP, 2. XP Math & Difficulty Calculation, 3.1. «Вожак + Свита» (`boss_minions`), 3.2. «Тактический отряд» (`tactical_squad`) (+13 more)

### Community 107 - "src/lib/combat/encounters/archetype-solver.ts"
Cohesion: 0.20
Nodes (19): BossMinionsCandidate, inferBacklineRole(), isFrontlineCandidate(), PackCandidate, RANGED_KEYWORDS, resolveArchetype(), solveBossMinions(), solveGreedyFallback() (+11 more)

### Community 108 - "src/lib/combat/maps/spawn-director.ts"
Cohesion: 0.20
Nodes (10): forestAmbushPreset, templePreset, assignTacticalSpawns(), BACKLINE_CLASSES, BOSS_KEYWORDS, findClosestPassableCell(), inferCombatantRole(), SpawnDirectorOptions (+2 more)

### Community 109 - "BATTLE/src/components/ui/drawer.tsx"
Cohesion: 0.17
Nodes (7): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle(), vaul

### Community 110 - "BATTLE/src/lib/combat/maps/presets/canonical-biomes.ts"
Cohesion: 0.11
Nodes (17): astralRiftPreset, banditCampPreset, bridgeChasmPreset, CANONICAL_PRESETS_EXTENDED, castleCourtyardPreset, desertDunesPreset, docksHarborPreset, foundryForgePreset (+9 more)

### Community 111 - "src/lib/combat/maps/presets/canonical-biomes.ts"
Cohesion: 0.11
Nodes (17): astralRiftPreset, banditCampPreset, bridgeChasmPreset, CANONICAL_PRESETS_EXTENDED, castleCourtyardPreset, desertDunesPreset, docksHarborPreset, foundryForgePreset (+9 more)

### Community 112 - "migrate-combat-spells.cjs"
Cohesion: 0.14
Nodes (16): AUTHOR_ALIASES, CLASS_MAP, cleanAlpha(), COMPENDIUM_DIR, COMPENDIUM_FILES, DAMAGE_TYPE_PATTERNS, detectDamageType(), EXISTING_SPELLS_PATH (+8 more)

### Community 113 - "Спецификация: Архитектура тактических карт, парсер Universal VTT и библиотека биомов (Этап 1)"
Cohesion: 0.12
Nodes (15): 1.1. Проблема, 1.2. Цели Этапа 1, 1. Контекст и цели, 2.1. Расширение типов элементов карты (`types.ts`), 2.2. Формат пресета тактической карты (`TacticalMapPreset`), 2. Модель данных и типы, 3.1. Парсер Universal VTT (`src/lib/combat/maps/uvtt-parser.ts`), 3.2. Библиотека встроенных биомов (`src/lib/combat/maps/presets/`) (+7 more)

### Community 114 - "Спецификация: Перенос механик монстров, легендарных действий и тактического ИИ в боевой движок (Этап 3)"
Cohesion: 0.14
Nodes (13): 1.1. Проблема, 1.2. Цели Этапа 3, 1. Контекст и цели, 2.1. Расширение интерфейса `Combatant`, 2. Модель данных и расширение типов (`types.ts`), 3.1. Модуль `monster-adapter.ts`, 3.2. Модуль пассивных черт и правил (`rules.ts` & `engine.ts`), 3.3. Модуль легендарных действий и перезарядки (`legendary.ts`) (+5 more)

### Community 115 - "File Structure"
Cohesion: 0.17
Nodes (11): File Structure, Global Constraints, Plan Review Checklist, Tactical Maps, Universal VTT Parser & Biome Presets Implementation Plan, Task 1: Core Map Types & MapElement Extensions, Task 2: Universal VTT (.dd2vtt / .uvtt) Parser & Bresenham Line Converter, Task 3: Tag-Based Map Registry & On-Demand Catalog, Task 4: Complete Library of 24 Canonical Biome Presets (+3 more)

### Community 116 - "BATTLE/src/lib/combat/encounters/biome-matcher.ts"
Cohesion: 0.27
Nodes (9): BIOME_CONFIGS, BiomeAffinity, entryMatchesKeywords(), getBiomeCandidatePool(), UNIVERSAL_FALLBACK_KEYWORDS, UNIVERSAL_FALLBACK_TYPES, mockManifest, StoryFactionContext (+1 more)

### Community 117 - "Global Constraints"
Cohesion: 0.20
Nodes (9): Global Constraints, Task 1: Расширение типов комбатантов и боевых механик монстров, Task 2: Адаптер монстров компендиума (`monster-adapter.ts`), Task 3: Пассивные черты монстров и сопротивления в ядре правил, Task 4: Движок легендарных действий, сопротивлений и перезарядки d6, Task 5: Механика Multiattack в боевом движке, Task 6: Расширение тактического ИИ ботов для монстров и боссов, Task 7: Интеграция с генератором энкаунтеров и сквозная верификация (+1 more)

### Community 118 - "Задачи"
Cohesion: 0.25
Nodes (7): Task 1: Определение полной модели типов монстра D&D 5e, Task 2: Чистый движок экстракции характеристик из HTML карточки (`monster-parser-engine.ts`), Task 3: Реестр монстров и поиск по критериям (`monster-registry.ts`), Task 4: Скрипт синхронизации бестиария с dnd.su (`sync-dndsu-bestiary.ts`), Task 5: Верификация, сборка и фиксация в Git, Задачи, План реализации: Полномасштабный парсер официального бестиария D&D 5e с dnd.su

### Community 119 - "Global Constraints"
Cohesion: 0.25
Nodes (7): D&D 5e Encounter Generator Implementation Plan, Global Constraints, Task 1: Encounter Types & XP Math Calculator, Task 2: Biome & Story Faction Matcher, Task 3: Tactical Squad Archetype Solvers, Task 4: Map Geometry Integration & Encounter Generator Pipeline, Task 5: End-to-End Verification & Knowledge Graph

### Community 120 - "Спецификация: Полномасштабный парсер официального бестиария D&D 5e с dnd.su"
Cohesion: 0.25
Nodes (7): 1.1. Контекст, 1.2. Ограничения пользователя, 1. Цели и ограничения, 2. Модель данных (`src/lib/combat/monsters/types.ts`), 3. Архитектура модулей системы сбора, 4. План верификации, Спецификация: Полномасштабный парсер официального бестиария D&D 5e с dnd.su

### Community 121 - "open-map-service.ts"
Cohesion: 0.35
Nodes (8): GET(), getOpenMapById(), getPopularTags(), OPEN_BATTLEMAP_CATALOG, OpenMapSearchQuery, POPULAR_MAP_TAGS, resolveBattlemapForNarrative(), searchOpenMaps()

### Community 126 - "test-jev-decision.ts"
Cohesion: 0.67
Nodes (3): loadApiKey(), run(), @typesafe-ai/sdk

### Community 127 - "src/lib/combat/monsters/monster-adapter.ts"
Cohesion: 0.12
Nodes (20): crToProfBonus(), getAttackStem(), MonsterAdapterOptions, parseCountBeforeStem(), parseMultiattack(), safeId(), createManifestEntry(), filterMonsters() (+12 more)

### Community 129 - "BATTLE/src/components/ui/command.tsx"
Cohesion: 0.20
Nodes (8): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut()

### Community 132 - "src/lib/combat/encounters/biome-matcher.ts"
Cohesion: 0.29
Nodes (7): BIOME_CONFIGS, BiomeAffinity, entryMatchesKeywords(), getBiomeCandidatePool(), UNIVERSAL_FALLBACK_KEYWORDS, UNIVERSAL_FALLBACK_TYPES, mockManifest

### Community 133 - "👥 4. Добавление и настройка бойцов"
Cohesion: 0.50
Nodes (4): 👥 4. Добавление и настройка бойцов, Золотое правило импорта персонажей и монстров:, Пример создания бойца со всеми статами:, Типы бойцов (`CombatantType`):

### Community 134 - "canAct"
Cohesion: 0.33
Nodes (7): checkLegendaryResistance(), performLegendaryAction(), triggerAILegendaryActions(), canAct(), createTestCombatState(), mockTailAttack, LegendaryState

### Community 135 - "AttacksAbilitiesEditor"
Cohesion: 0.29
Nodes (4): AttacksAbilitiesEditor(), save(), emptyAttack(), rebuildHotbar()

## Knowledge Gaps
- **917 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+912 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1192 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react-hook-form` connect `src/components/ui/form.tsx` to `BATTLE/src/components/ui/form.tsx`, `package.json`?**
  _High betweenness centrality (0.179) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `BATTLE/src/components/ui/alert-dialog.tsx`, `BATTLE/src/components/ui/command.tsx`, `BATTLE/src/components/combat/CombatView.tsx`, `BATTLE/src/components/ui/chart.tsx`, `BATTLE/src/lib/utils.ts`, `BATTLE/src/components/ui/context-menu.tsx`, `BATTLE/src/components/ui/menubar.tsx`, `BATTLE/src/components/ui/drawer.tsx`, `BATTLE/src/components/combat/ImportCharacterModal.tsx`, `BATTLE/src/components/combat/Hotbar.tsx`, `BATTLE/src/components/ui/dropdown-menu.tsx`, `BATTLE/src/hooks/use-toast.ts`, `BATTLE/src/components/ui/carousel.tsx`, `BATTLE/src/components/ui/form.tsx`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Why does `cn()` connect `cn` to `src/components/ui/chart.tsx`, `src/components/ui/dropdown-menu.tsx`, `DnDApp.tsx`, `src/lib/utils.ts`, `src/components/combat/CombatView.tsx`, `src/hooks/use-toast.ts`, `src/components/ui/carousel.tsx`, `src/components/combat/Hotbar.tsx`, `src/components/ui/alert-dialog.tsx`, `src/components/ui/form.tsx`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _917 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.026446630699248914 - nodes in this community are weakly interconnected._
- **Should `BATTLE/src/lib/combat/engine.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08097165991902834 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.024390243902439025 - nodes in this community are weakly interconnected._