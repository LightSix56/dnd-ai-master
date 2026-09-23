import { isHostile, type Cell, type Combatant, type MapElement, type FacingDirection, type VisibilityStatus } from "./types";
import { isInBounds, cellKey } from "./grid";
import { getConditionEffects } from "./rules";

export const FT_PER_CELL = 5;

// Безопасное чтение properties (из БД приходит строкой)
function getProps(el: MapElement): Record<string, unknown> {
  if (!el.properties) return {};
  if (typeof el.properties === "string") {
    try {
      return JSON.parse(el.properties);
    } catch {
      return {};
    }
  }
  return el.properties as Record<string, unknown>;
}

function coversCell(el: MapElement, cell: Cell): boolean {
  return (
    cell.x >= el.x &&
    cell.x < el.x + el.width &&
    cell.y >= el.y &&
    cell.y < el.y + el.height
  );
}

/** Блокирует ли элемент карты проход через клетку */
export function isTerrainBlocked(cell: Cell, mapElements: MapElement[]): boolean {
  for (const el of mapElements) {
    if (!coversCell(el, cell)) continue;
    if (el.type === "wall" || el.type === "window" || el.type === "obstacle") return true;
    if (el.type === "door" && !getProps(el).isOpen) return true;
  }
  return false;
}

/** Занята ли клетка живым бойцом или непроходимой местностью */
export function isCellBlocked(
  cell: Cell,
  mapElements: MapElement[],
  combatants: Combatant[],
  ignoreCombatantId?: string
): boolean {
  if (isTerrainBlocked(cell, mapElements)) return true;

  for (const c of combatants) {
    if (c.id === ignoreCombatantId) continue;
    if (c.hpCurrent <= 0) continue; // тела не блокируют
    if (c.x === cell.x && c.y === cell.y) return true;
  }
  return false;
}

export function isWaterTerrain(cell: Cell, mapElements: MapElement[]): boolean {
  return mapElements.some((el) => el.type === "water" && coversCell(el, cell));
}

export function isLavaTerrain(cell: Cell, mapElements: MapElement[]): boolean {
  return mapElements.some((el) => el.type === "lava" && coversCell(el, cell));
}

export function isDifficultTerrain(cell: Cell, mapElements: MapElement[], mover?: Combatant): boolean {
  // Лава — всегда трудная местность (удвоенная стоимость)
  if (isLavaTerrain(cell, mapElements)) return true;

  // Вода — трудная местность (плавание), ЕСЛИ у существа нет скорости плавания или водохождения
  if (isWaterTerrain(cell, mapElements)) {
    if (mover) {
      const hasWaterWalking =
        mover.conditions.some((c) => c.type === "water_walking" || c.type === "water_walk") ||
        mover.abilities.some((a) => a.id.includes("water_walk") || a.name.toLowerCase().includes("водохожд"));

      const isSwimmer =
        (mover.speed > 0 &&
          mover.wildShape?.formId &&
          (mover.wildShape.formId === "reef_shark" ||
            mover.wildShape.formId === "crocodile" ||
            mover.wildShape.formId.includes("shark") ||
            mover.wildShape.formId.includes("croc"))) ||
        mover.className?.toLowerCase().includes("тритон") ||
        mover.name.toLowerCase().includes("тритон") ||
        mover.name.toLowerCase().includes("акул") ||
        mover.name.toLowerCase().includes("крокодил");

      if (hasWaterWalking || isSwimmer) {
        return false;
      }
    }
    return true;
  }

  return mapElements.some((el) => el.type === "difficult" && coversCell(el, cell));
}

/** Стоимость входа в клетку в футах */
export function cellCost(cell: Cell, mapElements: MapElement[], mover?: Combatant): number {
  return isDifficultTerrain(cell, mapElements, mover) ? FT_PER_CELL * 2 : FT_PER_CELL;
}

export interface ReachableNode {
  /** Накопленная стоимость пути в футах */
  cost: number;
  /** Предыдущая клетка — для восстановления маршрута */
  from: string | null;
}

const NEIGHBOR_OFFSETS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: -1 },
];

/**
 * Дейкстра по сетке. budgetFt — сколько футов движения доступно.
 * Диагональ стоит столько же, сколько ортогональ (вариант D&D 5e по умолчанию).
 * Возвращает все достижимые клетки со стоимостью и ссылкой на предыдущую.
 */
export function computeReachable(
  start: Cell,
  budgetFt: number,
  mapElements: MapElement[],
  combatants: Combatant[],
  gridW: number,
  gridH: number,
  ignoreCombatantId?: string,
  mover?: Combatant
): Map<string, ReachableNode> {
  const startKey = cellKey(start);
  const nodes = new Map<string, ReachableNode>([[startKey, { cost: 0, from: null }]]);
  if (budgetFt <= 0) return nodes;

  // Очередь с извлечением минимума — сетки небольшие, линейного поиска достаточно
  const queue: Array<{ cell: Cell; cost: number }> = [{ cell: start, cost: 0 }];

  while (queue.length > 0) {
    let minIdx = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].cost < queue[minIdx].cost) minIdx = i;
    }
    const { cell, cost } = queue.splice(minIdx, 1)[0];
    const key = cellKey(cell);

    // Устаревшая запись — уже нашли путь короче
    if (cost > (nodes.get(key)?.cost ?? Infinity)) continue;

    for (const { dx, dy } of NEIGHBOR_OFFSETS) {
      const next: Cell = { x: cell.x + dx, y: cell.y + dy };
      if (!isInBounds(next, gridW, gridH)) continue;
      if (isCellBlocked(next, mapElements, combatants, ignoreCombatantId)) continue;

      // Нельзя срезать угол стены или препятствия по диагонали (D&D 5e corner rule)
      if (dx !== 0 && dy !== 0) {
        const side1 = { x: cell.x, y: next.y };
        const side2 = { x: next.x, y: cell.y };
        const blocked1 = isTerrainBlocked(side1, mapElements);
        const blocked2 = isTerrainBlocked(side2, mapElements);
        if (blocked1 || blocked2) continue;
      }

      const nextCost = cost + cellCost(next, mapElements, mover);
      if (nextCost > budgetFt) continue;

      const nextKey = cellKey(next);
      if (nextCost < (nodes.get(nextKey)?.cost ?? Infinity)) {
        nodes.set(nextKey, { cost: nextCost, from: key });
        queue.push({ cell: next, cost: nextCost });
      }
    }
  }

  return nodes;
}

/** Достижимые клетки без стартовой — для подсветки на сетке */
export function getReachableCells(
  combatant: Combatant,
  budgetFt: number,
  mapElements: MapElement[],
  combatants: Combatant[],
  gridW: number,
  gridH: number
): Map<string, number> {
  const nodes = computeReachable(
    { x: combatant.x, y: combatant.y },
    budgetFt,
    mapElements,
    combatants,
    gridW,
    gridH,
    combatant.id,
    combatant
  );
  const result = new Map<string, number>();
  for (const [key, node] of nodes) {
    if (node.cost === 0) continue;
    result.set(key, node.cost);
  }
  return result;
}

export interface PathResult {
  ok: boolean;
  /** Клетки маршрута, начиная со следующей после старта */
  path: Cell[];
  costFt: number;
  reason?: string;
}

/**
 * Ищет маршрут до цели в пределах бюджета движения.
 * Возвращает и стоимость (её списываем), и сам путь (по нему ищем провокации).
 */
export function findPath(
  combatant: Combatant,
  target: Cell,
  budgetFt: number,
  mapElements: MapElement[],
  combatants: Combatant[],
  gridW: number,
  gridH: number
): PathResult {
  if (!isInBounds(target, gridW, gridH)) {
    return { ok: false, path: [], costFt: 0, reason: "Клетка за пределами карты" };
  }
  if (target.x === combatant.x && target.y === combatant.y) {
    return { ok: false, path: [], costFt: 0, reason: "Боец уже в этой клетке" };
  }
  if (isCellBlocked(target, mapElements, combatants, combatant.id)) {
    return { ok: false, path: [], costFt: 0, reason: "Клетка занята или непроходима" };
  }

  const nodes = computeReachable(
    { x: combatant.x, y: combatant.y },
    budgetFt,
    mapElements,
    combatants,
    gridW,
    gridH,
    combatant.id,
    combatant
  );

  const targetKey = cellKey(target);
  const node = nodes.get(targetKey);
  if (!node) {
    return {
      ok: false,
      path: [],
      costFt: 0,
      reason: `Не хватает движения или путь перекрыт (доступно ${budgetFt} фт)`,
    };
  }

  // Восстанавливаем маршрут от цели к старту
  const path: Cell[] = [];
  let cursor: string | null = targetKey;
  while (cursor) {
    const [cx, cy] = cursor.split(",").map(Number);
    path.push({ x: cx, y: cy });
    cursor = nodes.get(cursor)?.from ?? null;
  }
  path.reverse();
  path.shift(); // убираем стартовую клетку

  return { ok: true, path, costFt: node.cost };
}

/**
 * Кто получает провоцированную атаку: враги, из чьей досягаемости боец вышел
 * по ходу маршрута. По правилам 5e:
 * - При Отходе (disengage) провокаций нет.
 * - Невидимые (invisible) или скрытые (isHidden) бойцы не провоцируют атак (враг должен видеть цель).
 * - Враг должен видеть точку выхода (в секторе обзора и прямой видимости).
 */
export function findOpportunityAttackers(
  mover: Combatant,
  path: Cell[],
  combatants: Combatant[],
  reachFt = 5,
  mapElements: MapElement[] = []
): Combatant[] {
  if (path.length === 0) return [];

  // Отход (disengaging) полностью отменяет провоцированные атаки
  if (mover.conditions.some((cond) => cond.type === "disengaging")) {
    return [];
  }

  // Невидимый или скрытый персонаж не провоцирует атак (правило 5e: "hostile creature that you can see")
  if (mover.conditions.some((cond) => cond.type === "invisible") || mover.isHidden) {
    return [];
  }

  const reachCells = Math.max(1, Math.floor(reachFt / FT_PER_CELL));
  const inReach = (a: Cell, b: Cell) =>
    Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= reachCells;

  const attackers: Combatant[] = [];
  const fullRoute: Cell[] = [{ x: mover.x, y: mover.y }, ...path];

  for (const c of combatants) {
    if (c.id === mover.id) continue;
    if (c.hpCurrent <= 0) continue;
    if (c.reactionUsed) continue;
    // Провоцируют только дееспособные противники
    const hostile = isHostile(mover.type, c.type);
    if (!hostile) continue;
    const effects = getConditionEffects(c.conditions);
    if (c.conditions.some((cond) => cond.type === "blinded")) continue;
    if (effects.some((e) => e.noReactions || e.noActions)) continue;

    // Враг должен видеть точку выхода (прямая видимость, не ослеплен)
    if (mapElements.length > 0 && !hasLineOfSight(c, fullRoute[0], mapElements)) continue;

    // Проверяем, вышел ли бегущий из зоны досягаемости врага на каком-либо шаге маршрута
    let wasInReach = inReach(fullRoute[0], c);
    let provoked = false;

    for (let i = 1; i < fullRoute.length; i++) {
      const nowInReach = inReach(fullRoute[i], c);
      if (wasInReach && !nowInReach) {
        provoked = true;
        break;
      }
      wasInReach = nowInReach;
    }

    if (provoked) {
      attackers.push(c);
    }
  }
  return attackers;
}

/** Прямая видимость: стены, закрытые двери и препятствия блокируют */
export function hasLineOfSight(
  from: Cell,
  to: Cell,
  mapElements: MapElement[]
): boolean {
  const cells = getLineCells(from, to);
  for (const cell of cells) {
    // Клетки самих участников не мешают
    if (cell.x === from.x && cell.y === from.y) continue;
    if (cell.x === to.x && cell.y === to.y) continue;
    for (const el of mapElements) {
      if (!coversCell(el, cell)) continue;
      if (el.type === "wall" || el.type === "obstacle") return false;
      if (el.type === "door" && !getProps(el).isOpen) return false;
    }
  }
  return true;
}

/** Клетки на линии между двумя точками (Брезенхем) */
export function getLineCells(from: Cell, to: Cell): Cell[] {
  const cells: Cell[] = [];
  let x0 = from.x;
  let y0 = from.y;
  const x1 = to.x;
  const y1 = to.y;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    cells.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return cells;
}

/** Клетки в области действия заклинания */
export function getAoeCells(
  center: Cell,
  shape: "sphere" | "cube" | "cylinder" | "cone" | "line",
  sizeFt: number,
  origin: Cell | null,
  gridW: number,
  gridH: number
): Cell[] {
  const radius = Math.floor(sizeFt / FT_PER_CELL);
  const cells: Cell[] = [];

  if (shape === "sphere" || shape === "cylinder") {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cell = { x: center.x + dx, y: center.y + dy };
        if (!isInBounds(cell, gridW, gridH)) continue;
        // Круг по евклидовой метрике — ближе к настоящему шаблону сферы
        if (Math.sqrt(dx * dx + dy * dy) > radius + 0.5) continue;
        cells.push(cell);
      }
    }
    return cells;
  }

  if (shape === "cube") {
    const half = Math.floor(radius / 2);
    for (let dy = -half; dy <= half; dy++) {
      for (let dx = -half; dx <= half; dx++) {
        const cell = { x: center.x + dx, y: center.y + dy };
        if (isInBounds(cell, gridW, gridH)) cells.push(cell);
      }
    }
    return cells;
  }

  // Конус и линия идут от заклинателя в направлении указанной точки
  if (!origin) return cells;
  const dirX = Math.sign(center.x - origin.x);
  const dirY = Math.sign(center.y - origin.y);
  if (dirX === 0 && dirY === 0) return cells;

  if (shape === "line") {
    for (let i = 1; i <= radius; i++) {
      const cell = { x: origin.x + dirX * i, y: origin.y + dirY * i };
      if (!isInBounds(cell, gridW, gridH)) break;
      cells.push(cell);
    }
    return cells;
  }

  // Конус: расширяется на 1 клетку в каждую сторону с каждым шагом
  for (let i = 1; i <= radius; i++) {
    const spread = i - 1;
    for (let s = -spread; s <= spread; s++) {
      // Перпендикуляр к направлению
      const cell =
        dirX !== 0 && dirY !== 0
          ? { x: origin.x + dirX * i, y: origin.y + dirY * i + s }
          : dirX !== 0
            ? { x: origin.x + dirX * i, y: origin.y + s }
            : { x: origin.x + s, y: origin.y + dirY * i };
      if (isInBounds(cell, gridW, gridH)) cells.push(cell);
    }
  }
  return cells;
}

export const FACING_VECTORS: Record<FacingDirection, { dx: number; dy: number; angle: number }> = {
  N: { dx: 0, dy: -1, angle: 270 },
  NE: { dx: 1, dy: -1, angle: 315 },
  E: { dx: 1, dy: 0, angle: 0 },
  SE: { dx: 1, dy: 1, angle: 45 },
  S: { dx: 0, dy: 1, angle: 90 },
  SW: { dx: -1, dy: 1, angle: 135 },
  W: { dx: -1, dy: 0, angle: 180 },
  NW: { dx: -1, dy: -1, angle: 225 },
};

export function determineFacingTowards(from: Cell, to: Cell): FacingDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return "S";
  if (dx === 0) return dy > 0 ? "S" : "N";
  if (dy === 0) return dx > 0 ? "E" : "W";
  if (dx > 0 && dy < 0) return "NE";
  if (dx > 0 && dy > 0) return "SE";
  if (dx < 0 && dy < 0) return "NW";
  return "SW";
}

export function getFacingVector(facing?: FacingDirection): { dx: number; dy: number; angle: number } {
  return FACING_VECTORS[facing || "E"] || FACING_VECTORS.E;
}

/**
 * Проверяет, находится ли целевая клетка в секторе обзора наблюдателя:
 * - Сектор 120 градусов: ±60 градусов от направления взгляда.
 * - Максимальная дальность обнаружения: 90 фт (18 клеток).
 */
export function isInVisionCone(
  observer: Combatant,
  target: Cell,
  fovDegrees = 120,
  maxDistanceFt = 90
): boolean {
  if (observer.x === target.x && observer.y === target.y) return true;

  // Если цель находится дальше максимальной дальности обнаружения (90 фт = 18 клеток) — её не видно
  const distCells = Math.max(Math.abs(target.x - observer.x), Math.abs(target.y - observer.y));
  if (distCells * 5 > maxDistanceFt) return false;

  const f = getFacingVector(observer.facing || (observer.type === "enemy" ? "W" : "E"));
  const vx = target.x - observer.x;
  const vy = target.y - observer.y;

  // Угол направления на цель в градусах (0..360, где 0 = E, 90 = S, 180 = W, 270 = N)
  let targetAngle = (Math.atan2(vy, vx) * 180) / Math.PI;
  if (targetAngle < 0) targetAngle += 360;

  // Минимальная угловая разница
  let diff = Math.abs(targetAngle - f.angle);
  if (diff > 180) diff = 360 - diff;

  // Сектор 120° = ±60° от оси направления взгляда
  const halfFov = fovDegrees / 2;
  return diff <= halfFov;
}

/**
 * Находится ли цель в укрытии относительно наблюдателя
 */
export function hasCoverBetween(
  from: Cell,
  to: Cell,
  mapElements: MapElement[],
  combatants: Combatant[] = []
): "none" | "half" | "three_quarters" {
  const line = getLineCells(from, to);
  let coverCount = 0;
  for (const cell of line) {
    if (cell.x === from.x && cell.y === from.y) continue;
    if (cell.x === to.x && cell.y === to.y) continue;
    // Препятствия и элементы укрытия на линии
    for (const el of mapElements) {
      if (coversCell(el, cell) && (el.type === "cover" || el.type === "obstacle" || el.type === "window")) {
        coverCount++;
      }
    }
    // Другие существа на линии создают полуукрытие (правило 5e)
    for (const c of combatants) {
      if (c.hpCurrent > 0 && c.x === cell.x && c.y === cell.y) {
        coverCount++;
      }
    }
  }
  if (coverCount >= 2) return "three_quarters";
  if (coverCount >= 1) return "half";
  return "none";
}

/**
 * Вычисляет статус видимости бойца:
 * "visible" - виден хотя бы одному дееспособному врагу в его секторе обзора
 * "cover" - виден хотя бы одному врагу, но находится в укрытии
 * "unseen" - никто из врагов не видит персонажа (за стенами, смотрят в другую сторону, слепы или персонаж невидим)
 */
export function computeVisibilityStatus(
  target: Combatant,
  allCombatants: Combatant[],
  mapElements: MapElement[]
): { status: VisibilityStatus; seenBy: string[] } {
  // Невидимого никто не видит обычным зрением
  if (target.conditions.some((c) => c.type === "invisible")) {
    return { status: "unseen", seenBy: [] };
  }

  const seenBy: string[] = [];
  let hasCoverSight = false;

  for (const enemy of allCombatants) {
    if (enemy.id === target.id) continue;
    if (enemy.hpCurrent <= 0) continue;
    if (!isHostile(target.type, enemy.type)) continue;

    // Слепые, парализованные, без сознания не видят
    const effects = getConditionEffects(enemy.conditions);
    if (effects.some((e) => e.noActions) || enemy.conditions.some((c) => c.type === "blinded")) {
      continue;
    }

    const distCells = Math.max(Math.abs(enemy.x - target.x), Math.abs(enemy.y - target.y));

    // Проверяем сектор обзора (120 градусов перед собой)
    if (!isInVisionCone(enemy, { x: target.x, y: target.y })) {
      continue;
    }

    // Проверяем прямую линию видимости (стены, закрытые двери)
    if (!hasLineOfSight(enemy, target, mapElements)) {
      continue;
    }

    // Проверяем укрытие
    const terrainCover = hasCoverBetween(enemy, target, mapElements, allCombatants);
    const hasCoverCondition = target.conditions.some(
      (c) => c.type === "cover_half" || c.type === "cover_three_quarters"
    );

    // Если персонаж скрытен (isHidden):
    // Враг замечает его, только если подошел вплотную (5 фт / 1 клетка) ИЛИ если персонаж вышел на открытую местность без укрытия прямо перед глазами врага
    if (target.isHidden) {
      if (distCells > 1 && (terrainCover !== "none" || hasCoverCondition)) {
        continue;
      }
    }

    if (terrainCover !== "none" || hasCoverCondition) {
      hasCoverSight = true;
      seenBy.push(`${enemy.name} (в укрытии)`);
    } else {
      seenBy.push(enemy.name);
      return { status: "visible", seenBy };
    }
  }

  if (hasCoverSight) {
    return { status: "cover", seenBy };
  }

  return { status: "unseen", seenBy: [] };
}
