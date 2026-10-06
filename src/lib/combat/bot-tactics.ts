// Тактические расчёты бота: насколько клетка открыта врагам, откуда стрелять, где
// спрятаться, как пройти через закрытые двери. Только расчёты — ходы делает bot.ts.

import { checkReach } from "./rules";
import {
  computeReachable,
  computeVisibilityStatus,
  hasCoverBetween,
  hasLineOfSight,
  isLavaTerrain,
  type ReachableNode,
} from "./movement";
import { distanceFt, cellKey } from "./grid";
import { isHostile, type Attack, type Cell, type Combatant, type MapElement, type VisibilityStatus } from "./types";
import type { CombatState } from "./engine";

/** Сколько клеток вокруг себя бот вообще рассматривает, когда ищет путь «за дверь» */
const ROUTE_BUDGET_FT = 400;

const parseProps = (el: MapElement): Record<string, unknown> =>
  typeof el.properties === "string" ? (() => { try { return JSON.parse(el.properties as string); } catch { return {}; } })() : ((el.properties ?? {}) as Record<string, unknown>);

export const isClosedDoor = (el: MapElement) => el.type === "door" && !parseProps(el).isOpen;

/** Лаву бот обходит, если сам в ней не стоит */
export function hazardFilter(state: CombatState, actor: Combatant): ((cell: Cell) => boolean) | undefined {
  if (isLavaTerrain(actor, state.mapElements)) return undefined;
  return (cell) => isLavaTerrain(cell, state.mapElements);
}

/** Клетки, куда бот может дойти за `budgetFt` (по умолчанию — остаток движения), без лавы */
export function botReachable(state: CombatState, actor: Combatant, budgetFt: number, mapElements = state.mapElements): Map<string, ReachableNode> {
  return computeReachable(
    { x: actor.x, y: actor.y },
    budgetFt,
    mapElements,
    state.combatants,
    state.gridWidth,
    state.gridHeight,
    actor.id,
    actor,
    hazardFilter(state, actor)
  );
}

export const parseKey = (key: string): Cell => {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
};

/** Враги, которые бьют вблизи */
const hasMelee = (c: Combatant) => c.attacks.some((a) => a.kind === "melee") || !!c.multiattack;
/** Враги, которые достают издалека */
const hasRangedThreat = (c: Combatant) =>
  c.attacks.some((a) => a.kind === "ranged") || (c.spells?.known?.length ?? 0) > 0;

export function livingHostiles(state: CombatState, actor: Combatant): Combatant[] {
  return state.combatants.filter((c) => c.hpCurrent > 0 && isHostile(actor.type, c.type));
}

/**
 * Насколько клетка открыта врагам: стрелки и маги «видят» на всё поле, ближники — только
 * в пределах того, что пробегут за ход. Без линии видимости — 0, укрытие снижает вес.
 */
export function exposure(state: CombatState, actor: Combatant, cell: Cell): number {
  const others = state.combatants.filter((c) => c.id !== actor.id);
  let total = 0;
  for (const enemy of livingHostiles(state, actor)) {
    const dist = distanceFt(enemy, cell);
    const threatens = hasRangedThreat(enemy) ? dist <= 120 : dist <= (enemy.speed || 30) + 5;
    if (!threatens) continue;
    if (!hasLineOfSight(enemy, cell, state.mapElements)) continue;
    const cover = hasCoverBetween(enemy, cell, state.mapElements, others);
    total += cover === "none" ? 3 : cover === "half" ? 1.5 : 0.5;
  }
  return total;
}

/** До ближайшего вражеского ближника, в футах */
export function nearestMeleeThreatFt(state: CombatState, actor: Combatant, cell: Cell): number {
  let best = Infinity;
  for (const enemy of livingHostiles(state, actor)) {
    if (hasMelee(enemy)) best = Math.min(best, distanceFt(enemy, cell));
  }
  return best;
}

export interface FiringPosition {
  cell: Cell;
  target: Combatant;
  score: number;
}

/**
 * Лучшая клетка для выстрела: цель достаётся, клетка прикрыта от врагов и не ближе
 * 15 фт к их ближникам. Меньше — лучше. Текущая клетка тоже кандидат.
 */
export function bestFiringPosition(
  state: CombatState,
  actor: Combatant,
  targets: Combatant[],
  attack: Attack,
  budgetFt: number
): FiringPosition | null {
  const nodes = botReachable(state, actor, budgetFt);
  let best: FiringPosition | null = null;
  for (const [key, node] of nodes) {
    const cell = parseKey(key);
    const probe = { ...actor, x: cell.x, y: cell.y };
    const targetIdx = targets.findIndex((t) => t.hpCurrent > 0 && checkReach(probe, t, attack, state.mapElements).ok);
    if (targetIdx < 0) continue;
    const melee = nearestMeleeThreatFt(state, actor, cell);
    const score =
      exposure(state, actor, cell) * 10 +
      (melee < 15 ? (15 - melee) * 2 : 0) +
      targetIdx * 4 + // по возможности — по главной цели
      node.cost * 0.1;
    if (!best || score < best.score) best = { cell, target: targets[targetIdx], score };
  }
  return best;
}

/** Видимость бойца, если бы он стоял в клетке `cell` */
export function visibilityAt(state: CombatState, actor: Combatant, cell: Cell): VisibilityStatus {
  const probe = { ...actor, x: cell.x, y: cell.y, isHidden: false };
  const combatants = state.combatants.map((c) => (c.id === actor.id ? probe : c));
  return computeVisibilityStatus(probe, combatants, state.mapElements).status;
}

/**
 * Где спрятаться: клетка вне поля зрения врагов, иначе — в укрытии. Рядом с врагом не
 * прячемся (вплотную скрыться нельзя). null — спрятаться негде.
 */
export function bestHidingCell(state: CombatState, actor: Combatant, budgetFt: number): { cell: Cell; status: VisibilityStatus } | null {
  const nodes = botReachable(state, actor, budgetFt);
  const enemies = livingHostiles(state, actor);
  let best: { cell: Cell; status: VisibilityStatus; score: number } | null = null;
  for (const [key, node] of nodes) {
    const cell = parseKey(key);
    if (enemies.some((e) => distanceFt(e, cell) <= 5)) continue;
    const status = visibilityAt(state, actor, cell);
    if (status === "visible") continue;
    const score = (status === "unseen" ? 0 : 10) + exposure(state, actor, cell) + node.cost * 0.05;
    if (!best || score < best.score) best = { cell, status, score };
  }
  return best ? { cell: best.cell, status: best.status } : null;
}

/** Клетки рядом с целью, где можно встать */
function cellsAround(state: CombatState, target: Cell): Set<string> {
  const out = new Set<string>();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const x = target.x + dx;
      const y = target.y + dy;
      if (x >= 0 && y >= 0 && x < state.gridWidth && y < state.gridHeight) out.add(cellKey({ x, y }));
    }
  }
  return out;
}

export interface DoorRoute {
  door: MapElement;
  /** Последняя клетка маршрута перед дверью — отсюда её открывают */
  standAt: Cell;
  /** Маршрут от бойца до этой клетки (без стартовой) */
  path: Cell[];
}

/**
 * Если до цели не дойти никак, но можно, открыв двери, — первая закрытая дверь на
 * кратчайшем таком пути и клетка перед ней. Иначе null.
 */
export function doorOnRouteTo(state: CombatState, actor: Combatant, target: Cell): DoorRoute | null {
  const goals = cellsAround(state, target);
  const reachableNow = botReachable(state, actor, ROUTE_BUDGET_FT);
  if ([...goals].some((k) => reachableNow.has(k))) return null;

  const closed = state.mapElements.filter(isClosedDoor);
  if (closed.length === 0) return null;
  const opened = state.mapElements.map((el) => (isClosedDoor(el) ? { ...el, properties: { ...parseProps(el), isOpen: true } } : el));
  const nodes = botReachable(state, actor, ROUTE_BUDGET_FT, opened);
  let goalKey: string | null = null;
  for (const k of goals) if (nodes.has(k) && (!goalKey || nodes.get(k)!.cost < nodes.get(goalKey)!.cost)) goalKey = k;
  if (!goalKey) return null;

  const path: Cell[] = [];
  for (let cursor: string | null = goalKey; cursor; cursor = nodes.get(cursor)?.from ?? null) path.push(parseKey(cursor));
  path.reverse();
  for (let i = 1; i < path.length; i++) {
    const door = closed.find((d) => path[i].x >= d.x && path[i].x < d.x + d.width && path[i].y >= d.y && path[i].y < d.y + d.height);
    if (door) return { door, standAt: path[i - 1], path: path.slice(1, i) };
  }
  return null;
}

/** Сколько вражеских ближников добегут до бойца за свой ход при такой карте */
export function meleeThreatsReaching(state: CombatState, actor: Combatant, mapElements: MapElement[]): number {
  const around = cellsAround(state, actor);
  let count = 0;
  for (const enemy of livingHostiles(state, actor)) {
    if (!hasMelee(enemy)) continue;
    const nodes = computeReachable({ x: enemy.x, y: enemy.y }, enemy.speed || 30, mapElements, state.combatants, state.gridWidth, state.gridHeight, enemy.id, enemy);
    if ([...around].some((k) => nodes.has(k)) || distanceFt(enemy, actor) <= 5) count++;
  }
  return count;
}

/** Путь (в футах) от каждой клетки до цели — чтобы идти к ней в обход стен, а не «по прямой» */
export function distancesTo(state: CombatState, target: Cell, ignoreId?: string): Map<string, ReachableNode> {
  return computeReachable(target, ROUTE_BUDGET_FT, state.mapElements, [], state.gridWidth, state.gridHeight, ignoreId);
}

/** Стоит ли боец вплотную к элементу карты (в пределах 5 фт) */
export function adjacentTo(c: Cell, el: MapElement): boolean {
  const dx = c.x < el.x ? el.x - c.x : c.x >= el.x + el.width ? c.x - (el.x + el.width - 1) : 0;
  const dy = c.y < el.y ? el.y - c.y : c.y >= el.y + el.height ? c.y - (el.y + el.height - 1) : 0;
  return Math.max(dx, dy) <= 1;
}
