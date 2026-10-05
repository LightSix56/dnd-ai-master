// Зоны появления на процедурной карте: партия — в одном зале, враги — в самом дальнем
// от неё по пути зале, засада — в нише.

import type { Cell } from "../types";
import type { SpawnZoneDefinition } from "../maps/types";
import type { CaveLayout, Chamber } from "./cave";
import type { CellKind } from "./markup";

const PARTY_CELLS = 12;
const ENEMY_CELLS = 16;
/** Враги в начале боя — не ближе стольких шагов пути от партии */
const MIN_ENEMY_STEPS = 8;
/** Засада — не ближе стольких шагов пути от партии */
const MIN_FLANK_STEPS = 4;

/** Расстояния по проходимым клеткам (всё, кроме скалы) от стартовой клетки */
export function pathDistances(cells: CellKind[][], start: Cell | Cell[]): Map<string, number> {
  const h = cells.length;
  const w = cells[0].length;
  const dist = new Map<string, number>();
  const queue: Cell[] = [];
  for (const s of Array.isArray(start) ? start : [start]) {
    if (cells[s.y]?.[s.x] === undefined || cells[s.y][s.x] === "wall") continue;
    dist.set(`${s.x},${s.y}`, 0);
    queue.push(s);
  }
  for (let i = 0; i < queue.length; i++) {
    const c = queue[i];
    const d = dist.get(`${c.x},${c.y}`)!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = c.x + dx;
      const y = c.y + dy;
      const key = `${x},${y}`;
      if (x < 0 || y < 0 || x >= w || y >= h || dist.has(key) || cells[y][x] === "wall") continue;
      dist.set(key, d + 1);
      queue.push({ x, y });
    }
  }
  return dist;
}

/** Ближайшая к центру зала клетка, на которой можно стоять */
function anchor(cells: CellKind[][], room: Chamber): Cell | null {
  let best: Cell | null = null;
  let bestD = Infinity;
  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < cells[0].length; x++) {
      if (cells[y][x] !== "floor") continue;
      const d = Math.hypot(x + 0.5 - room.cx, y + 0.5 - room.cy);
      if (d < bestD) [best, bestD] = [{ x, y }, d];
    }
  }
  return best;
}

/** `count` клеток пола, ближайших по пути к старту, кроме уже занятых */
function nearestFloor(cells: CellKind[][], start: Cell, count: number, taken: Set<string>): Cell[] {
  return [...pathDistances(cells, start).entries()]
    .filter(([key]) => !taken.has(key))
    .map(([key, d]) => ({ cell: { x: Number(key.split(",")[0]), y: Number(key.split(",")[1]) }, d }))
    .filter(({ cell }) => cells[cell.y][cell.x] === "floor")
    .sort((a, b) => a.d - b.d || a.cell.y - b.cell.y || a.cell.x - b.cell.x)
    .slice(0, count)
    .map(({ cell }) => cell);
}

/**
 * Возвращает зоны или null, если на этой карте партия не может дойти до врагов
 * или зонам не хватает места.
 */
export function buildSpawnZones(layout: CaveLayout, cells: CellKind[][]): SpawnZoneDefinition[] | null {
  const anchors = layout.chambers.map((room) => anchor(cells, room));
  // Пара залов, самых далёких друг от друга по пути
  let pair: [number, number] | null = null;
  let farthest = -1;
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    if (!a) continue;
    const dist = pathDistances(cells, a);
    for (let j = 0; j < anchors.length; j++) {
      const b = anchors[j];
      if (i === j || !b) continue;
      const d = dist.get(`${b.x},${b.y}`);
      if (d !== undefined && d > farthest) [pair, farthest] = [[i, j], d];
    }
  }
  if (!pair) return null;

  const partyStart = anchors[pair[0]]!;
  const enemyStart = anchors[pair[1]]!;
  // Каждый зал должен быть достижим: иначе нарисованный зал оказался бы отрезан
  const fromStart = pathDistances(cells, partyStart);
  if (anchors.some((a) => !a || !fromStart.has(`${a.x},${a.y}`))) return null;

  const party = nearestFloor(cells, partyStart, PARTY_CELLS, new Set());
  const taken = new Set(party.map((c) => `${c.x},${c.y}`));
  const enemies = nearestFloor(cells, enemyStart, ENEMY_CELLS, taken);
  if (party.length < 8 || enemies.length < 8) return null;

  // Шагов от ближайшего героя: враги не должны стоять вплотную к партии
  const fromPartyZone = pathDistances(cells, party);
  const enemyKeys = new Set(enemies.map((c) => `${c.x},${c.y}`));
  if (enemies.some((c) => (fromPartyZone.get(`${c.x},${c.y}`) ?? 0) < MIN_ENEMY_STEPS)) return null;

  // Ближняя к партии половина отряда — фронт, дальняя — тыл
  const fromParty = pathDistances(cells, partyStart);
  const byDistance = [...enemies].sort(
    (a, b) => fromParty.get(`${a.x},${a.y}`)! - fromParty.get(`${b.x},${b.y}`)!
  );
  const half = Math.ceil(byDistance.length / 2);
  const zones: SpawnZoneDefinition[] = [
    { name: "party", cells: party },
    { name: "enemy_frontline", cells: byDistance.slice(0, half) },
    { name: "enemy_backline", cells: byDistance.slice(half) },
  ];

  const flank: Cell[] = [];
  for (const niche of layout.niches) {
    for (let y = 0; y < cells.length; y++) {
      for (let x = 0; x < cells[0].length; x++) {
        const key = `${x},${y}`;
        if (cells[y][x] !== "floor" || taken.has(key) || enemyKeys.has(key)) continue;
        if ((fromPartyZone.get(key) ?? -1) < MIN_FLANK_STEPS) continue;
        if (Math.hypot((x + 0.5 - niche.cx) / niche.rx, (y + 0.5 - niche.cy) / niche.ry) <= 1) flank.push({ x, y });
      }
    }
  }
  if (flank.length > 0) zones.push({ name: "ambush_flank", cells: flank });
  return zones;
}
