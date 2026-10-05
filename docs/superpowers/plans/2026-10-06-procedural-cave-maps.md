# Процедурные карты пещеры — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** каждый бой получает новую пещеру, собранную по зерну, с разметкой, совпадающей с артом, который рисует браузер.

**Architecture:** чистый TS-модуль `src/lib/combat/procgen/` строит план по зерну и отдаёт `TacticalMapPreset` (разметка + зоны + фон `procgen:cave?seed=N&v=1`). Сервер использует его вместо готовых пресетов; `CombatGrid` по той же ссылке пересобирает план и рисует арт на canvas.

**Tech Stack:** TypeScript, Next.js 16, React 19, Prisma, Vitest, Canvas 2D.

**Spec:** `docs/superpowers/specs/2026-10-06-procedural-cave-maps-design.md`

## Global Constraints

- В `src/lib/combat/procgen/` нет `Math.random`, DOM и canvas, кроме `render-cave.ts`.
- Субклеточное разрешение: 8×8 отсчётов на клетку. Размер карты по умолчанию 24×16.
- Пороги разметки: доля пола < 0,5 → `wall`; лужа ≥ 0,35 клетки → `water`; крупный валун → `cover` (`coverType: "half"`); щебень в проходе → `difficult`.
- Ссылка фона: `procgen:cave?seed=<целое>&v=1`.
- При провале проверки — `seed + 1`, не более 20 попыток; затем — ошибка.
- Текстуры — `public/textures/cc0/` + `LICENSE.txt` (Screaming Brain Studios, Top Down Dungeon Pack, CC0).
- Тесты — `npx vitest run <файл>`; полный прогон — `npx vitest run --no-file-parallelism --testTimeout=60000` после `npm run db:generate`; `prisma/schema.prisma` не коммитить.

## Review Focus

- Узкий проход в 1 клетку, перекрытый валуном-укрытием или водой, не должен отрезать партию: укрытие и вода проходимы, стенами считаются только `wall`. Тест в Task 3.
- Большая партия (6 героев + спутники) и большой отряд врагов (до 12) должны поместиться в зоны: в каждой зоне не меньше 8 клеток пола. Тест в Task 3.
- Неверная ссылка `procgen:` (без зерна, чужой биом, `v=2`) не должна ронять сетку боя: `parseProcgenUrl` возвращает `null`, показывается тёмный фон. Тест в Task 3.
- Отрицательное и очень большое зерно (`-5`, `2**31`) дают валидную карту. Тест в Task 2.
- Бой, созданный до изменений, со старым `backgroundUrl` `/maps/*.jpg` после архивации показывает тёмный фон без ошибок в консоли. Проверка в Task 6.

---

### Task 1: Генератор случайных чисел и субклеточные поля

**Files:**
- Create: `src/lib/combat/procgen/rng.ts`, `src/lib/combat/procgen/field.ts`
- Test: `src/lib/combat/procgen/__tests__/field.test.ts`

**Interfaces:**
- Produces:
  - `createRng(seed: number): Rng`, где `Rng = { next(): number /*[0,1)*/; int(min: number, max: number): number /*включительно*/; pick<T>(arr: T[]): T }` — mulberry32, зерно приводится `seed >>> 0`.
  - `class Field { constructor(w: number, h: number, fill?: number); w; h; data: Float32Array; get(x,y); set(x,y,v); }`
  - `valueNoise(rng: Rng, w: number, h: number, cellsAcross: number, octaves: number): Field` — значения в [0,1].
  - `blurField(f: Field, radius: number): Field` — три прохода box-фильтра по осям, края — повтор крайнего значения.
  - `SUB = 8` — отсчётов на клетку.

- [ ] **Step 1:** тесты `createRng(42)` дважды → одинаковые первые 5 чисел; `createRng(42)` ≠ `createRng(43)`; `int(1,3)` за 1000 вызовов даёт только 1..3 и все три; `valueNoise` одинаковый для одинакового зерна и в [0,1]; `blurField` поля с одной единицей в центре сохраняет сумму (±1%) и уменьшает максимум.
- [ ] **Step 2:** `npx vitest run src/lib/combat/procgen/__tests__/field.test.ts` → FAIL (модулей нет).
- [ ] **Step 3:** реализовать `rng.ts` и `field.ts` по интерфейсам.
- [ ] **Step 4:** тот же запуск → PASS.
- [ ] **Step 5:** commit `feat(procgen): seeded rng and sub-cell fields`.

### Task 2: План пещеры из заготовленных частей

**Files:**
- Create: `src/lib/combat/procgen/cave.ts`
- Test: `src/lib/combat/procgen/__tests__/cave.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  ```ts
  type ChamberShape = "round" | "long" | "ragged";
  type PassageKind = "narrow" | "wide" | "winding"; // ширина 1 / 2 / 1 клетка
  interface Chamber { cx: number; cy: number; rx: number; ry: number; shape: ChamberShape } // в клетках
  interface Passage { from: number; to: number; kind: PassageKind; points: {x:number;y:number}[] } // индексы залов, точки в клетках
  interface Decor { kind: "boulder" | "rubble" | "stalagmite"; x: number; y: number; r: number } // x,y в клетках, r в долях клетки
  interface CaveLayout {
    seed: number; width: number; height: number;
    chambers: Chamber[]; passages: Passage[]; niches: Chamber[];
    floor: Field;   // (width*SUB)×(height*SUB), 1 = пол, 0 = скала, сглаженные края
    water: Field;   // та же размерность, 1 = вода
    decor: Decor[];
  }
  function generateCaveLayout(seed: number, size?: { width: number; height: number }): CaveLayout
  ```

Алгоритм (не определяется тестами):
1. 2–4 зала: центры по сетке 2×2 зон карты со случайным сдвигом, `rx,ry` 2.5–5 клеток, отступ от края ≥ 1 клетки.
2. Проходы — остовное дерево по расстоянию между центрами (Прим) + с вероятностью 0,3 одно лишнее ребро. Вид прохода случайный; `winding` — ломаная из 3–5 точек со смещением ±1 клетка.
3. 0–2 ниши (`rx,ry` 1.5–2.5) от случайного прохода, соединённые узким проходом.
4. Поле пола: залы как эллипсы с радиусом, модулированным шумом (рваный — сильнее); проходы — толстые линии нужной ширины; затем `blurField(…, SUB*0.6)` + `(valueNoise−0.5)·0.5`, порог 0.5, сглаживание `blurField(…, 1)`.
5. Вода: в одном случайном зале, кроме первого, с вероятностью 0,6 — эллипс 1.5–2.5 клетки, пересечённый с полом.
6. Декор: 6–12 валунов `r` 0.25–0.4 у стен залов (не в воде); щебень `r` 0.05–0.1 по 6–10 штук вдоль каждого узкого/извилистого прохода; 0–4 сталагмита `r` 0.15–0.25.

- [ ] **Step 1:** тесты: одинаковое зерно → `JSON.stringify` залов, проходов, декора и сумма `floor.data` совпадают; разные зёрна → разные залы; `chambers.length` в 2..4; размеры полей = `24*8 × 16*8`; клетки по краю карты (рамка в 1 клетку) имеют долю пола < 0.5; зёрна `-5`, `2**31`, `0` не бросают ошибку.
- [ ] **Step 2:** запуск теста → FAIL.
- [ ] **Step 3:** реализовать `generateCaveLayout`.
- [ ] **Step 4:** запуск теста → PASS.
- [ ] **Step 5:** commit `feat(procgen): cave layout from chambers, passages and niches`.

### Task 3: Разметка, зоны и `generateProcgenMap`

**Files:**
- Create: `src/lib/combat/procgen/markup.ts`, `src/lib/combat/procgen/zones.ts`, `src/lib/combat/procgen/index.ts`
- Test: `src/lib/combat/procgen/__tests__/procgen-map.test.ts`

**Interfaces:**
- Consumes: Task 2; `MapElement` из `src/lib/combat/types.ts`; `TacticalMapPreset`, `SpawnZoneDefinition`, `BiomeType` из `src/lib/combat/maps/types.ts`.
- Produces:
  - `type CellKind = "floor" | "wall" | "water" | "cover" | "difficult"`
  - `classifyCells(layout: CaveLayout): CellKind[][]` — `[y][x]`, пороги из Global Constraints; `cover` — клетка с центром валуна, `difficult` — клетка с щебнем; стена/вода важнее декора.
  - `mergeToElements(cells: CellKind[][]): MapElement[]` — прямоугольники одного типа (жадно: сначала по строке, затем вниз), `id` `pg-<type>-<x>-<y>`, `properties.label` по-русски («Скала», «Подземное озеро», «Валун», «Щебень»), у `cover` — `coverType: "half"`.
  - `buildSpawnZones(layout: CaveLayout, cells: CellKind[][]): SpawnZoneDefinition[]` — `party` — клетки пола зала, дальнего (BFS) от зала врагов; зал врагов — самый дальний по пути от зала партии; `enemy_frontline` — ближняя к партии половина его клеток, `enemy_backline` — дальняя; `ambush_flank` — клетки ниш (если есть).
  - `formatProcgenUrl(seed: number): string` → `procgen:cave?seed=<n>&v=1`
  - `parseProcgenUrl(url: string | null | undefined): { biome: "cave"; seed: number; version: 1 } | null`
  - `generateProcgenMap(biome: BiomeType | string, seed: number): TacticalMapPreset` — для любого биома пещера; `id` `procgen-cave-<seed>`, `name` «Пещера», `cellSizeFt` 5; проверка из спеки, при провале `seed+1` (≤ 20 попыток), иначе `throw new Error("Не удалось собрать карту пещеры")`.

- [ ] **Step 1:** тесты:
  - `generateProcgenMap("forest_ambush", 7)` дважды → одинаковые `elements` и `spawnZones`; `backgroundUrl === "procgen:cave?seed=7&v=1"` (или зерно, на котором прошла проверка);
  - для зёрен 1..200: BFS по клеткам, где нет `wall`, от любой клетки `party` достигает клетки `enemy_frontline`; ни одна клетка зон не попадает в `wall`/`water`; все элементы в границах 24×16; в `party` и в объединении `enemy_*` не меньше 8 клеток каждая;
  - среди зёрен 1..200 есть хотя бы одно, где в плане есть `narrow`-проход и все его точки лежат в клетках, у которых по обе стороны поперёк прохода — `wall`;
  - `mergeToElements` на сетке 3×2 `[["wall","wall","floor"],["wall","wall","floor"]]` → один элемент `wall` 2×2;
  - `parseProcgenUrl("procgen:cave?seed=12&v=1")` → `{biome:"cave",seed:12,version:1}`; `null` для `procgen:cave?v=1`, `procgen:forest?seed=1&v=1`, `procgen:cave?seed=1&v=2`, `/maps/cave.jpg`, `undefined`.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3:** реализовать модули.
- [ ] **Step 4:** запуск → PASS.
- [ ] **Step 5:** commit `feat(procgen): cell markup, spawn zones and procgen map preset`.

### Task 4: Подключение к созданию боя

**Files:**
- Modify: `src/lib/combat/encounters/encounter-generator.ts:239-246` (выбор карты)
- Modify: `src/lib/combat/generator.ts:960-1032` (фон боя и запись разметки)
- Test: `src/lib/combat/encounters/__tests__/encounter-procgen.test.ts`

**Interfaces:**
- Consumes: `generateProcgenMap`, `parseProcgenUrl` из Task 3.
- Produces: `EncounterRequest.mapSeed?: number` (в `src/lib/combat/encounters/types.ts`); без него зерно — `Math.floor(Math.random() * 2**31)` в `generateEncounter` (вне модуля procgen).

- [ ] **Step 1:** тесты (без БД): `generateEncounter({ party:[{id:"p1",name:"Пятно",level:1}], difficulty:"medium", biome:"forest_ambush", mapPresetId:"", mapSeed: 5 })` → `mapPreset.backgroundUrl` начинается с `procgen:cave?seed=`; у каждого врага и героя в `combatants` клетка не `wall` по `mapPreset.elements`; герои стоят в клетках зоны `party`.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3:** в `generateEncounter` заменить выбор пресета на `generateProcgenMap(request.biome || "cave", seed)`; биом для монстров — по-прежнему `request.biome`. В `createTacticalEncounter`: фон — только `mapPreset.backgroundUrl` (убрать `resolveBattlemapForNarrative`), разметку писать одним `db.mapElement.createMany({ data: [...] })`.
- [ ] **Step 4:** запуск теста → PASS; `npx tsc --noEmit` → 0 ошибок.
- [ ] **Step 5:** commit `feat(combat): battles use procedurally generated caves`.

### Task 5: Текстуры и отрисовка в браузере

**Files:**
- Create: `public/textures/cc0/cave-floor-a.png`, `cave-floor-b.png`, `cave-rock.png`, `public/textures/cc0/LICENSE.txt`
- Create: `src/lib/combat/procgen/render-cave.ts`
- Create: `src/components/combat/useProcgenBackground.ts`
- Modify: `src/components/combat/CombatGrid.tsx:330` (`href` фона)
- Test: `src/components/combat/__tests__/procgen-background.test.ts`

**Interfaces:**
- Consumes: `generateCaveLayout`, `parseProcgenUrl`.
- Produces:
  - `renderCaveToCanvas(layout: CaveLayout, textures: { floorA: CanvasImageSource; floorB: CanvasImageSource; rock: CanvasImageSource }, cellPx: number): HTMLCanvasElement`
  - `useProcgenBackground(backgroundUrl: string | null | undefined): string | null` — для `procgen:` возвращает `blob:`-ссылку после отрисовки (до неё `null`), для обычных ссылок — их же, для невалидной `procgen:` — `null`; отзывает `blob:` при смене ссылки/размонтировании.
  - `resolveBackgroundHref(url): { kind: "procgen"; seed: number } | { kind: "image"; href: string } | { kind: "none" }` — чистая функция внутри хука, её и тестировать.

Текстуры: ровные тайлы из листов `Floor-Dirt_02`, `Floor-Dirt_04`, `Wall-Stone_02` (выбор как в пробе: без пурпурных служебных тайлов), сохранить 128×128 (пол) и 192×192 (скала). Рендер повторяет пробу (`scratchpad/tiles/cave.py`): смешивание двух полов по маске шума, рельеф скалы по градиенту высоты (свет сверху-слева), затемнение вглубь скалы, тень у основания стен, тёмная кромка, вода, валуны с тенью, щебень, виньетка. Размытие — `ctx.filter = "blur(Npx)"` на промежуточных canvas. `cellPx = 70`.

- [ ] **Step 1:** тесты `resolveBackgroundHref`: `procgen:cave?seed=3&v=1` → `{kind:"procgen",seed:3}`; `/maps/x.jpg` → `{kind:"image",href:"/maps/x.jpg"}`; `procgen:cave?v=1`, `""`, `undefined` → `{kind:"none"}`.
- [ ] **Step 2:** запуск → FAIL.
- [ ] **Step 3:** подготовить текстуры и `LICENSE.txt`; реализовать `render-cave.ts`, хук и подключить в `CombatGrid` (`href` = результат хука; при `null` `<image>` не рендерится, остаётся тёмный `rect`).
- [ ] **Step 4:** тест → PASS; `npx tsc --noEmit`, `npm run lint` → 0 ошибок.
- [ ] **Step 5:** commit `feat(combat): render procedural caves on canvas in the browser`.

### Task 6: Архив старых карт и визуальная проверка

**Files:**
- Move: `public/maps/*` → `archive/maps/`
- Modify: `src/components/combat/MapPresetsModal.tsx` (убрать вкладки готовых пресетов и каталога открытых карт; оставить свою ссылку и `.dd2vtt`)
- Modify: `src/app/api/combat/maps/route.ts` (GET отдаёт пустой список)
- Modify: `src/lib/combat/maps/open-map-service.ts` (каталог пуст, `resolveBattlemapForNarrative` удалить, если больше нигде не используется)
- Modify: тесты, которые проверяют 24 карты/каталог, — под новое поведение.

- [ ] **Step 1:** `git grep -n "/maps/" src` → только `archive`-независимые места; исправить оставшиеся ссылки.
- [ ] **Step 2:** перенести файлы, убрать каталоги; поправить затронутые тесты.
- [ ] **Step 3:** `npm run db:generate`, затем `npx vitest run --no-file-parallelism --testTimeout=60000` → падает только известный тест парсера монстров; `npx tsc --noEmit`, `npm run lint` → 0 ошибок; `git checkout -- prisma/schema.prisma`.
- [ ] **Step 4:** визуально: локально `npm run dev` (SQLite), создать бой из чата или через `/api/combat/create`, открыть в браузере, скриншоты 3 разных зёрен; бой со старым `backgroundUrl` `/maps/cave.jpg` показывает тёмный фон, в консоли нет ошибок. Остановить dev-сервер.
- [ ] **Step 5:** commit `chore(maps): archive prebuilt battle maps`; push в `dev`.
