# Процедурные карты биомов — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** бой получает карту своего биома (пещера, лава, подземелье, таверна, лес, болото, пустыня, снег, горы, побережье, город), собранную по зерну, с разметкой и зонами; стены на тактическом слое обводятся одной линией.

**Architecture:** все генераторы отдают общий `ProcgenLayout`; общая разметка и зоны строят из него `TacticalMapPreset`; общий рисовальщик рисует его по палитре биома. Пещера v1 идёт прежним путём (план, разметка и зоны не меняются).

**Tech Stack:** TypeScript, Next.js 16, React 19, Vitest, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-10-06-procedural-biome-maps-design.md`

## Global Constraints

- Карта 24×16 клеток, `SUB = 8`; случайность только из `createRng`; в procgen нет DOM, кроме рисовальщика.
- Ссылка: `procgen:<биом>?seed=<целое>&v=1`; `procgen:cave?seed=N&v=1` рисуется и размечается как раньше; золотой тест `v1-golden.test.ts` не меняется.
- Разметка: `ground` < 0,5 → `wall`; жидкость ≥ 0,35 → `water`/`lava`; декор по таблице спеки; `obstacle` непроходимо как стена.
- Зоны: все `areas` достижимы от партии, враги ≥ 8 шагов, засада ≥ 4 шагов и не в зоне врагов, зоны ≥ 8 клеток; провал → `seed + 1`, ≤ 20 попыток.
- Тесты: `npx vitest run <файл>`; полный прогон — `npm run db:generate`, затем `npx vitest run --no-file-parallelism --testTimeout=60000`, затем `git checkout -- prisma/schema.prisma`.

## Review Focus

- Открытая карта без внешних стен: зоны партии и врагов не должны оказаться на одном краю, если карта перегорожена рекой или грядой — путь обязан существовать (BFS с учётом `obstacle`). Тест в Task 1 (зоны) и Task 4.
- Дерево или колонна на клетке узкого коридора не должны перекрыть единственный путь: прорезка `paths` снимает и `obstacle`/`cover` с осевых клеток. Тест в Task 1.
- Город: дом не должен накрыть зону появления или отрезать улицу. Покрыто общим набором 200 зёрен (Task 5).
- Название биома в любом регистре и с пробелами (`" Forest "`, `"forest_ambush"`) приводится к своему генератору. Тест в Task 1.
- Старые бои с `procgen:cave` после смены рисовальщика рисуются без ошибок. Тест в Task 6.

---

### Task 1: Общее ядро: типы, биомы, ссылки, разметка, зоны

**Files:**
- Create: `src/lib/combat/procgen/layout.ts`, `src/lib/combat/procgen/biomes.ts`, `src/lib/combat/procgen/classify.ts`, `src/lib/combat/procgen/areas.ts`
- Modify: `src/lib/combat/procgen/index.ts` (ссылки, диспетчер)
- Test: `src/lib/combat/procgen/__tests__/core.test.ts`

**Interfaces:**
- Produces:
  ```ts
  type ProcgenBiome = "cave" | "lava" | "dungeon" | "tavern" | "forest" | "swamp" | "desert" | "snow" | "mountain" | "coastal" | "urban";
  type DecorKind = "boulder" | "rubble" | "stalagmite" | "tree" | "bush" | "reed" | "rock" | "cactus" | "dune" | "ice" | "pine"
    | "column" | "crate" | "barrel" | "table" | "counter" | "cart" | "well" | "stall";
  interface Decor { kind: DecorKind; x: number; y: number; r: number; w?: number; h?: number } // клетки; w/h — для прямоугольных (стол, стойка, телега)
  interface Area { cx: number; cy: number; rx: number; ry: number }
  type Polyline = { x: number; y: number }[];
  interface ProcgenLayout { biome: ProcgenBiome; seed: number; width: number; height: number;
    ground: Field; liquid: Field; decor: Decor[]; areas: Area[]; flankAreas: Area[]; paths: Polyline[];
    structures: { x: number; y: number; w: number; h: number }[] } // дома/комнаты в клетках — для рисовальщика
  ```
  - `resolveProcgenBiome(name: string | null | undefined): ProcgenBiome` — по ключевым словам (`lava`→lava, `tavern|inn`→tavern, `dungeon|prison|crypt|tomb|sewer|tower|castle`→dungeon, `forest|bandit|spider`→forest, `swamp|bog`→swamp, `desert|dune|pyramid`→desert, `snow|ice`→snow, `mountain|chasm|mine`→mountain, `coast|ship|dock|harbor|sea`→coastal, `urban|city|street|town`→urban, `cave|underdark`→cave), иначе `cave`.
  - `LIQUID: Record<ProcgenBiome, "water" | "lava">` — `lava` только у `lava`.
  - `DECOR_CELL: Record<DecorKind, CellKind | null>` по таблице спеки (`stalagmite`, `pine`-крона нет — `pine` = `obstacle`).
  - `CellKind` расширяется: `"floor" | "wall" | "water" | "lava" | "cover" | "difficult" | "obstacle"`; `mergeToElements` (markup.ts) получает подписи `lava` «Лава», `obstacle` «Препятствие».
  - `classifyLayout(layout: ProcgenLayout): CellKind[][]` — пороги, декор (прямоугольный декор занимает все клетки w×h), затем прорезка `paths` (4-связно, снимает `wall`/`obstacle`/`cover` с осевых клеток).
  - `buildAreaZones(layout: ProcgenLayout, cells: CellKind[][]): SpawnZoneDefinition[] | null` — правила Global Constraints; непроходимы `wall` и `obstacle`.
  - `formatProcgenUrl(seed: number, biome: ProcgenBiome = "cave"): string`; `parseProcgenUrl(url): { biome: ProcgenBiome; seed: number; version: 1 } | null`.
  - `generateProcgenMap(biome, seed)`: `resolveProcgenBiome(biome)`; `cave` — прежний путь; иначе — `GENERATORS[biome](seed)` → `classifyLayout` → `buildAreaZones` → пресет. До Task 2–5 `GENERATORS` пуст, остальные биомы временно — пещера.

- [ ] **Step 1:** тесты: `resolveProcgenBiome` для `"forest_ambush"`, `" Forest "`, `"city_street"`, `"lava_cave"`, `"dungeon_prison"`, `"ship"`, `"?"`→cave; `parseProcgenUrl` для каждого биома и `null` для `procgen:volcano?seed=1&v=1`; `classifyLayout` на ручном плане 6×4: стол 2×1 → две клетки `cover`, дерево → `obstacle`, лава → `lava` при `LIQUID.lava`, путь через `obstacle` его снимает; `buildAreaZones` на ручном плане с перегородкой из `obstacle` без прохода → `null`.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3:** реализовать.
- [ ] **Step 4:** запуск + `procgen-map.test.ts` + `v1-golden.test.ts` → PASS.
- [ ] **Step 5:** commit `feat(procgen): shared layout, biome resolution, markup and zones`.

### Task 2: Лава и общий набор проверок биомов

**Files:**
- Create: `src/lib/combat/procgen/gen-lava.ts`
- Test: `src/lib/combat/procgen/__tests__/biomes.test.ts`, `src/lib/combat/procgen/__tests__/biomes-golden.test.ts`

**Interfaces:**
- Consumes: `generateCaveLayout`, Task 1.
- Produces: `generateLavaLayout(seed: number): ProcgenLayout` — план пещеры, `liquid` = её вода, у которой с вероятностью 1 есть хотя бы одно озеро (если в пещере воды нет — озеро в случайном зале, кроме первого); `areas` = залы, `flankAreas` = ниши, `paths` = проходы. `GENERATORS.lava`.
- Набор `biomes.test.ts` параметризован списком `BIOMES_UNDER_TEST` (сначала `["lava"]`, дополняется в Task 3–5): одно зерно → одинаковые элементы и зоны; 200 зёрен — правила Global Constraints; ссылка фона `procgen:<биом>?…`. `biomes-golden.test.ts` — отпечаток `classifyLayout` и `ground/liquid/decor` для зёрен 1, 42, -7 каждого биома.

- [ ] Steps 1–5 по шаблону (тесты → FAIL → реализация → PASS → commit `feat(procgen): lava caves`).

### Task 3: Подземелье и таверна

**Files:** Create `src/lib/combat/procgen/gen-dungeon.ts`; Modify `biomes.test.ts`, `biomes-golden.test.ts` (добавить `dungeon`, `tavern`).

**Interfaces:**
- Produces: `generateDungeonLayout(seed: number, variant: "dungeon" | "tavern"): ProcgenLayout`; `GENERATORS.dungeon`, `GENERATORS.tavern`.

Алгоритм: 4–7 комнат-прямоугольников (стороны 3–7 клеток, отступ ≥ 1 от края и ≥ 1 между комнатами), коридоры по остовному дереву центров — Г-образные, ширина 1 (с вероятностью 0,3 — 2); `ground` = комнаты + коридоры без шума (чёткие стены), `structures` = комнаты, `paths` = коридоры, `areas` = комнаты, `flankAreas` = комнаты-тупики (степень 1), кроме двух выбранных под партию/врагов. Декор подземелья: колонны в комнатах ≥ 5×5 (по углам внутренней части), ящики и бочки у стен, щебень; таверна — 1 стойка (`counter`, 3–5×1 у стены самой большой комнаты), 2–5 столов 1×1/2×1, бочки.

- [ ] Steps 1–5 (тесты: набор + золото для двух биомов → FAIL → реализация → PASS → commit `feat(procgen): dungeon and tavern maps`).

### Task 4: Природа

**Files:** Create `src/lib/combat/procgen/gen-outdoor.ts`; Modify тесты (добавить `forest`, `swamp`, `desert`, `snow`, `mountain`, `coastal`).

**Interfaces:** `generateOutdoorLayout(seed: number, biome: "forest" | "swamp" | "desert" | "snow" | "mountain" | "coastal"): ProcgenLayout`; `GENERATORS` для шести биомов.

Алгоритм: `ground` = 1 везде (у `mountain` — 1–3 скальные гряды: толстые ломаные с шумом → `ground` 0, через каждую прорезается проход ≥ 2 клеток, он же в `paths`; у `coastal` — `ground` 1, а полоса моря 3–5 клеток вдоль случайного края — `liquid`). `areas` — две области у противоположных краёв (запад/восток или север/юг, для `coastal` — вдоль берега), `flankAreas` — середины двух других краёв. Детали по биому:
- `forest`: 10–18 деревьев группами (`tree`, r 0.35–0.5), кусты (`bush`) 6–12, тропа-ломаная от одной области к другой (`paths`, арт), ручей с вероятностью 0,4 (полоса `liquid` шириной 1 с бродом ≥ 2 клеток, брод — `paths`).
- `swamp`: 4–8 луж `liquid` 1–2.5 клетки, камыш (`reed`) 10–20, 3–6 деревьев.
- `desert`: барханы (`dune`, пятна difficult) 4–8, скалы (`rock`) 3–6, кактусы (`cactus`) 3–6.
- `snow`: ели (`pine`) 6–12, валуны (`boulder`) 4–8, наледь (`ice`) 4–8 пятен.
- `mountain`: гряды (см. выше), валуны 6–10, `rock` 2–4.
- `coastal`: море, камни (`rock`) 3–6, валуны 3–6.
Декор не ставится в `areas` ближе 1 клетки к их центру и на `paths`.

- [ ] Steps 1–5 (commit `feat(procgen): forest, swamp, desert, snow, mountain and coastal maps`).

### Task 5: Город

**Files:** Create `src/lib/combat/procgen/gen-city.ts`; Modify тесты (добавить `urban`).

**Interfaces:** `generateCityLayout(seed: number): ProcgenLayout`; `GENERATORS.urban`.

Алгоритм: улицы — 1–2 горизонтальные и 1–2 вертикальные полосы шириной 2–3 клетки со смещением; кварталы между ними заполняются домами-прямоугольниками (3–6 × 3–5) с переулками шириной 1 между частью домов; `ground` = 0 под домами (`structures` = дома), `paths` = оси улиц и переулков; площадь на пересечении с колодцем (`well`); телеги (`cart`, 2×1), ящики и бочки, лотки (`stall`, 2×1 cover) вдоль улиц; `areas` — концы самой длинной улицы, `flankAreas` — переулки.

- [ ] Steps 1–5 (commit `feat(procgen): city maps`).

### Task 6: Рисовальщик всех биомов

**Files:**
- Create: `src/lib/combat/procgen/render-map.ts`, `src/lib/combat/procgen/palettes.ts`; текстуры `public/textures/cc0/{grass-a,grass-b,sand,stone-tiles,wood-floor,brick,dirt-path}.png` (+ запись в `LICENSE.txt`)
- Modify: `src/components/combat/useProcgenBackground.ts` (любой биом; кэш по ссылке), `src/lib/combat/procgen/index.ts`
- Remove: `src/lib/combat/procgen/render-cave.ts` (пещера рисуется общим рисовальщиком с палитрой `cave`)
- Test: `src/components/combat/__tests__/procgen-background.test.ts`

**Interfaces:**
- `layoutForUrl(url: string): ProcgenLayout | null` (index.ts) — план по ссылке (для пещеры — через адаптер `caveToLayout`).
- `renderMapToCanvas(layout: ProcgenLayout, textures: Record<string, CanvasImageSource>, cellPx: number): HTMLCanvasElement`.
- `PALETTES: Record<ProcgenBiome, Palette>` — текстуры земли (2), сплошное (`"rock" | "brick" | "roof"`), тонировка земли (снег), жидкость, свечение лавы.
- `resolveBackgroundHref`: `procgen:<любой биом>` → `{ kind: "procgen", url }`.

- [ ] **Step 1:** тесты `resolveBackgroundHref` для `procgen:forest?seed=1&v=1`, `procgen:cave?seed=3&v=1` (старые бои), битых ссылок.
- [ ] **Step 2:** FAIL. **Step 3:** реализовать; текстуры вырезать из листов CC0 как в Task 5 пещеры. **Step 4:** PASS, `tsc`, `lint`.
- [ ] **Step 5:** визуально: стенд Vite (как для пещеры) — все 11 биомов по 2 зерна, с разметкой; скриншоты пользователю.
- [ ] **Step 6:** commit `feat(combat): render all procedural biomes in the browser`.

### Task 7: Обводка стен

**Files:** Create `src/components/combat/wall-outline.ts`; Modify `src/components/combat/CombatGrid.tsx` (ветка `el.type === "wall"` тактического слоя); Test `src/components/combat/__tests__/wall-outline.test.ts`.

**Interfaces:** `wallOutlineSegments(elements: MapElement[], width: number, height: number): { x1: number; y1: number; x2: number; y2: number }[]` — в клетках; ребро клетки стены, за которым свободная клетка (не край карты); соседние коллинеарные рёбра склеиваются.

- [ ] **Step 1:** тест: сетка 3×3, стена — левый столбец (x=0) → один отрезок `{x1:1,y1:0,x2:1,y2:3}`; стена 3×3 целиком → пусто; одиночная стена в центре → 4 отрезка.
- [ ] Steps 2–5 (CombatGrid: стены — один `<path>` по отрезкам, `obstacle` — тонкий контур элемента; commit `feat(combat): outline walls along their border only`).

### Task 8: Проверка целиком

- [ ] `npx tsc --noEmit`, `npm run lint` (кроме известных 4 ошибок `DnDApp.tsx`), полный прогон тестов (кроме известного теста парсера).
- [ ] Push в `dev`.
