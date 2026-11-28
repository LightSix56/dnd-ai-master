# Дизайн: Объединение всех справочников D&D 5e (2014) в общую библиотеку `dnd-shared`

**Дата:** 2026-11-28
**Репозитории и ветки:**
- `C:\antig\dnd-shared` (`main`, GitHub `LightSix56/dnd-shared`, публичный)
- `C:\antig\dnd5e-character-sheet` (`dev` — создаётся от `main`; слияние в `main` только после полной готовности)
- `c:\antig\ai_master_n_battle` (`dev`; слияние в `main` только после полной готовности)
**Статус:** На ревью у пользователя

---

## 1. Цель и ключевые ограничения

1. **Единый источник истины:** оба сайта (`dnd5e-character-sheet` и `ai_master_n_battle`) используют одну библиотеку `dnd-shared` для всех справочников D&D 5e редакции 2014 года. Дублирующие JSON/TS-справочники и ручные скрипты копирования (`sync-dnd-shared-races.mjs`, `import-sheet-classes.mjs`) удаляются по мере закрытия этапов.
2. **100% полнота описаний на обоих сайтах:** все официальные 2014-расы, подрасы, классы, подклассы, особенности/черты, заклинания, предметы, предыстории, состояния должны присутствовать в `dnd-shared` с полными русскими названиями и описаниями — даже если в конструкторе листа конкретная способность не применяется автоматически.
3. **Изоляция клиентского бандла:** клиентские компоненты листа (`AutocompleteInput`, `RaceSelectorModal`, `CharacterCreationWizardModal`, `LevelUpModal`) импортируют только облегчённые `-core`-экспорты, не содержащие боевых параметров (`combat`, `masterRecord`) и бестиария (`monsters`).
4. **Тонкие адаптеры совместимости:** UI-контракты листа (`DND_COMPENDIUM_*`, `getCompendiumAutocompleteItems`, `findSpellByName`, `findRaceByName`, `getSubclassesForClass`, OOP-инстансы зелий) и боевые адаптеры мастера (`srd/adapter.ts`, `race-defs.ts`, `class-defs.ts`, `fighter-subclasses.ts`) сохраняются поверх данных из `dnd-shared`.
5. **Приоритет канонической схемы:** единая чистая структура `dnd-shared` важнее абсолютной обратной совместимости со старыми сохранениями в Supabase; тем не менее существующие `aliases` / `legacyIds` / `aliasesEn` и `SPELL_ALIASES` переносятся в `dnd-shared`, чтобы минимизировать поломки сохранённых персонажей.
6. **Модель параллельного исполнения:** независимые задачи внутри этапов выполняются параллельными подагентами на модели `hydrogen` (в `invoke_subagent` — `Model: 'inherit'`, так как текущая сессия работает на Hydrogen).

---

## 2. Источник истины и политика по хоумбрю

### 2.1. Официальный контент D&D 5e (2014)
- **Каноническая база:** официальные материалы D&D 5e редакции 2014 года с `dnd.su` (без UA, Plane Shift, PH24).
- **Обогащение поверх канона:**
  - Для конструктора и фильтров листа — структурированные метаданные из `dnd5e-character-sheet` (`category`, `choices`, `recommendedScores`, `startingEquipment`, `spellcasting`, `featPrerequisites`, `potions` и т.п.).
  - Для боевого движка — боевые параметры из `ai_master_n_battle` (`combat`, `masterRecord`, SRD-модификаторы, `equipment`, `conditions`, `monsters`).

### 2.2. Хоумбрю в `dnd-shared/homebrew`
- Исключения проекта — **«Альтернативный варвар»** (`alt-barbarian` + `barbarian-exploits`) и **«Порождение Бедствия»** (`scourgeborne` с 4 подрасами) — переносятся в общий пакет `dnd-shared`, но **изолируются** в отдельный экспорт `./homebrew` с флагом `isHomebrew: true`.
- Это гарантирует:
  - оба сайта берут хоумбрю из одного пакета `dnd-shared`;
  - лист подмешивает `./homebrew` в `DND_COMPENDIUM_RACES`, `DND_COMPENDIUM_CLASSES`, `DND_CLASS_PROGRESSION` и `DND_COMPENDIUM_FEATS` / `dnd-traits`;
  - мастер сохраняет строгий официальный пул (`84` расы, `13` классов) без поломки существующих тестов и при желании может опционально включать `./homebrew`.

---

## 3. Архитектура пакета `dnd-shared`

### 3.1. Карта сабпат-экспортов (`package.json`)

| Сабпат | Потребитель | Содержимое | Исключено |
|---|---|---|---|
| `.` | Мастер | `SPELLS` (525 заклинаний + `combat` + `masterRecord`), `findSpell` | — |
| `./core` | Лист | `CORE_SPELLS` (без `combat`/`masterRecord`), `SPELL_ALIASES`, `findCoreSpell` | `combat`, `masterRecord` |
| `./races` | Мастер | `RACES` (84 расы с `traits[*].combat`), `findRace` (с разрешением Legacy vs MPMM) | хоумбрю |
| `./races-core` | Лист | `CORE_RACES` (84 расы + `category`, `choices`, `speed`, `progression`), `findCoreRace` | `traits[*].combat` |
| `./fighter` → `./classes` | Мастер | Официальные 13 классов, 115+ подклассов, опции подклассов (`fighter.json` обобщается/дополняется) | хоумбрю |
| `./classes-core` | Лист | 13 классов, 115+ подклассов, `CLASS_PROGRESSION`, `CLASS_SPELLS`, `WARLOCK_CHOICES`, конструкторские поля | боевые поля, хоумбрю |
| `./items` | Мастер | Оружие, доспехи, щиты, снаряжение, инструменты, зелья с боевыми полями (`kind`, `damage`, `actionCost`) | — |
| `./items-core` | Лист | Те же сущности для инвентаря, слотов и поиска (плюс сырые данные зелий для OOP-обёрток) | боевые поля движка |
| `./feats` / `./feats-core` | Оба | 105+ официальных черт (`dnd.su`) + `featPrerequisites` (плюс базовые справочные черты при необходимости) | хоумбрю |
| `./backgrounds-core` | Оба | Официальные предыстории с навыками, инструментами, языками, снаряжением и чертами личности | — |
| `./conditions` | Оба | Состояния D&D 5e (`conditions.json` с полными русскими названиями и описаниями + EN-алиасы) | — |
| `./monsters` | Только мастер | Бестиарий (`monsters.json`, ~879 КБ) и/или таблицы энкаунтеров; **не импортируется в листе** | — |
| `./homebrew` | Лист (опц. мастер) | `HOMEBREW_RACES` (`scourgeborne`), `HOMEBREW_CLASSES` (`alt-barbarian`), `HOMEBREW_CLASS_PROGRESSION`, `BARBARIAN_EXPLOITS` | — |

### 3.2. Контракты поиска и совместимость с Next.js 16 / `tsx`
1. **Единая нормализация строк:** `lowercase`, `ё → е`, типографские кавычки `’ → '`, схлопывание пробелов.
2. **Совместимость ESM/JSON:** на первом шаге Этапа 1 проверяется импорт `dnd-shared/*` через `next build` (Next.js 16 Turbopack/Webpack) и `tsx --test` в `dnd5e-character-sheet`. Если `import ... with { type: "json" }` вызывает ошибку в `tsx` или Next.js, загрузка JSON в `src/*.js` переводится на совместимый механизм (`createRequire(import.meta.url)` или `fs.readFileSync`, либо лёгкий build-шаг) до запуска параллельных задач.
3. **Поиск заклинаний (`findSpell` / `findCoreSpell`):** включает таблицу `SPELL_ALIASES` (перенесённую из `dnd5e-character-sheet`), очистку префиксов `заклинание`/`заговор` (исправляя баг в текущем регэксе `s+` → `\s+`), поиск по `id`, `legacyIds`, `name`, `nameEn`, `aliasesEn`, и опциональный substring-fallback.
4. **Поиск рас (`findRace` / `findCoreRace`):** принимает `raceQuery`, `subraceQuery` и опцию приоритета (`preferVariant?: "legacy" | "mpmm"`), воспроизводя логику `race-defs.ts` для коллизий (`Аасимар` по умолчанию отдаёт Legacy, если в запросе нет `mpmm`/«мультивселенная» и с учётом наличия переданной подрасы).

---

## 4. Интеграция на обоих сайтах (адаптеры)

### 4.1. `dnd5e-character-sheet` (ветка `dev`)
- `src/data/compendium/spells/index.ts` → импортирует `CORE_SPELLS`, `findCoreSpell` из `dnd-shared/core`, экспортирует `DND_COMPENDIUM_SPELLS` и `findSpellByName` без изменения сигнатур. Старые файлы `cantrips.ts` .. `level-9.ts` удаляются.
- `src/data/compendium/races/index.ts` → импортирует `CORE_RACES` из `dnd-shared/races-core` и `HOMEBREW_RACES` из `dnd-shared/homebrew`, маппит `CoreRace` → `CompendiumRace` (`speed: r.speeds.walk`, `category`, `choices`, `subraces`, `traits`, `aliases`), экспортирует `DND_COMPENDIUM_RACES`, `CORE_RACES`, `MULTIVERSE_RACES`, `SUPPLEMENT_RACES` (или единый экспорт, сохраняя совместимость `RaceSelectorModal` и `wizard-helpers`). Старые хардкодные массивы в `races/core.ts`, `multiverse.ts`, `supplements.ts` удаляются; `race-progression.ts` переходит на `progression` из `CORE_RACES`.
- На этапах 2–4 аналогично переводятся:
  - `classes.ts`, `class-progression.ts`, `class-spells.ts`, `warlock-choices.ts`, `barbarian-exploits.ts`;
  - `items.ts`, `dnd-weapons.ts`, `potions-data.ts` (данные зелий приходят из `dnd-shared/items-core`, а `potions-data.ts` оборачивает их в `new HealingPotion(...)` / `BuffPotion` / `UtilityPotion` для сохранения OOP-методов инвентаря);
  - `feats.ts`, `feat-prerequisites.ts`, `dnd-traits.ts`, `backgrounds.ts`.
- `getCompendiumAutocompleteItems` в `src/data/compendium/index.ts` продолжает собирать единый `AutocompleteItem[]` из тех же экспортов `DND_COMPENDIUM_*`, ничего в `AutocompleteInput.tsx` ломать не нужно.
- Локальными в листе остаются чисто UI/утилитарные данные: `names-data.ts` (генератор имён) и `src/data/encyclopedia/*` (статьи справки), если пользователь отдельно не запросит их перенос.

### 4.2. `ai_master_n_battle` (ветка `dev`)
- Этап 1:
  - Обновление `dnd-shared` до актуального SHA (после пуша 84 рас + фиксов совместимости).
  - `src/lib/combat/races/race-defs.ts` переходит с `./data/races-2014.json` на `RACES` и `findRace` из `dnd-shared/races`; удаляются `src/lib/combat/data/races-2014.json` и `scripts/sync-dnd-shared-races.mjs`.
  - `src/lib/combat/fighter-subclasses.ts` переходит с `./data/fighter-dndsu.json` на `FIGHTER_DATA` из `dnd-shared/fighter`; удаляется `src/lib/combat/data/fighter-dndsu.json`.
  - `src/lib/combat/srd/adapter.ts` переходит на `findSpell` из `dnd-shared` там, где это упрощает поиск (сохраняя `combatSpells("srd" | "expanded")` и все экспорты `library-data.ts`).
- Этапы 2–4:
  - `class-defs.ts` и `class-features.ts` переходят с `class-subclasses.json` и `srd-class-features*.json` на `dnd-shared/classes` (удаляется `scripts/import-sheet-classes.mjs`).
  - `srd/adapter.ts` переходит с `srd/data/equipment.json`, `srd/data/monsters.json` на `dnd-shared/items`, `dnd-shared/monsters`. `srd/data/conditions.json` в коде мастера никто не читал (состояния боя описаны в движке), поэтому файл просто удалён, а `dnd-shared/conditions` на сайте мастера не подключается: он нужен листу.
  - В `dnd-shared/classes` три подкласса, которых не было в прежних данных мастера: Рыцарь Пурпурного дракона (Воин, правила есть в `fighter-subclasses.ts`), Лунное чародейство (Чародей) и Магия гравитургии (Волшебник). Правила для двух последних появятся вместе с классами Чародей и Волшебник (см. план в `AGENTS.md`).
  - Боевая логика в `src/lib/combat/classes/*`, `src/lib/combat/races/*` и `engine.ts` не переносится в `dnd-shared` и продолжает работать поверх общих данных.

---

## 5. Фазовый план (Вариант A) и стратегия параллелизма

### Этап 1: Ядро (Заклинания + Расы + Воин + `scourgeborne`)
1. **Последовательно (подготовка `dnd-shared`):**
   - Проверить совместимость импорта JSON в `dnd-shared` с `next build` и `tsx` обоих сайтов.
   - Дополнить `scripts/build-races.py` и `data/races.json` / `data/races-core.json`: перенести `category` и `choices` (`RaceChoicesConfig`) из `dnd5e-character-sheet` в схему `dnd-shared/races` и `dnd-shared/races-core` (при необходимости расширив таблицу маппинга подрас/выборов).
   - Перенести `SPELL_ALIASES` в `dnd-shared` (`src/index.js` + `src/core.js`) и логику приоритета `Legacy` vs `MPMM` в `src/races.js` + `src/races-core.js`.
   - Добавить `dnd-shared/homebrew` со структурой `HOMEBREW_RACES` (`scourgeborne`) в `races-core`-совместимом виде.
   - Прогнать `node --test` в `dnd-shared`, запушить в `origin main`, зафиксировать `<SHA_1>`.
2. **Параллельно (2 агента на модели `hydrogen`):**
   - **Агент A (`dnd5e-character-sheet`, ветка `dev`):** подключить `dnd-shared#<SHA_1>`, перевести `spells/*`, `races/*`, `race-progression.ts`, прогнать `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (проверив отсутствие `combat`-данных в клиентском бандле), запушить в `origin dev`.
   - **Агент B (`ai_master_n_battle`, ветка `dev`):** обновить `dnd-shared#<SHA_1>`, перевести `race-defs.ts` и `fighter-subclasses.ts` на `dnd-shared`, удалить локальные дубликаты `races-2014.json` и `fighter-dndsu.json`, прогнать `npx tsc --noEmit`, `npm run lint`, `vitest`, `npm run build`, запушить в `origin dev`.

### Этап 2: Остальные 12 классов, 115+ подклассов, прогрессия 1–20, списки заклинаний и `alt-barbarian`
- Параллельный сбор/валидация данных по группам классов в `dnd-shared` (склейка `dnd.su` 2014 + `classes.ts` + `class-progression.ts` + `class-spells.ts` + `warlock-choices.ts` + `srd-class-features*`), перенос `alt-barbarian` и `barbarian-exploits` в `dnd-shared/homebrew` → тест + push `<SHA_2>` → параллельная интеграция в `dev` обоих сайтов.

### Этап 3: Оружие, доспехи, щиты, снаряжение, инструменты, зелья
- Объединение `DND_WEAPONS` + `items.ts` + `potions-data.ts` (чистые данные) + `srd/data/equipment.json` в `./items-core` и `./items` → тест + push `<SHA_3>` → параллельная интеграция в `dev` обоих сайтов.

### Этап 4: Черты, предыстории, состояния, монстры
- Перенос `feats.ts` + `feat-prerequisites.ts`, `backgrounds.ts`, `conditions.json` (с полными русскими переводами), `monsters.json` (только `./monsters` для мастера) → тест + push `<SHA_4>` → параллельная интеграция в `dev` обоих сайтов.

---

## 6. Версионирование, Git и критерии приёмки

- **Зависимость:** `"dnd-shared": "github:LightSix56/dnd-shared#<SHA>"` + актуальный `package-lock.json` в обоих сайтах.
- **Git-ветки:**
  - `dnd-shared`: релизы этапов пушатся в `origin main` (именно на их SHA ссылаются оба сайта).
  - `dnd5e-character-sheet` и `ai_master_n_battle`: вся разработка и тесты пушатся **только в `origin dev`**. В `ai_master_n_battle` при коммитах не затрагиваются уже имеющиеся сторонние незакоммиченные файлы в `src/lib/combat/procgen/*` и `src/app/dev-maps/`.
- **Ворота проверки каждого этапа:**
  1. `dnd-shared`: `node --test` (0 ошибок; проверка полноты описаний, отсутствия HTML, отсутствия `combat` в `-core`, 84 официальные расы отдельно от `./homebrew`).
  2. `dnd5e-character-sheet`: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (включая проверку `alternate-barbarian-and-scourgeborne.test.ts`, тестов визарда/левел-апа и размера клиентского бандла).
  3. `ai_master_n_battle`: `npx tsc --noEmit`, `npm run lint`, `npx vitest run --no-file-parallelism --testTimeout=60000` (и не забыть `git checkout -- prisma/schema.prisma`, если тест-скрипт переключал её на SQLite), `npm run build`.
  4. Обновление `graphify` (`graphify update .`) после изменений кода в обоих сайтах.
