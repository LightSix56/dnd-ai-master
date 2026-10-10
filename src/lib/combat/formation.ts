// Расстановка сторон в начале боя.
//
// Мастер выбирает по сюжету, как именно началась схватка: враги вдалеке, налетели из засады,
// напали вплотную, окружили или попали в засаду сами. От этого зависят и клетки, и внезапность:
// застигнутая сторона пропускает первый ход (состояние «surprised», правила D&D 5e).
// Всё считается только для тех, кто вышел на карту: расстановка получает уже готовые списки.

export const FORMATIONS = ["standard", "ambush", "close", "surrounded", "party_ambush"] as const;
export type Formation = (typeof FORMATIONS)[number];

export const FORMATION_LABELS: Record<Formation, string> = {
  standard: "стороны друг напротив друга на расстоянии",
  ambush: "засада на отряд: враги вокруг героев и в укрытиях, герои застигнуты врасплох",
  close: "ближний контакт: враги в 1–2 клетках от героев",
  surrounded: "окружение: враги со всех сторон, отряд в центре",
  party_ambush: "засада героев: враги застигнуты врасплох и в центре, герои вокруг них",
};

export interface Spot {
  x: number;
  y: number;
}

export interface FormationInput {
  formation: Formation;
  width: number;
  height: number;
  /** Клетки, на которые нельзя ставить бойцов (стены, препятствия, вода, лава) */
  blocked: Set<string>;
  /** Клетки с укрытиями: засадники предпочитают стоять рядом с ними */
  cover: Set<string>;
  /** size — сторона клеток существа (крупный 2, огромный 3): бойцу нужно место под всё его тело */
  heroes: Array<{ id: string; x: number; y: number; size?: number }>;
  enemies: Array<{ id: string; x: number; y: number; size?: number }>;
}

interface Unit {
  id: string;
  size: number;
}

export interface FormationResult {
  positions: Map<string, Spot>;
  /** Кто застигнут врасплох и пропускает первый ход */
  surprised: "heroes" | "enemies" | null;
}

const key = (x: number, y: number) => `${x},${y}`;
const cheb = (a: Spot, b: Spot) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export function isFormation(value: unknown): value is Formation {
  return typeof value === "string" && (FORMATIONS as readonly string[]).includes(value);
}

function centroid(points: Spot[]): Spot {
  if (points.length === 0) return { x: 0, y: 0 };
  const sum = points.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: Math.round(sum.x / points.length), y: Math.round(sum.y / points.length) };
}

/** Клетки тела существа, чей левый верхний угол в (x, y) */
function footprint(x: number, y: number, size: number): string[] {
  const keys: string[] = [];
  for (let dx = 0; dx < size; dx++) for (let dy = 0; dy < size; dy++) keys.push(key(x + dx, y + dy));
  return keys;
}

function occupy(spot: Spot, size: number, taken: Set<string>): void {
  for (const k of footprint(spot.x, spot.y, size)) taken.add(k);
}

/** Расстояние в клетках от точки до тела существа с левым верхним углом в spot */
function gapToBody(spot: Spot, size: number, p: Spot): number {
  const dx = Math.max(0, spot.x - p.x, p.x - (spot.x + size - 1));
  const dy = Math.max(0, spot.y - p.y, p.y - (spot.y + size - 1));
  return Math.max(dx, dy);
}

/** Свободные места в границах карты: всё тело существа на свободных, не заблокированных клетках */
function freeCells(input: FormationInput, taken: Set<string>, size = 1): Spot[] {
  const cells: Spot[] = [];
  for (let x = 1; x + size <= input.width - 1; x++) {
    for (let y = 1; y + size <= input.height - 1; y++) {
      if (footprint(x, y, size).every((k) => !input.blocked.has(k) && !taken.has(k))) cells.push({ x, y });
    }
  }
  return cells;
}

/** Крупные существа ставятся первыми: им труднее найти место, а порядок углов в кольце сохраняется по индексу */
const bySizeDesc = <T extends Unit>(units: T[]) => units.map((u, i) => ({ u, i })).sort((a, b) => b.u.size - a.u.size || a.i - b.i);

/** Собирает группу плотным кружком вокруг центра: ближайшие к нему свободные клетки */
function clusterAround(center: Spot, units: Unit[], input: FormationInput, taken: Set<string>, out: Map<string, Spot>): void {
  for (const { u } of bySizeDesc(units)) {
    const spot = freeCells(input, taken, u.size).sort(
      (a, b) => gapToBody(a, u.size, center) - gapToBody(b, u.size, center) || Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y)
    )[0];
    if (!spot) continue;
    out.set(u.id, spot);
    occupy(spot, u.size, taken);
  }
}

/**
 * Сколько шагов пешком от группы до каждой клетки (8 направлений, стены и вода не проходятся).
 * Нужно, чтобы засадники и враги вплотную стояли в том же помещении, а не по ту сторону стены.
 */
function walkDistances(seeds: Spot[], input: FormationInput): Map<string, number> {
  const dist = new Map<string, number>();
  const queue: Spot[] = [];
  for (const seed of seeds) {
    dist.set(key(seed.x, seed.y), 0);
    queue.push(seed);
  }
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const d = dist.get(key(cur.x, cur.y)) ?? 0;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = cur.x + dx;
        const ny = cur.y + dy;
        const k = key(nx, ny);
        if (nx < 0 || ny < 0 || nx >= input.width || ny >= input.height || input.blocked.has(k) || dist.has(k)) continue;
        dist.set(k, d + 1);
        queue.push({ x: nx, y: ny });
      }
    }
  }
  return dist;
}

/**
 * Рассаживает группу кольцом вокруг центра: клетки на расстоянии minR..maxR (по клеткам, как ходит боец),
 * равномерно по углам, чтобы никто не стоял кучей с одной стороны. preferCover подтягивает бойцов к укрытиям.
 */
function ringAround(
  center: Spot,
  units: Unit[],
  opts: { minR: number; maxR: number; targetR: number; preferCover: boolean },
  anchors: Spot[],
  input: FormationInput,
  taken: Set<string>,
  out: Map<string, Spot>
): void {
  if (units.length === 0) return;
  const walk = walkDistances(anchors, input);
  const nearCover = (c: Spot) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (input.cover.has(key(c.x + dx, c.y + dy))) return true;
    return false;
  };
  for (const { u, i } of bySizeDesc(units)) {
    const wanted = (i * 2 * Math.PI) / units.length;
    let best: Spot | null = null;
    let bestScore = Infinity;
    const free = freeCells(input, taken, u.size);
    // На тесной карте кольцо может оказаться занято стенами: расширяем его, но не оставляем бойца на прежнем месте вдалеке
    // Пешком до героев — не больше чем вдвое дальше прямой: за стеной в соседнем помещении засады нет
    const bands: Array<[number, number, boolean]> = [
      [opts.minR, opts.maxR, true],
      [opts.minR, opts.maxR + 2, true],
      [1, opts.maxR + 4, true],
      [1, opts.maxR + 4, false],
    ];
    let candidates: Spot[] = [];
    for (const [lo, hi, nearOnly] of bands) {
      candidates = free.filter((c) => {
        const d = gapToBody(c, u.size, center);
        return d >= lo && d <= hi && (!nearOnly || (walk.get(key(c.x, c.y)) ?? Infinity) <= hi * 2);
      });
      if (candidates.length > 0) break;
    }
    for (const c of candidates) {
      const angle = Math.atan2(c.y - center.y, c.x - center.x);
      let diff = Math.abs(angle - wanted) % (2 * Math.PI);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      const score = diff * 4 + Math.abs(gapToBody(c, u.size, center) - opts.targetR) - (opts.preferCover && nearCover(c) ? 1.5 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best) {
      out.set(u.id, best);
      occupy(best, u.size, taken);
    }
  }
}

/** Ближний контакт: враги остаются со своей стороны, но встают в 1–2 клетках от героев */
function closeContact(input: FormationInput, taken: Set<string>, out: Map<string, Spot>): void {
  const units = input.enemies.map((e) => ({ id: e.id, size: e.size ?? 1, x: e.x, y: e.y }));
  const walk = walkDistances(input.heroes, input);
  for (const { u: enemy } of bySizeDesc(units)) {
    const free = freeCells(input, taken, enemy.size);
    const gap = (c: Spot) => Math.min(...input.heroes.map((h) => gapToBody(c, enemy.size, h)));
    // Сначала 1–2 клетки от героев; если вокруг не осталось места (герои у края, толпа), отодвигаемся шаг за шагом
    let candidates: Spot[] = [];
    for (const maxGap of [2, 3, 4, 6]) {
      candidates = free.filter((c) => gap(c) >= 1 && gap(c) <= maxGap && (walk.get(key(c.x, c.y)) ?? Infinity) <= maxGap * 2);
      if (candidates.length > 0) break;
    }
    let best: Spot | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.hypot(c.x - enemy.x, c.y - enemy.y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (best) {
      out.set(enemy.id, best);
      occupy(best, enemy.size, taken);
    }
  }
}

const spotsOf = (units: Unit[], positions: Map<string, Spot>): Spot[] => units.flatMap((u) => positions.get(u.id) ?? []);

/**
 * Считает клетки сторон и кто застигнут врасплох. Для standard ничего не меняет.
 * Если места не хватило (тесная карта), бойцы остаются на прежних клетках.
 */
export function planFormation(input: FormationInput): FormationResult {
  const positions = new Map<string, Spot>();
  if (input.formation === "standard" || input.heroes.length === 0 || input.enemies.length === 0) {
    return { positions, surprised: null };
  }
  const center = { x: Math.floor(input.width / 2), y: Math.floor(input.height / 2) };
  const heroes: Unit[] = input.heroes.map((h) => ({ id: h.id, size: h.size ?? 1 }));
  const enemies: Unit[] = input.enemies.map((e) => ({ id: e.id, size: e.size ?? 1 }));
  const taken = new Set<string>();

  switch (input.formation) {
    case "close": {
      input.heroes.forEach((h) => occupy(h, h.size ?? 1, taken));
      closeContact(input, taken, positions);
      return { positions, surprised: null };
    }
    case "surrounded": {
      clusterAround(center, heroes, input, taken, positions);
      ringAround(center, enemies, { minR: 2, maxR: 4, targetR: 3, preferCover: false }, spotsOf(heroes, positions), input, taken, positions);
      return { positions, surprised: null };
    }
    case "ambush": {
      clusterAround(center, heroes, input, taken, positions);
      ringAround(center, enemies, { minR: 3, maxR: 6, targetR: 4, preferCover: true }, spotsOf(heroes, positions), input, taken, positions);
      return { positions, surprised: "heroes" };
    }
    case "party_ambush": {
      clusterAround(center, enemies, input, taken, positions);
      ringAround(centroid(enemies.map((e) => positions.get(e.id) ?? center)), heroes, { minR: 3, maxR: 6, targetR: 4, preferCover: true }, spotsOf(enemies, positions), input, taken, positions);
      return { positions, surprised: "enemies" };
    }
  }
}
