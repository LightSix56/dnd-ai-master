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
  heroes: Array<{ id: string; x: number; y: number }>;
  enemies: Array<{ id: string; x: number; y: number }>;
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

/** Свободные клетки в границах карты, не занятые и не заблокированные */
function freeCells(input: FormationInput, taken: Set<string>): Spot[] {
  const cells: Spot[] = [];
  for (let x = 1; x < input.width - 1; x++) {
    for (let y = 1; y < input.height - 1; y++) {
      const k = key(x, y);
      if (!input.blocked.has(k) && !taken.has(k)) cells.push({ x, y });
    }
  }
  return cells;
}

/** Собирает группу плотным кружком вокруг центра: ближайшие к нему свободные клетки */
function clusterAround(center: Spot, ids: string[], input: FormationInput, taken: Set<string>, out: Map<string, Spot>): void {
  const sorted = freeCells(input, taken).sort((a, b) => cheb(a, center) - cheb(b, center) || Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y));
  ids.forEach((id, i) => {
    const spot = sorted[i];
    if (!spot) return;
    out.set(id, spot);
    taken.add(key(spot.x, spot.y));
  });
}

/**
 * Рассаживает группу кольцом вокруг центра: клетки на расстоянии minR..maxR (по клеткам, как ходит боец),
 * равномерно по углам, чтобы никто не стоял кучей с одной стороны. preferCover подтягивает бойцов к укрытиям.
 */
function ringAround(
  center: Spot,
  ids: string[],
  opts: { minR: number; maxR: number; targetR: number; preferCover: boolean },
  input: FormationInput,
  taken: Set<string>,
  out: Map<string, Spot>
): void {
  if (ids.length === 0) return;
  const candidates = freeCells(input, taken).filter((c) => {
    const d = cheb(c, center);
    return d >= opts.minR && d <= opts.maxR;
  });
  const nearCover = (c: Spot) => {
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (input.cover.has(key(c.x + dx, c.y + dy))) return true;
    return false;
  };
  ids.forEach((id, i) => {
    const wanted = (i * 2 * Math.PI) / ids.length;
    let best: Spot | null = null;
    let bestScore = Infinity;
    for (const c of candidates) {
      if (taken.has(key(c.x, c.y))) continue;
      const angle = Math.atan2(c.y - center.y, c.x - center.x);
      let diff = Math.abs(angle - wanted) % (2 * Math.PI);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      const score = diff * 4 + Math.abs(cheb(c, center) - opts.targetR) - (opts.preferCover && nearCover(c) ? 1.5 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = c;
      }
    }
    if (best) {
      out.set(id, best);
      taken.add(key(best.x, best.y));
    }
  });
}

/** Ближний контакт: враги остаются со своей стороны, но встают в 1–2 клетках от героев */
function closeContact(input: FormationInput, taken: Set<string>, out: Map<string, Spot>): void {
  const candidates = freeCells(input, taken).filter((c) => {
    const d = Math.min(...input.heroes.map((h) => cheb(c, h)));
    return d >= 1 && d <= 2;
  });
  for (const enemy of input.enemies) {
    let best: Spot | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      if (taken.has(key(c.x, c.y))) continue;
      const d = Math.hypot(c.x - enemy.x, c.y - enemy.y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (best) {
      out.set(enemy.id, best);
      taken.add(key(best.x, best.y));
    }
  }
}

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
  const heroIds = input.heroes.map((h) => h.id);
  const enemyIds = input.enemies.map((e) => e.id);
  const taken = new Set<string>();

  switch (input.formation) {
    case "close": {
      input.heroes.forEach((h) => taken.add(key(h.x, h.y)));
      closeContact(input, taken, positions);
      return { positions, surprised: null };
    }
    case "surrounded": {
      clusterAround(center, heroIds, input, taken, positions);
      ringAround(center, enemyIds, { minR: 2, maxR: 4, targetR: 3, preferCover: false }, input, taken, positions);
      return { positions, surprised: null };
    }
    case "ambush": {
      clusterAround(center, heroIds, input, taken, positions);
      ringAround(center, enemyIds, { minR: 3, maxR: 6, targetR: 4, preferCover: true }, input, taken, positions);
      return { positions, surprised: "heroes" };
    }
    case "party_ambush": {
      clusterAround(center, enemyIds, input, taken, positions);
      ringAround(centroid(enemyIds.map((id) => positions.get(id) ?? center)), heroIds, { minR: 3, maxR: 6, targetR: 4, preferCover: true }, input, taken, positions);
      return { positions, surprised: "enemies" };
    }
  }
}
