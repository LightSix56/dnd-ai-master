// Шаблоны областей поражения (AoE) и классификация целей для D&D 5e
import type { Cell, Combatant, FacingDirection } from "./types";
import { isHostile, SIZE_CELLS } from "./types";
import { isInBounds } from "./grid";

export interface SphereOptions {
  metric?: "euclidean" | "chebyshev";
}

/**
 * Возвращает клетки сетки в пределах сферы/цилиндра заданного радиуса.
 * 5 футов = 1 клетка.
 * Радиус в клетках = Math.floor(radiusFt / 5).
 * По умолчанию используется евклидово расстояние (круг), либо расстояние Чебышева.
 */
export function getSphereCells(
  center: Cell,
  radiusFt: number,
  gridWidth: number,
  gridHeight: number,
  options?: SphereOptions
): Cell[] {
  const radiusCells = Math.floor(radiusFt / 5);
  if (radiusCells <= 0) return [];

  const metric = options?.metric ?? "euclidean";
  const cells: Cell[] = [];
  const seen = new Set<string>();

  for (let dy = -radiusCells; dy <= radiusCells; dy++) {
    for (let dx = -radiusCells; dx <= radiusCells; dx++) {
      if (metric === "euclidean") {
        if (dx * dx + dy * dy > radiusCells * radiusCells) continue;
      }
      const cell: Cell = { x: center.x + dx, y: center.y + dy };
      if (!isInBounds(cell, gridWidth, gridHeight)) continue;

      const key = `${cell.x},${cell.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        cells.push(cell);
      }
    }
  }

  return cells;
}

interface DirStep {
  forward: { dx: number; dy: number };
  perp: { dx: number; dy: number };
}

const DIRECTION_STEPS: Record<FacingDirection, DirStep> = {
  N:  { forward: { dx: 0, dy: -1 },  perp: { dx: 1, dy: 0 } },
  S:  { forward: { dx: 0, dy: 1 },   perp: { dx: 1, dy: 0 } },
  E:  { forward: { dx: 1, dy: 0 },   perp: { dx: 0, dy: 1 } },
  W:  { forward: { dx: -1, dy: 0 },  perp: { dx: 0, dy: 1 } },
  NE: { forward: { dx: 1, dy: -1 },  perp: { dx: -1, dy: -1 } },
  NW: { forward: { dx: -1, dy: -1 }, perp: { dx: 1, dy: -1 } },
  SE: { forward: { dx: 1, dy: 1 },   perp: { dx: -1, dy: 1 } },
  SW: { forward: { dx: -1, dy: 1 },  perp: { dx: 1, dy: 1 } },
};

/**
 * Возвращает клетки для конуса, направленного по direction.
 * Длина в клетках = Math.floor(lengthFt / 5).
 * Конус расширяется симметрично: ширина на расстоянии d клеток равна d клеток.
 * Сама исходная клетка заклинателя (origin) в область не входит.
 */
export function getConeCells(
  origin: Cell,
  lengthFt: number,
  direction: FacingDirection,
  gridWidth: number,
  gridHeight: number
): Cell[] {
  const lengthCells = Math.floor(lengthFt / 5);
  if (lengthCells <= 0) return [];

  const { forward, perp } = DIRECTION_STEPS[direction] || DIRECTION_STEPS.N;
  const cells: Cell[] = [];
  const seen = new Set<string>();

  for (let d = 1; d <= lengthCells; d++) {
    const centerAtDist: Cell = {
      x: origin.x + forward.dx * d,
      y: origin.y + forward.dy * d,
    };

    // На расстоянии d ширина составляет d клеток.
    // Смещение распределяется симметрично относительно направления вперед:
    // d=1: [0] (1 клетка)
    // d=2: [0, 1] (2 клетки)
    // d=3: [-1, 0, 1] (3 клетки)
    // d=4: [-1, 0, 1, 2] (4 клетки)
    const half = (d - 1) / 2;
    const startOffset = -Math.floor(half);
    const endOffset = Math.ceil(half);

    for (let s = startOffset; s <= endOffset; s++) {
      const cell: Cell = {
        x: centerAtDist.x + perp.dx * s,
        y: centerAtDist.y + perp.dy * s,
      };

      if (!isInBounds(cell, gridWidth, gridHeight)) continue;
      const key = `${cell.x},${cell.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        cells.push(cell);
      }
    }
  }

  return cells;
}

/**
 * Возвращает клетки линии от origin в направлении target, ограниченной длиной lengthFt.
 * Линия строится алгоритмом Брезенхема. Клетка origin не включается.
 */
export function getLineCells(
  origin: Cell,
  target: Cell,
  lengthFt: number,
  widthFt: number = 5,
  gridWidth: number,
  gridHeight: number
): Cell[] {
  const maxCells = Math.floor(lengthFt / 5);
  if (maxCells <= 0) return [];

  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  if (dx === 0 && dy === 0) return [];

  // Масштабируем вектор, чтобы трассировать луч до максимальной длины
  const dist = Math.max(Math.abs(dx), Math.abs(dy));
  const scale = Math.ceil(maxCells / dist);
  const endX = origin.x + dx * scale;
  const endY = origin.y + dy * scale;

  const baseCells: Cell[] = [];
  let x0 = origin.x;
  let y0 = origin.y;
  const adx = Math.abs(endX - x0);
  const ady = Math.abs(endY - y0);
  const sx = x0 < endX ? 1 : -1;
  const sy = y0 < endY ? 1 : -1;
  let err = adx - ady;

  while (true) {
    if (x0 === endX && y0 === endY) break;
    const e2 = 2 * err;
    if (e2 > -ady) {
      err -= ady;
      x0 += sx;
    }
    if (e2 < adx) {
      err += adx;
      y0 += sy;
    }

    const cell: Cell = { x: x0, y: y0 };
    if (!isInBounds(cell, gridWidth, gridHeight)) break;
    baseCells.push(cell);
    if (baseCells.length >= maxCells) break;
  }

  const widthCells = Math.floor(widthFt / 5);
  if (widthCells <= 1) return baseCells;

  // Расширение перпендикулярно линии при widthFt > 5
  const isHorizontal = Math.abs(dx) >= Math.abs(dy);
  const expandedCells: Cell[] = [];
  const seen = new Set<string>();
  const half = (widthCells - 1) / 2;
  const startOffset = -Math.floor(half);
  const endOffset = Math.ceil(half);

  for (const c of baseCells) {
    for (let w = startOffset; w <= endOffset; w++) {
      const pCell: Cell = isHorizontal
        ? { x: c.x, y: c.y + w }
        : { x: c.x + w, y: c.y };

      if (isInBounds(pCell, gridWidth, gridHeight)) {
        const k = `${pCell.x},${pCell.y}`;
        if (!seen.has(k)) {
          seen.add(k);
          expandedCells.push(pCell);
        }
      }
    }
  }

  return expandedCells;
}

/**
 * Возвращает клетки для куба заданного размера.
 * Размер в клетках = Math.floor(sizeFt / 5).
 * По умолчанию origin является верхним левым углом куба.
 * Если centered = true, origin является центром куба.
 */
export function getCubeCells(
  origin: Cell,
  sizeFt: number,
  gridWidth: number,
  gridHeight: number,
  centered: boolean = false
): Cell[] {
  const sizeCells = Math.floor(sizeFt / 5);
  if (sizeCells <= 0) return [];

  const startX = centered ? origin.x - Math.floor((sizeCells - 1) / 2) : origin.x;
  const startY = centered ? origin.y - Math.floor((sizeCells - 1) / 2) : origin.y;

  const cells: Cell[] = [];
  const seen = new Set<string>();

  for (let dy = 0; dy < sizeCells; dy++) {
    for (let dx = 0; dx < sizeCells; dx++) {
      const cell: Cell = { x: startX + dx, y: startY + dy };
      if (!isInBounds(cell, gridWidth, gridHeight)) continue;
      const key = `${cell.x},${cell.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        cells.push(cell);
      }
    }
  }

  return cells;
}

export interface ClassifiedTargets {
  enemiesHit: Combatant[];
  alliesHit: Combatant[];
  hasFriendlyFire: boolean;
}

/**
 * Сопоставляет существ, находящихся в пораженных клетках,
 * и классифицирует их на врагов и союзников относительно casterType.
 */
export function classifyAoeTargets(
  cells: Cell[],
  combatants: Combatant[],
  casterType: "player" | "enemy"
): ClassifiedTargets {
  const cellSet = new Set(cells.map((c) => `${c.x},${c.y}`));
  const enemiesHit: Combatant[] = [];
  const alliesHit: Combatant[] = [];

  for (const c of combatants) {
    if (c.hpCurrent !== undefined && c.hpCurrent <= 0) continue;

    const size = (c.size && SIZE_CELLS[c.size]) ? SIZE_CELLS[c.size] : 1;
    let hit = false;

    for (let dx = 0; dx < size && !hit; dx++) {
      for (let dy = 0; dy < size && !hit; dy++) {
        if (cellSet.has(`${c.x + dx},${c.y + dy}`)) {
          hit = true;
        }
      }
    }

    if (!hit) continue;

    if (isHostile(casterType, c.type)) {
      enemiesHit.push(c);
    } else {
      alliesHit.push(c);
    }
  }

  return {
    enemiesHit,
    alliesHit,
    hasFriendlyFire: alliesHit.length > 0,
  };
}
