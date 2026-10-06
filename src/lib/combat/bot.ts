// Бот для врагов, NPC и спутников.
// Полноценный тактический искусственный интеллект:
// 1. Распределение целей (Anti-dogpiling) — не толпиться в 1 цель, сбивать концентрацию, связывать стрелков.
// 2. Заклинания (AoE и одиночные) — разряжать мощные заклинания по скоплениям врагов без урона по своим.
// 3. Способности — баффы, телепорты, лечение, Action Surge.
// 4. Тактическое позиционирование — кайтинг стрелками и магами, использование укрытий.

import { distanceFt } from "./grid";
import {
  CombatState,
  EngineError,
  endTurn,
  moveCombatant,
  performAttack,
  performMultiattack,
  castSpell,
  useAbility,
  attemptHide,
  standUp,
  setFacing,
  toggleDoor,
} from "./engine";
import {
  canPayForAttack,
  canAct,
  checkReach,
  remainingMovement,
  effectiveSpeed,
  hasCondition,
} from "./rules";
import {
  computeReachable,
  findOpportunityAttackers,
  findPath,
  hasLineOfSight,
  hasCoverBetween,
  isInVisionCone,
  getAoeCells,
} from "./movement";
import {
  isHostile,
  type Attack,
  type Cell,
  type Combatant,
  type FacingDirection,
  type MapElement,
} from "./types";
import { getSpellDefinition } from "./library-data";
import {
  adjacentTo,
  bestFiringPosition,
  bestHidingCell,
  botReachable,
  distancesTo,
  doorOnRouteTo,
  exposure,
  isClosedDoor,
  livingHostiles,
  meleeThreatsReaching,
  nearestMeleeThreatFt,
  parseKey,
  visibilityAt,
} from "./bot-tactics";
import {
  checkMoraleTrigger,
  resolveMoraleCheck,
  applyMoraleFailure,
  getFleeingDestination,
} from "./morale";

export interface BotStep {
  kind: "move" | "attack" | "ability" | "end" | "skip";
  text: string;
}

export interface BotTurnResult {
  steps: BotStep[];
  /** Ход завершён и передан следующему бойцу */
  ended: boolean;
}

export type BotArchetype = "caster" | "rogue" | "ranged" | "melee";

export const FACING_CYCLE: FacingDirection[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

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

/** Автоматически определяет тактический архетип бойца */
export function getBotArchetype(c: Combatant): BotArchetype {
  if (c.spells && c.spells.known && c.spells.known.length > 0) {
    return "caster";
  }
  const isRogue =
    c.className?.toLowerCase().includes("плут") ||
    c.abilities.some((a) => a.name.includes("Скрытая атака") || a.name.includes("Теневой шаг"));
  if (isRogue) return "rogue";

  const hasRanged = c.attacks.some((a) => a.kind === "ranged");
  const hasMelee = c.attacks.some((a) => a.kind === "melee");
  if (hasRanged && !hasMelee) return "ranged";
  if (hasRanged && c.dexMod > (c.abilityMods?.STR ?? 0)) return "ranged";
  return "melee";
}

/**
 * Проверяет, видит/воспринимает ли бот цель:
 * - Невидимый персонаж (invisible) скрыт от обычного зрения.
 * - Скрытый персонаж (isHidden) не виден, пока не выйдет из укрытия прямо перед лицом бота (в сектор обзора без укрытия) или не окажется в 5 фт.
 * - Если персонаж НЕ скрыт и НЕ невидим (раскрыт в бою) — все боты сразу осведомлены о его позиции и агрятся на него.
 */
function isPerceivableByBot(
  observer: Combatant,
  target: Combatant,
  mapElements: MapElement[],
  allCombatants: Combatant[] = []
): boolean {
  if (target.hpCurrent <= 0) return false;
  if (target.conditions.some((c) => c.type === "invisible")) return false;

  if (target.isHidden) {
    const dist = distanceFt(observer, target);
    if (dist <= 5) return true; // Вплотную скрыться невозможно
    if (!isInVisionCone(observer, target)) return false;
    if (!hasLineOfSight(observer, target, mapElements)) return false;
    const cover = hasCoverBetween(observer, target, mapElements, allCombatants);
    if (cover !== "none") return false; // За укрытием цель остаётся незамеченной
    return true;
  }

  return true;
}

function hostilesOf(state: CombatState, c: Combatant): Combatant[] {
  return state.combatants.filter(
    (t) => t.hpCurrent > 0 && isHostile(c.type, t.type) && isPerceivableByBot(c, t, state.mapElements, state.combatants)
  );
}

function alliesOf(state: CombatState, c: Combatant): Combatant[] {
  return state.combatants.filter(
    (t) => t.hpCurrent > 0 && !isHostile(c.type, t.type) && t.id !== c.id
  );
}

/**
 * Многофакторная оценка приоритета цели с защитой от толкучки (Anti-dogpiling):
 * - Меньший итоговый score = более приоритетная цель.
 */
function evaluateTargetScore(
  actor: Combatant,
  target: Combatant,
  allAllies: Combatant[],
  archetype: BotArchetype
): number {
  const dist = distanceFt(actor, target);
  const hpFraction = target.hpCurrent / Math.max(1, target.hpMax);

  // Базовый вес: расстояние + оставшееся здоровье + класс доспеха
  let score = dist * 0.5 + hpFraction * 35 + target.ac * 0.4;

  // 1. АНТИ-ТОЛКУЧКА (Anti-dogpiling) И ТАКТИКА СТАИ (Pack Tactics):
  // Считаем сколько дееспособных союзников бота УЖЕ атакуют цель в упор (<= 5 фт)
  const alliesEngaging = allAllies.filter((a) => a.hpCurrent > 0 && distanceFt(a, target) <= 5).length;
  const hasPackTactics = actor.monsterTraits?.some((t) => {
    const n = (t.name || "").toLowerCase();
    return n.includes("тактика стаи") || n.includes("pack tactics");
  });

  if (hasPackTactics) {
    // Для существа со стайной тактикой наличие союзника в 5 фт от цели даёт преимущество!
    if (alliesEngaging >= 1) {
      score -= 35;
    }
  } else {
    if (alliesEngaging >= 2) {
      // Уже 2+ союзника в упор — ощутимый штраф, ищи другую свободную цель!
      score += 45 * alliesEngaging;
    } else if (alliesEngaging === 1) {
      if (archetype === "rogue") {
        // Для плута союзник в упор к цели — желанное условие для Sneak Attack!
        score -= 25;
      } else {
        score += 5;
      }
    }
  }

  // 2. СБИВАНИЕ КОНЦЕНТРАЦИИ:
  if (target.concentration) {
    score -= 40;
  }

  // 2.5. ЦЕЛЬ ЛЕЖИТ В БЛИЖНЕМ БОЮ (Melee Advantage):
  if (hasCondition(target, "prone") && dist <= 5) {
    score -= 25;
  }

  // 3. РОЛЕВЫЕ ПРИОРИТЕТЫ:
  if (archetype === "melee") {
    // Милишники связывают боем вражеских стрелков и магов (навязывают помеху)
    const isTargetRangedOrCaster =
      target.attacks.some((a) => a.kind === "ranged") ||
      (target.spells && target.spells.known && target.spells.known.length > 0) ||
      ["волшебник", "чародей", "колдун", "следопыт"].includes(target.className?.toLowerCase() || "");
    if (isTargetRangedOrCaster && dist <= 40) {
      score -= 15;
    }
    // Авангард прикрывает своих стрелков и магов: враг рядом с ними — в приоритете
    const threatensBackline = allAllies.some(
      (a) =>
        a.hpCurrent > 0 &&
        (a.tacticalRole === "backline" || ["ranged", "caster"].includes(getBotArchetype(a))) &&
        distanceFt(a, target) <= 10
    );
    if (threatensBackline) score -= 15;
  } else if (archetype === "ranged" || archetype === "caster") {
    // Стрелки и маги любят мягкие цели с низким КД
    if (target.ac <= 13) {
      score -= 12;
    }
    // Если враг уже в упор (5 фт), нужно избавиться от него в первую очередь
    if (dist <= 5) {
      score -= 20;
    }
  }

  // 4. ДОБИВАНИЕ РАНЕНЫХ (Finisher):
  if (target.hpCurrent <= 10) {
    score -= 30;
  }

  return score;
}

export function scoreTargetForBot(
  actor: Combatant,
  target: Combatant,
  allAllies: Combatant[] = [],
  archetype: BotArchetype = "melee"
): number {
  return evaluateTargetScore(actor, target, allAllies, archetype);
}

/** Атака с наибольшим ожидаемым уроном среди доступных по ресурсам */
function bestAttack(c: Combatant, kinds: Attack["kind"][]): Attack | null {
  const usable = c.attacks.filter(
    (a) => kinds.includes(a.kind) && canPayForAttack(c, a).ok
  );
  if (usable.length === 0) return null;
  const expected = (a: Attack) =>
    a.damage.reduce((sum, d) => {
      const m = d.dice.toLowerCase().replace(/к/g, "d").match(/^(\d*)d(\d+)/);
      const avg = m ? (m[1] ? parseInt(m[1], 10) : 1) * ((parseInt(m[2], 10) + 1) / 2) : 0;
      return sum + avg + d.mod;
    }, 0);
  return usable.sort((a, b) => expected(b) - expected(a))[0];
}

/** Ближайшая достижимая клетка, из которой атака дотянется до цели */
function findApproachCell(
  state: CombatState,
  actor: Combatant,
  target: Combatant,
  attack: Attack
): Cell | null {
  const budget = remainingMovement(actor);
  if (budget <= 0) return null;

  const nodes = botReachable(state, actor, budget);

  let best: { cell: Cell; cost: number } | null = null;
  for (const [key, node] of nodes) {
    if (node.cost === 0) continue;
    const [x, y] = key.split(",").map(Number);
    const probe = { ...actor, x, y };
    const reach = checkReach(probe, target, attack, state.mapElements);
    if (!reach.ok) continue;
    if (!best || node.cost < best.cost) best = { cell: { x, y }, cost: node.cost };
  }
  return best?.cell ?? null;
}

/** Достижимая клетка, ближе всего к цели по пути в обход стен (а не по прямой) */
function findClosestCellTowardsTarget(
  state: CombatState,
  actor: Combatant,
  target: Combatant | Cell
): Cell | null {
  const budget = remainingMovement(actor);
  if (budget <= 0) return null;

  const nodes = botReachable(state, actor, budget);
  const toTarget = distancesTo(state, { x: target.x, y: target.y });
  let best: { cell: Cell; dist: number; cost: number } | null = null;
  for (const [key, node] of nodes) {
    if (node.cost === 0) continue;
    const cell = parseKey(key);
    // Путь до цели; если цель отрезана (дверь, стена) — расстояние по прямой
    const dist = toTarget.get(key)?.cost ?? 1000 + distanceFt(cell, target);
    if (!best || dist < best.dist || (dist === best.dist && node.cost < best.cost)) {
      best = { cell, dist, cost: node.cost };
    }
  }
  return best?.cell ?? null;
}

/** Плут с «Хитрым действием» (бонусные Отход, Рывок, Засада) */
function hasCunningAction(c: Combatant): boolean {
  const cls = c.className?.toLowerCase() ?? "";
  return ((cls.includes("плут") || cls.includes("rogue")) && c.level >= 2) || c.abilities.some((a) => a.name.includes("Хитрое действие"));
}

/** Воюет издалека: стрелок, маг или плут с луком/арбалетом */
function prefersRanged(c: Combatant, archetype: BotArchetype): boolean {
  if (archetype === "ranged" || archetype === "caster") return true;
  if (archetype !== "rogue") return false;
  const ranged = c.attacks.some((a) => a.kind === "ranged");
  const melee = c.attacks.some((a) => a.kind === "melee");
  return ranged && (!melee || c.dexMod >= (c.abilityMods?.STR ?? 0));
}

/** Свободное взаимодействие с предметом — одно за ход; второе стоит действия */
interface TurnBudget {
  interactionUsed: boolean;
}

function spendInteraction(state: CombatState, actor: Combatant, budget: TurnBudget): boolean {
  if (!budget.interactionUsed) {
    budget.interactionUsed = true;
    return true;
  }
  if (actor.actionUsed) return false;
  actor.actionUsed = true;
  state.mark(actor.id);
  return true;
}

/** Цель за закрытой дверью: дойти до двери и открыть её */
function tryOpenDoorOnRoute(state: CombatState, actor: Combatant, target: Combatant, budget: TurnBudget): BotStep[] {
  const steps: BotStep[] = [];
  for (let guard = 0; guard < 3; guard++) {
    const route = doorOnRouteTo(state, actor, target);
    if (!route) break;
    if (!adjacentTo(actor, route.door)) {
      // Идём по маршруту к двери настолько далеко, насколько хватит движения
      const nodes = botReachable(state, actor, remainingMovement(actor));
      const reachable = [...route.path].reverse().find((c) => nodes.has(`${c.x},${c.y}`));
      if (!reachable || (reachable.x === actor.x && reachable.y === actor.y)) break;
      try {
        const move = moveCombatant(state, actor.id, reachable, { skipTurnCheck: true, avoidHazards: true });
        actor.facing = determineFacingTowards(actor, route.door);
        state.mark(actor.id);
        steps.push({ kind: "move", text: `${actor.name} идёт к двери (${move.costFt} фт)` });
        for (const oa of move.opportunityAttacks) steps.push({ kind: "attack", text: oa.text });
      } catch (e) {
        if (!(e instanceof EngineError)) throw e;
        break;
      }
    }
    if (!adjacentTo(actor, route.door) || actor.hpCurrent <= 0) break;
    if (!spendInteraction(state, actor, budget)) break;
    try {
      toggleDoor(state, route.door.id, { actorId: actor.id });
      steps.push({ kind: "ability", text: `${actor.name} открывает дверь` });
    } catch (e) {
      if (!(e instanceof EngineError)) throw e;
      break;
    }
  }
  return steps;
}

/**
 * Раненый стрелок или маг захлопывает соседнюю дверь, если это отрезает от него
 * вражеских ближников.
 */
function tryCloseDoorBehind(state: CombatState, actor: Combatant, budget: TurnBudget): BotStep | null {
  if (budget.interactionUsed) return null;
  const doors = state.mapElements.filter(
    (el) =>
      el.type === "door" &&
      !isClosedDoor(el) &&
      adjacentTo(actor, el) &&
      !state.combatants.some((c) => c.hpCurrent > 0 && c.x >= el.x && c.x < el.x + el.width && c.y >= el.y && c.y < el.y + el.height)
  );
  if (doors.length === 0) return null;
  const before = meleeThreatsReaching(state, actor, state.mapElements);
  if (before === 0) return null;
  for (const door of doors) {
    const closed = state.mapElements.map((el) =>
      el.id === door.id ? { ...el, properties: { ...((el.properties as object) ?? {}), isOpen: false } } : el
    );
    if (meleeThreatsReaching(state, actor, closed) < before) {
      try {
        toggleDoor(state, door.id, { actorId: actor.id });
        budget.interactionUsed = true;
        return { kind: "ability", text: `${actor.name} захлопывает дверь перед преследователями` };
      } catch (e) {
        if (!(e instanceof EngineError)) throw e;
      }
    }
  }
  return null;
}

/** Стрелок/маг: до атаки встать туда, откуда цель достаётся, а сам он — за укрытием */
function tryTakeFiringPosition(state: CombatState, actor: Combatant, targets: Combatant[], archetype: BotArchetype): BotStep | null {
  const budget = remainingMovement(actor);
  if (budget <= 0 || targets.length === 0) return null;
  const attack =
    bestAttack(actor, ["ranged"]) ??
    (archetype === "caster"
      ? ({ id: "spell-range", name: "Заклинание", attackBonus: 0, damage: [], kind: "ranged", range: { normal: 60 }, actionCost: "action" } as Attack)
      : null);
  if (!attack) return null;
  const best = bestFiringPosition(state, actor, targets, attack, budget);
  if (!best || (best.cell.x === actor.x && best.cell.y === actor.y)) return null;
  try {
    const move = moveCombatant(state, actor.id, best.cell, { skipTurnCheck: true, avoidHazards: true });
    actor.facing = determineFacingTowards(actor, best.target);
    state.mark(actor.id);
    const covered = exposure(state, actor, actor) < 3 ? " за укрытием" : "";
    return { kind: "move", text: `${actor.name} занимает позицию для стрельбы${covered} (${move.costFt} фт)` };
  } catch (e) {
    if (!(e instanceof EngineError)) throw e;
    return null;
  }
}

/**
 * Плут после удара: уходит из поля зрения и прячется. Если стоит вплотную к врагу —
 * «Хитрое действие: Отход»; спрятаться в этот ход уже нечем, просто отходит в укрытие.
 */
function tryRogueVanish(state: CombatState, actor: Combatant): BotStep[] {
  const steps: BotStep[] = [];
  if (!hasCunningAction(actor) || actor.bonusActionUsed || actor.hpCurrent <= 0) return steps;
  const budget = remainingMovement(actor);
  if (budget <= 0) return steps;
  const engaged = livingHostiles(state, actor).some((e) => distanceFt(actor, e) <= 5);

  if (engaged) {
    actor.conditions = [...actor.conditions.filter((c) => c.type !== "disengaging"), { type: "disengaging", duration: 1 }];
    actor.bonusActionUsed = true;
    state.mark(actor.id);
    steps.push({ kind: "ability", text: `${actor.name} использует «Хитрое действие: Отход»` });
    const spot = bestHidingCell(state, actor, budget)?.cell ?? safestCell(state, actor, budget);
    if (spot && (spot.x !== actor.x || spot.y !== actor.y)) {
      try {
        const move = moveCombatant(state, actor.id, spot, { skipTurnCheck: true, avoidHazards: true });
        steps.push({ kind: "move", text: `${actor.name} отступает в тень (${move.costFt} фт)` });
      } catch (e) {
        if (!(e instanceof EngineError)) throw e;
      }
    }
    return steps;
  }

  const spot = bestHidingCell(state, actor, budget);
  if (!spot) return steps;
  if (spot.cell.x !== actor.x || spot.cell.y !== actor.y) {
    try {
      const move = moveCombatant(state, actor.id, spot.cell, { skipTurnCheck: true, avoidHazards: true });
      steps.push({ kind: "move", text: `${actor.name} уходит за укрытие (${move.costFt} фт)` });
    } catch (e) {
      if (!(e instanceof EngineError)) throw e;
      return steps;
    }
  }
  if (visibilityAt(state, actor, actor) === "visible") return steps;
  try {
    steps.push({ kind: "ability", text: attemptHide(state, actor.id, { skipTurnCheck: true }).text });
  } catch (e) {
    if (!(e instanceof EngineError)) throw e;
  }
  return steps;
}

/** Самая прикрытая клетка, куда можно дойти (не вплотную к врагам) */
function safestCell(state: CombatState, actor: Combatant, budget: number): Cell | null {
  let best: { cell: Cell; score: number } | null = null;
  for (const [key, node] of botReachable(state, actor, budget)) {
    const cell = parseKey(key);
    const melee = nearestMeleeThreatFt(state, actor, cell);
    if (melee <= 5) continue;
    const score = exposure(state, actor, cell) * 10 + (melee < 15 ? (15 - melee) * 2 : 0) + node.cost * 0.1;
    if (!best || score < best.score) best = { cell, score };
  }
  return best?.cell ?? null;
}

/** Остаток движения стрелка — в самую прикрытую клетку, откуда цели всё ещё видны */
function tryTakeCoverAtEndOfTurn(state: CombatState, actor: Combatant, targets: Combatant[]): BotStep | null {
  const budget = remainingMovement(actor);
  if (budget <= 0) return null;
  const score = (cell: Cell, cost: number) => {
    const melee = nearestMeleeThreatFt(state, actor, cell);
    const seesTarget = targets.some((t) => t.hpCurrent > 0 && hasLineOfSight(cell, t, state.mapElements));
    return exposure(state, actor, cell) * 10 + (melee < 15 ? (15 - melee) * 2 : 0) + (seesTarget ? 0 : 3) + cost * 0.1;
  };
  const current = score(actor, 0);
  let best: { cell: Cell; score: number } | null = null;
  for (const [key, node] of botReachable(state, actor, budget)) {
    if (node.cost === 0) continue;
    const cell = parseKey(key);
    const s = score(cell, node.cost);
    if (!best || s < best.score) best = { cell, score: s };
  }
  if (!best || best.score >= current - 1) return null;
  try {
    const move = moveCombatant(state, actor.id, best.cell, { skipTurnCheck: true, avoidHazards: true });
    if (targets[0]) actor.facing = determineFacingTowards(actor, targets[0]);
    state.mark(actor.id);
    return { kind: "move", text: `${actor.name} смещается за укрытие (${move.costFt} фт)` };
  } catch (e) {
    if (!(e instanceof EngineError)) throw e;
    return null;
  }
}

/** Направления для осмотра: влево и вправо на ±90° от начального взгляда */
function getScanningDirections(initialFacing: FacingDirection): FacingDirection[] {
  const idx = FACING_CYCLE.indexOf(initialFacing);
  const base = idx >= 0 ? idx : 0;
  const offsets = [-1, +1, -2, +2];
  return offsets.map((off) => FACING_CYCLE[(base + off + 8) % 8]);
}

/** Выбирает направление взгляда при патрулировании со смещением вероятности в сторону скрытых врагов */
function pickWeightedFacing(actor: Combatant, targets: Combatant[]): FacingDirection {
  if (targets.length === 0) {
    return FACING_CYCLE[Math.floor(Math.random() * FACING_CYCLE.length)];
  }

  const nearest = [...targets].sort((a, b) => distanceFt(actor, a) - distanceFt(actor, b))[0];
  const dirToEnemy = determineFacingTowards(actor, nearest);
  const idx = FACING_CYCLE.indexOf(dirToEnemy);
  if (idx < 0) return FACING_CYCLE[Math.floor(Math.random() * FACING_CYCLE.length)];

  const left = (idx - 1 + 8) % 8;
  const right = (idx + 1) % 8;

  const pool: FacingDirection[] = [
    dirToEnemy,
    dirToEnemy,
    dirToEnemy,
    dirToEnemy,
    FACING_CYCLE[left],
    FACING_CYCLE[left],
    FACING_CYCLE[right],
    FACING_CYCLE[right],
    ...FACING_CYCLE,
  ];

  return pool[Math.floor(Math.random() * pool.length)];
}

/** Применение заклинаний (AoE и одиночные) — разряжает при первой возможности */
function tryCastOffensiveSpell(
  state: CombatState,
  actor: Combatant,
  targets: Combatant[],
  allies: Combatant[]
): BotStep | null {
  if (actor.actionUsed && actor.extraActions <= 0) return null;
  if (!actor.spells || !actor.spells.known || actor.spells.known.length === 0) return null;

  // Доступные круги ячеек (от высшего к низшему)
  const availableSlots = Object.entries(actor.spells.slots || {})
    .filter(([_, s]) => s.used < s.max)
    .map(([l]) => Number(l))
    .sort((a, b) => b - a);
  const highestSlot = availableSlots[0] ?? 0;

  const knownSpells = actor.spells.known
    .map((nameOrId) => getSpellDefinition(nameOrId))
    .filter((s): s is NonNullable<typeof s> => !!s);

  if (knownSpells.length === 0) return null;

  // 1. Поиск лучшего AoE-заклинания (Огненные ладони, Волна грома, Дребезги, Огненный шар)
  const aoeSpells = knownSpells
    .filter(
      (s) =>
        s.parameters.aoe &&
        s.level <= highestSlot &&
        (s.parameters.actionCost === "action" || s.parameters.actionCost === "bonus")
    )
    .sort((a, b) => b.level - a.level);

  for (const spell of aoeSpells) {
    const aoe = spell.parameters.aoe!;
    const slotToUse =
      spell.level > 0 ? availableSlots.find((l) => l >= spell.level) ?? spell.level : 0;
    if (spell.level > 0 && !availableSlots.some((l) => l >= spell.level)) continue;

    for (const target of targets) {
      if (target.hpCurrent <= 0) continue;
      const targetCell = { x: target.x, y: target.y };
      const dist = distanceFt(actor, targetCell);
      const maxSpellRange = spell.parameters.range?.value ?? 60;
      if (spell.parameters.range?.type !== "self" && dist > maxSpellRange) continue;

      const affectedCells = getAoeCells(
        targetCell,
        aoe.shape,
        aoe.size,
        { x: actor.x, y: actor.y },
        state.gridWidth,
        state.gridHeight
      );

      const hitEnemies = targets.filter(
        (e) => e.hpCurrent > 0 && affectedCells.some((c) => c.x === e.x && c.y === e.y)
      );
      const hitAllies = [actor, ...allies].filter(
        (a) => a.hpCurrent > 0 && affectedCells.some((c) => c.x === a.x && c.y === a.y)
      );

      // Защита от дружественного огня: бот не бьёт по себе и союзникам
      if (spell.parameters.friendlyFire !== false && hitAllies.length > 0) continue;

      // Применяем, если задеваем 2+ врагов или мощное заклинание 3+ круга
      if (hitEnemies.length >= 2 || (hitEnemies.length >= 1 && spell.level >= 3)) {
        try {
          const res = castSpell(
            state,
            actor.id,
            { id: spell.name, name: spell.name, level: spell.level, parameters: spell.parameters },
            {
              center: targetCell,
              targetIds: hitEnemies.map((e) => e.id),
              slotLevel: slotToUse,
              skipTurnCheck: true,
            }
          );
          actor.facing = determineFacingTowards(actor, targetCell);
          state.mark(actor.id);
          return {
            kind: "ability",
            text: `${actor.name} применяет «${spell.name}» (${slotToUse} круг) — задето ${hitEnemies.length} враг(ов): ${res.text}`,
          };
        } catch {
          continue;
        }
      }
    }
  }

  // 2. Одиночные заклинания наивысшего доступного круга / мощные заговоры
  const singleSpells = knownSpells
    .filter(
      (s) =>
        !s.parameters.aoe &&
        s.level <= highestSlot &&
        (s.parameters.actionCost === "action" || s.parameters.actionCost === "bonus")
    )
    .sort((a, b) => b.level - a.level);

  for (const spell of singleSpells) {
    const slotToUse =
      spell.level > 0 ? availableSlots.find((l) => l >= spell.level) ?? spell.level : 0;
    if (spell.level > 0 && !availableSlots.some((l) => l >= spell.level)) continue;

    const maxSpellRange =
      spell.parameters.range?.value ?? (spell.parameters.range?.type === "touch" ? 5 : 60);

    for (const target of targets) {
      if (target.hpCurrent <= 0) continue;
      const dist = distanceFt(actor, target);
      if (dist > maxSpellRange) continue;
      if (!hasLineOfSight(actor, target, state.mapElements)) continue;

      try {
        const res = castSpell(
          state,
          actor.id,
          { id: spell.name, name: spell.name, level: spell.level, parameters: spell.parameters },
          {
            targetIds: [target.id],
            slotLevel: slotToUse,
            skipTurnCheck: true,
          }
        );
        actor.facing = determineFacingTowards(actor, target);
        state.mark(actor.id);
        return {
          kind: "ability",
          text: `${actor.name} творит «${spell.name}»${slotToUse > 0 ? ` (${slotToUse} круг)` : ""} на ${target.name}: ${res.text}`,
        };
      } catch {
        continue;
      }
    }
  }

  return null;
}

/** Бонусные способности и баффы ДО атаки (Лечение, Ярость, Метка, Баффы, Скрытность) */
function tryPreAttackBuffsAndHealing(
  state: CombatState,
  actor: Combatant,
  primeTarget: Combatant | undefined,
  allies: Combatant[],
  archetype: BotArchetype
): BotStep | null {
  // 1. Самолечение при критическом HP (< 45%)
  const lowHp = actor.hpCurrent < actor.hpMax * 0.45;
  if (lowHp) {
    const healAbility = actor.abilities.find(
      (a) => a.parameters?.selfHeal && (a.usesMax === 0 || a.usesUsed < a.usesMax)
    );
    if (healAbility) {
      const cost = healAbility.parameters?.actionCost ?? "bonus";
      const costAvailable = cost === "bonus" ? !actor.bonusActionUsed : !actor.actionUsed;
      if (costAvailable) {
        try {
          const res = useAbility(state, actor.id, healAbility.id, {
            targetIds: [actor.id],
            skipTurnCheck: true,
          });
          return { kind: "ability", text: `${actor.name}: ${healAbility.name} — ${res.text}` };
        } catch {}
      }
    }
  }

  // 2. Бонусные баффы перед атакой
  if (!actor.bonusActionUsed) {
    // Ярость (Rage)
    const rageAbility = actor.abilities.find(
      (a) => a.name.toLowerCase().includes("ярость") || a.name.toLowerCase().includes("rage")
    );
    if (
      rageAbility &&
      !hasCondition(actor, "raging") &&
      (rageAbility.usesMax === 0 || rageAbility.usesUsed < rageAbility.usesMax)
    ) {
      try {
        const res = useAbility(state, actor.id, rageAbility.id, {
          targetIds: [actor.id],
          skipTurnCheck: true,
        });
        return { kind: "ability", text: `${actor.name} впадает в Ярость!` };
      } catch {}
    }

    // Метка охотника / Сглаз на цель
    if (primeTarget && primeTarget.hpCurrent > 0) {
      const markAbility = actor.abilities.find(
        (a) =>
          a.name.toLowerCase().includes("метка") ||
          a.name.toLowerCase().includes("сглаз") ||
          a.name.toLowerCase().includes("hunter's mark") ||
          a.name.toLowerCase().includes("hex")
      );
      if (markAbility && (markAbility.usesMax === 0 || markAbility.usesUsed < markAbility.usesMax)) {
        try {
          const res = useAbility(state, actor.id, markAbility.id, {
            targetIds: [primeTarget.id],
            skipTurnCheck: true,
          });
          return {
            kind: "ability",
            text: `${actor.name} накладывает «${markAbility.name}» на ${primeTarget.name}`,
          };
        } catch {}
      }
    }

    // Теневой шаг / Телепорт (если цель далеко)
    if (primeTarget && distanceFt(actor, primeTarget) > 20) {
      const teleportAbility = actor.abilities.find(
        (a) =>
          a.name.toLowerCase().includes("теневой шаг") ||
          a.name.toLowerCase().includes("туманный шаг") ||
          a.name.toLowerCase().includes("teleport")
      );
      if (
        teleportAbility &&
        (teleportAbility.usesMax === 0 || teleportAbility.usesUsed < teleportAbility.usesMax)
      ) {
        const teleportRange = teleportAbility.parameters?.range?.value ?? 30;
        const nodes = botReachable(state, actor, teleportRange);
        let bestTeleportCell: Cell | null = null;
        let bestDist = 999;
        for (const [key] of nodes) {
          const [x, y] = key.split(",").map(Number);
          const d = distanceFt({ x, y }, primeTarget);
          if (d <= 5 && d < bestDist) {
            bestDist = d;
            bestTeleportCell = { x, y };
          }
        }
        if (bestTeleportCell) {
          try {
            useAbility(state, actor.id, teleportAbility.id, {
              targetIds: [actor.id],
              center: bestTeleportCell,
              skipTurnCheck: true,
            });
            actor.x = bestTeleportCell.x;
            actor.y = bestTeleportCell.y;
            actor.facing = determineFacingTowards(actor, primeTarget);
            state.mark(actor.id);
            return {
              kind: "ability",
              text: `${actor.name} использует «${teleportAbility.name}» и материализуется рядом с ${primeTarget.name}!`,
            };
          } catch {}
        }
      }
    }

    // Скрытность для Плута (Cunning Action: Hide)
    // Прячемся только если НЕ стоим в упор к врагу (так как в упор 5 фт стрелять всё равно с помехой)
    // Прячется плут-стрелок (выстрел из скрытности — с преимуществом); плут-ближник
    // прячется после удара (tryRogueVanish). На виду спрятаться нельзя — даже не пытаемся.
    const isInMeleeThreat = primeTarget && distanceFt(actor, primeTarget) <= 5;
    if (
      archetype === "rogue" &&
      prefersRanged(actor, archetype) &&
      hasCunningAction(actor) &&
      !actor.isHidden &&
      !isInMeleeThreat &&
      visibilityAt(state, actor, actor) !== "visible"
    ) {
      try {
        const hideRes = attemptHide(state, actor.id, { skipTurnCheck: true });
        return { kind: "ability", text: hideRes.text };
      } catch (e) {
        if (!(e instanceof EngineError)) throw e;
      }
    }
  }

  return null;
}

/** Кайтинг для стрелков и магов при опасности в упор */
function tryRangedKiting(
  state: CombatState,
  actor: Combatant,
  enemies: Combatant[],
  outSteps?: BotStep[]
): BotStep | null {
  const adjacentEnemies = enemies.filter((e) => e.hpCurrent > 0 && distanceFt(actor, e) <= 5);
  if (adjacentEnemies.length === 0) return null;

  const budget = remainingMovement(actor);
  if (budget <= 0) return null;

  // Плут или имеющий бонусный Отход
  const isRogue = actor.className?.toLowerCase().includes("плут");
  if (!actor.bonusActionUsed && isRogue) {
    actor.conditions = [
      ...actor.conditions.filter((c) => c.type !== "disengaging"),
      { type: "disengaging", duration: 1 },
    ];
    actor.bonusActionUsed = true;
    state.mark(actor.id);
    if (outSteps) {
      outSteps.push({
        kind: "ability",
        text: `${actor.name} использует «Хитрое действие: Отход»`,
      });
    }
  }

  const nodes = botReachable(state, actor, budget);

  let bestKite: { cell: Cell; dist: number; cost: number } | null = null;
  const nearestEnemy = adjacentEnemies[0];

  for (const [key, node] of nodes) {
    if (node.cost === 0) continue;
    const [x, y] = key.split(",").map(Number);
    const dist = distanceFt({ x, y }, nearestEnemy);
    if (dist <= 5) continue;
    if (!bestKite || dist > bestKite.dist || (dist === bestKite.dist && node.cost < bestKite.cost)) {
      bestKite = { cell: { x, y }, dist, cost: node.cost };
    }
  }

  if (bestKite) {
    // Тактический Отход (Disengage) при опасности:
    // Если заклинатель или стрелок находится в упор к активному противнику, собирается отойти,
    // имеет низкое здоровье (<= 50%) и ещё не потратил основное Действие, проверяем провокацию.
    const isAlreadyDisengaging = actor.conditions.some((c) => c.type === "disengaging");
    if (!isAlreadyDisengaging) {
      const isLowHp = actor.hpCurrent / Math.max(1, actor.hpMax) <= 0.5;
      if (!actor.actionUsed && isLowHp) {
        const pathResult = findPath(
          actor,
          bestKite.cell,
          budget,
          state.mapElements,
          state.combatants,
          state.gridWidth,
          state.gridHeight
        );
        const path = pathResult.ok ? pathResult.path : [bestKite.cell];
        const attackers = findOpportunityAttackers(
          actor,
          path,
          state.combatants,
          5,
          state.mapElements
        );
        if (attackers.length > 0) {
          actor.conditions = [
            ...actor.conditions.filter((c) => c.type !== "disengaging"),
            { type: "disengaging", duration: 1 },
          ];
          actor.actionUsed = true;
          state.mark(actor.id);
          state.addLog(
            `${actor.name} осторожно отступает (Отход), избегая провоцированных атак`,
            "ability",
            actor.name
          );
          if (outSteps) {
            outSteps.push({
              kind: "ability",
              text: `${actor.name} осторожно отступает (Отход), избегая провоцированных атак`,
            });
          }
        }
      }
    }

    try {
      const move = moveCombatant(state, actor.id, bestKite.cell, { skipTurnCheck: true, avoidHazards: true });
      actor.facing = determineFacingTowards(actor, nearestEnemy);
      state.mark(actor.id);
      return {
        kind: "move",
        text: `${actor.name} разрывает дистанцию ближнего боя (${move.costFt} фт)`,
      };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Проигрывает ход бота целиком с полной тактической логикой:
 * 1. Встать на ноги при падении
 * 2. Осмотр / поиск при отсутствии видимых целей
 * 3. Распределение целей (Anti-dogpiling)
 * 4. Кайтинг при необходимости (до баффов/атак)
 * 5. Баффы и подготовка
 * 6. Применение сильнейших заклинаний (AoE / точечные)
 * 7. Атаки оружием
 * 8. Action Surge
 * 9. Укрытие остатком движения
 */
export function runBotTurn(state: CombatState, actorOverride?: Combatant): BotTurnResult {
  const actor = actorOverride ? (state.get(actorOverride.id) ?? actorOverride) : state.current();
  const steps: BotStep[] = [];

  if (!actor) return { steps, ended: false };

  const syncOverride = () => {
    if (actorOverride && actorOverride !== actor) {
      actorOverride.hpCurrent = actor.hpCurrent;
      actorOverride.x = actor.x;
      actorOverride.y = actor.y;
      actorOverride.facing = actor.facing;
      actorOverride.actionUsed = actor.actionUsed;
      actorOverride.conditions = [...actor.conditions];
    }
  };
  if (actor.hpCurrent <= 0 || !canAct(actor)) {
    steps.push({ kind: "skip", text: `${actor.name} не может действовать — ход пропущен` });
    syncOverride();
    return { steps, ended: false };
  }

  // 0. Проверка морали для врагов в начале хода
  if (actor.type === "enemy" && !hasCondition(actor, "fleeing")) {
    const trigger = checkMoraleTrigger(actor, state.combatants);
    if (trigger.shouldCheck) {
      const check = resolveMoraleCheck(actor, 10);
      if (!check.passed) {
        applyMoraleFailure(state, actor.id);
        syncOverride();
      }
    }
  }

  // 0.5. Логика бегства (Fleeing AI): бот сломлен паникой и бежит к краю карты
  if (hasCondition(actor, "fleeing")) {
    steps.push({ kind: "move", text: `${actor.name} в панике бежит к краю карты` });

    const checkEscape = () => {
      if (
        actor.x <= 0 ||
        actor.x >= state.gridWidth - 1 ||
        actor.y <= 0 ||
        actor.y >= state.gridHeight - 1
      ) {
        actor.hpCurrent = 0;
        state.addLog(`${actor.name} скрывается в чаще и покидает поле боя!`, "system", actor.name);
        // removeCombatant помечает бойца на удаление из БД: раньше он исчезал только из памяти,
        // оставался «живым» в базе, и бой не мог завершиться
        state.removeCombatant(actor.id);
        syncOverride();
        return true;
      }
      return false;
    };

    if (checkEscape()) {
      return { steps, ended: false };
    }

    const threats = state.combatants.filter(
      (c) => c.hpCurrent > 0 && isHostile(actor.type, c.type)
    );
    const dest = getFleeingDestination(actor, state.gridWidth, state.gridHeight, threats);

    // Базовое перемещение к краю карты
    const moveCell = findClosestCellTowardsTarget(state, actor, dest);
    if (moveCell) {
      try {
        const move = moveCombatant(state, actor.id, moveCell, { skipTurnCheck: true, avoidHazards: true });
        actor.facing = determineFacingTowards(actor, dest);
        state.mark(actor.id);
        syncOverride();
        for (const oa of move.opportunityAttacks) {
          steps.push({ kind: "attack", text: oa.text });
        }
      } catch (e) {
        if (!(e instanceof EngineError)) throw e;
      }
    }

    if (checkEscape()) {
      return { steps, ended: false };
    }

    // Если осталось движение
    if (remainingMovement(actor) > 0) {
      const moveCell2 = findClosestCellTowardsTarget(state, actor, dest);
      if (moveCell2) {
        try {
          const move2 = moveCombatant(state, actor.id, moveCell2, { skipTurnCheck: true, avoidHazards: true });
          actor.facing = determineFacingTowards(actor, dest);
          state.mark(actor.id);
          syncOverride();
          for (const oa of move2.opportunityAttacks) {
            steps.push({ kind: "attack", text: oa.text });
          }
        } catch (e) {
          if (!(e instanceof EngineError)) throw e;
        }
      }
      if (checkEscape()) {
        return { steps, ended: false };
      }
    }

    // Если действие доступно — совершает Рывок (Dash) для удвоения скорости
    if (!actor.actionUsed) {
      actor.conditions = [
        ...actor.conditions.filter((c) => c.type !== "dashing"),
        { type: "dashing", duration: 1 },
      ];
      actor.actionUsed = true;
      state.mark(actor.id);

      const dashCell = findClosestCellTowardsTarget(state, actor, dest);
      if (dashCell) {
        try {
          const dashMove = moveCombatant(state, actor.id, dashCell, { skipTurnCheck: true, avoidHazards: true });
          actor.facing = determineFacingTowards(actor, dest);
          state.mark(actor.id);
          syncOverride();
          for (const oa of dashMove.opportunityAttacks) {
            steps.push({ kind: "attack", text: oa.text });
          }
        } catch (e) {
          if (!(e instanceof EngineError)) throw e;
        }
      }

      if (checkEscape()) {
        return { steps, ended: false };
      }
    }

    syncOverride();
    return { steps, ended: false };
  }

  const archetype = getBotArchetype(actor);
  const turnBudget: TurnBudget = { interactionUsed: false };
  const initialFacing = actor.facing || (actor.type === "enemy" ? "W" : "E");
  let enemies = hostilesOf(state, actor);
  const allies = alliesOf(state, actor);

  // 1. Снятие лежачего положения (Stand Up)
  if (hasCondition(actor, "prone")) {
    const speed = effectiveSpeed(actor);
    const cost = Math.floor(speed / 2);
    if (remainingMovement(actor) >= cost) {
      try {
        standUp(state, actor.id, { skipTurnCheck: true });
        steps.push({ kind: "move", text: `${actor.name} поднимается на ноги (${cost} фт движения)` });
      } catch {}
    }
  }

  // 2. Если врагов в текущем поле зрения нет — бот осматривается вправо/влево и патрулирует
  if (enemies.length === 0) {
    const allLivingHostiles = state.combatants.filter(
      (t) => t.hpCurrent > 0 && isHostile(actor.type, t.type)
    );

    if (allLivingHostiles.length === 0) {
      steps.push({ kind: "skip", text: `${actor.name}: противников не осталось` });
      return { steps, ended: false };
    }

    const scanDirs = getScanningDirections(initialFacing);
    let spottedTarget: Combatant | null = null;
    let spottedFacing: FacingDirection = initialFacing;

    for (const dir of scanDirs) {
      const probe = { ...actor, facing: dir };
      const found = allLivingHostiles.find((t) => isPerceivableByBot(probe, t, state.mapElements));
      if (found) {
        spottedTarget = found;
        spottedFacing = dir;
        break;
      }
    }

    if (spottedTarget) {
      actor.facing = spottedFacing;
      state.mark(actor.id);
      steps.push({
        kind: "move",
        text: `${actor.name} осматривается по сторонам (${spottedFacing}) и замечает ${spottedTarget.name}!`,
      });
      enemies = [spottedTarget];
    } else {
      const budget = remainingMovement(actor);
      if (budget > 0) {
        const nodes = botReachable(state, actor, budget);

        let candidates: Cell[] = [];
        for (const [key, node] of nodes) {
          if (node.cost >= 15 && node.cost <= budget) {
            const [x, y] = key.split(",").map(Number);
            candidates.push({ x, y });
          }
        }
        if (candidates.length === 0) {
          for (const [key, node] of nodes) {
            if (node.cost >= 10 && node.cost <= budget) {
              const [x, y] = key.split(",").map(Number);
              candidates.push({ x, y });
            }
          }
        }

        if (candidates.length > 0) {
          if (allLivingHostiles.length > 0) {
            const nearest = allLivingHostiles[0];
            candidates.sort((a, b) => distanceFt(a, nearest) - distanceFt(b, nearest));
            candidates = candidates.slice(0, Math.max(1, Math.ceil(candidates.length * 0.6)));
          }

          const randomCell = candidates[Math.floor(Math.random() * candidates.length)];
          try {
            const move = moveCombatant(state, actor.id, randomCell, { skipTurnCheck: true, avoidHazards: true });
            const smartFacing = pickWeightedFacing(actor, allLivingHostiles);
            actor.facing = smartFacing;
            state.mark(actor.id);
            steps.push({
              kind: "move",
              text: `${actor.name} никого не видит, патрулирует территорию (${move.costFt} фт) и осматривается в сторону ${smartFacing}`,
            });
          } catch {}
        } else {
          const smartFacing = pickWeightedFacing(actor, allLivingHostiles);
          actor.facing = smartFacing;
          state.mark(actor.id);
          steps.push({
            kind: "move",
            text: `${actor.name} никого не видит и осматривается в сторону ${smartFacing}`,
          });
        }
      }

      if (!actor.actionUsed) {
        actor.conditions = [
          ...actor.conditions.filter((c) => c.type !== "dodging"),
          { type: "dodging", duration: 1 },
        ];
        actor.actionUsed = true;
        state.mark(actor.id);
        steps.push({
          kind: "ability",
          text: `${actor.name} занимает защитную стойку (Уклонение)`,
        });
      }
      return { steps, ended: false };
    }
  }

  // 3. Сортировка целей с учётом распределения и ролей (Anti-dogpiling)
  const targets = [...enemies].sort(
    (a, b) =>
      evaluateTargetScore(actor, a, allies, archetype) -
      evaluateTargetScore(actor, b, allies, archetype)
  );
  const primeTarget = targets[0];
  const shooter = prefersRanged(actor, archetype);

  // 3.5. Цель за закрытой дверью: дойти и открыть (стрелку — если не по кому стрелять)
  if (primeTarget && (!shooter || !targets.some((t) => hasLineOfSight(actor, t, state.mapElements)))) {
    steps.push(...tryOpenDoorOnRoute(state, actor, primeTarget, turnBudget));
  }

  // 4. Стрелки и маги: из упора — отход, иначе позиция для стрельбы за укрытием
  if (shooter || actor.tacticalRole === "backline") {
    const kited = tryRangedKiting(state, actor, enemies, steps);
    if (kited) steps.push(kited);
    else if (shooter) {
      const position = tryTakeFiringPosition(state, actor, targets, archetype);
      if (position) steps.push(position);
    }
  }

  // 5. Бонусные баффы и подготовка перед атакой (Лечение, Ярость, Метка, Скрытность)
  const preBuff = tryPreAttackBuffsAndHealing(state, actor, primeTarget, allies, archetype);
  if (preBuff) steps.push(preBuff);

  // 6. Применение сильнейших заклинаний (AoE / мощные точечные)
  if (archetype === "caster" || (actor.spells && actor.spells.known && actor.spells.known.length > 0)) {
    const spellStep = tryCastOffensiveSpell(state, actor, targets, allies);
    if (spellStep) {
      steps.push(spellStep);
    }
  }

  // 6.5. Перезаряжаемые способности (Дыхание дракона и т.д.)
  if (actor.rechargeAbilities && actor.rechargeAbilities.length > 0 && !actor.actionUsed) {
    const readyAbility = actor.rechargeAbilities.find((ra) => ra.isCharged);
    if (readyAbility && targets.length > 0) {
      const matchAbil = actor.abilities.find(
        (a) => a.id === readyAbility.id || a.name === readyAbility.name
      );
      if (matchAbil) {
        try {
          const topTarget = targets.find((t) => t.hpCurrent > 0);
          if (topTarget) {
            const res = useAbility(state, actor.id, matchAbil.id, {
              targetIds: [topTarget.id],
              skipTurnCheck: true,
            });
            readyAbility.isCharged = false;
            steps.push({
              kind: "ability",
              text: `${actor.name}: ${readyAbility.name} — ${res.text}`,
            });
          }
        } catch {}
      }
    }
  }

  // 6.6. Мультиатака монстра (приоритет над одиночной базовой атакой)
  if (actor.multiattack && !actor.actionUsed && actor.multiattack.attacks.length > 0) {
    const primaryAttackId = actor.multiattack.attacks[0]?.attackId;
    const sampleAttack =
      actor.attacks.find((a) => a.id === primaryAttackId) || actor.attacks[0];

    if (sampleAttack) {
      let chosen: Combatant | null = null;
      for (const t of targets) {
        if (t.hpCurrent <= 0) continue;
        if (checkReach(actor, t, sampleAttack, state.mapElements).ok) {
          chosen = t;
          actor.facing = determineFacingTowards(actor, t);
          state.mark(actor.id);
          break;
        }
      }

      if (!chosen) {
        let approached = false;
        for (const t of targets) {
          if (t.hpCurrent <= 0) continue;
          const cell = findApproachCell(state, actor, t, sampleAttack);
          if (!cell) continue;
          try {
            const move = moveCombatant(state, actor.id, cell, { skipTurnCheck: true, avoidHazards: true });
            actor.facing = determineFacingTowards(actor, t);
            state.mark(actor.id);
            steps.push({
              kind: "move",
              text: `${actor.name} подходит к ${t.name} (${move.costFt} фт)`,
            });
            for (const oa of move.opportunityAttacks) {
              steps.push({ kind: "attack", text: oa.text });
            }
            approached = true;
            break;
          } catch (e) {
            if (!(e instanceof EngineError)) throw e;
          }
        }

        if (approached) {
          chosen =
            targets.find(
              (t) =>
                t.hpCurrent > 0 &&
                checkReach(actor, t, sampleAttack, state.mapElements).ok
            ) ?? null;
        }
      }

      if (chosen && actor.hpCurrent > 0) {
        try {
          const multiRes = performMultiattack(state, actor.id, chosen.id, {
            skipTurnCheck: true,
          });
          steps.push({
            kind: "attack",
            text: `${actor.name} проводит Мультиатаку (${actor.multiattack.name}) по ${chosen.name} (попаданий: ${multiRes.totalHits}/${multiRes.attacks.length}, урон: ${multiRes.totalDamage})`,
          });
        } catch (e) {
          if (!(e instanceof EngineError)) throw e;
        }
      }
    }
  }

  // 7. Основные атаки оружием
  for (let guard = 0; guard < 6; guard++) {
    if (actor.hpCurrent <= 0) break;

    const isAdjacentToEnemy = targets.some((t) => t.hpCurrent > 0 && distanceFt(actor, t) <= 5);
    const attackKinds: Attack["kind"][] = isAdjacentToEnemy
      ? ["melee", "ranged"]
      : ["ranged", "melee"];

    const attack = bestAttack(actor, attackKinds);
    if (!attack) break;

    // Ищем цель, до которой уже достаём
    let chosen: Combatant | null = null;
    for (const t of targets) {
      if (t.hpCurrent <= 0) continue;
      if (checkReach(actor, t, attack, state.mapElements).ok) {
        chosen = t;
        actor.facing = determineFacingTowards(actor, t);
        state.mark(actor.id);
        break;
      }
    }

    if (!chosen) {
      let approached = false;
      for (const t of targets) {
        if (t.hpCurrent <= 0) continue;
        const cell = findApproachCell(state, actor, t, attack);
        if (!cell) continue;
        try {
          const move = moveCombatant(state, actor.id, cell, { skipTurnCheck: true, avoidHazards: true });
          actor.facing = determineFacingTowards(actor, t);
          state.mark(actor.id);
          steps.push({
            kind: "move",
            text: `${actor.name} подходит к ${t.name} (${move.costFt} фт)`,
          });
          for (const oa of move.opportunityAttacks) {
            steps.push({ kind: "attack", text: oa.text });
          }
          approached = true;
          break;
        } catch (e) {
          if (!(e instanceof EngineError)) throw e;
        }
      }

      if (!approached && targets.length > 0) {
        const topTarget = targets.find((t) => t.hpCurrent > 0);
        if (topTarget) {
          const closeCell = findClosestCellTowardsTarget(state, actor, topTarget);
          if (closeCell) {
            try {
              const move = moveCombatant(state, actor.id, closeCell, { skipTurnCheck: true, avoidHazards: true });
              actor.facing = determineFacingTowards(actor, topTarget);
              state.mark(actor.id);
              steps.push({
                kind: "move",
                text: `${actor.name} бежит в сторону ${topTarget.name} (${move.costFt} фт)`,
              });
              for (const oa of move.opportunityAttacks) {
                steps.push({ kind: "attack", text: oa.text });
              }
              approached = true;
            } catch (e) {
              if (!(e instanceof EngineError)) throw e;
            }
          }

          if (
            !actor.actionUsed &&
            remainingMovement(actor) <= 0 &&
            !checkReach(actor, topTarget, attack, state.mapElements).ok
          ) {
            actor.conditions = [
              ...actor.conditions.filter((c) => c.type !== "dashing"),
              { type: "dashing", duration: 1 },
            ];
            actor.actionUsed = true;
            state.mark(actor.id);
            steps.push({
              kind: "ability",
              text: `${actor.name} совершает Рывок для ускорения`,
            });
            const dashCell = findClosestCellTowardsTarget(state, actor, topTarget);
            if (dashCell) {
              try {
                const move = moveCombatant(state, actor.id, dashCell, { skipTurnCheck: true, avoidHazards: true });
                steps.push({
                  kind: "move",
                  text: `${actor.name} на рывке приближается к ${topTarget.name} (${move.costFt} фт)`,
                });
                for (const oa of move.opportunityAttacks) {
                  steps.push({ kind: "attack", text: oa.text });
                }
              } catch (e) {
                if (!(e instanceof EngineError)) throw e;
              }
            }
          }
        }
      }

      if (!approached) break;
      if (actor.hpCurrent <= 0) break;

      chosen =
        targets.find((t) => t.hpCurrent > 0 && checkReach(actor, t, attack, state.mapElements).ok) ??
        null;
      if (!chosen) break;
    }

    try {
      const result = performAttack(state, actor.id, chosen.id, attack.id, {
        skipTurnCheck: true,
      });
      steps.push({ kind: "attack", text: result.text });
    } catch (e) {
      if (e instanceof EngineError) break;
      throw e;
    }
  }

  // 8. Action Surge (Порыв к действию) — если действие потрачено, есть враг в упор/дистанции, разряжаем!
  if (actor.actionUsed && actor.extraActions === 0) {
    const surgeAbility = actor.abilities.find(
      (a) =>
        a.name.toLowerCase().includes("порыв к действию") ||
        a.name.toLowerCase().includes("action surge")
    );
    if (
      surgeAbility &&
      (surgeAbility.usesMax === 0 || surgeAbility.usesUsed < surgeAbility.usesMax)
    ) {
      try {
        const res = useAbility(state, actor.id, surgeAbility.id, {
          targetIds: [actor.id],
          skipTurnCheck: true,
        });
        steps.push({
          kind: "ability",
          text: `${actor.name}: ${surgeAbility.name} — ${res.text}`,
        });

        const extraAttack = bestAttack(actor, ["melee", "ranged"]);
        if (extraAttack && primeTarget && primeTarget.hpCurrent > 0) {
          if (checkReach(actor, primeTarget, extraAttack, state.mapElements).ok) {
            const atkRes = performAttack(state, actor.id, primeTarget.id, extraAttack.id, {
              skipTurnCheck: true,
            });
            steps.push({ kind: "attack", text: atkRes.text });
          }
        }
      } catch {}
    }
  }

  // 9. Конец хода: плут уходит и прячется, стрелки и маги — за укрытие,
  //    раненый захлопывает дверь перед вражескими ближниками
  const vanished = archetype === "rogue" && actor.hpCurrent > 0 ? tryRogueVanish(state, actor) : [];
  steps.push(...vanished);
  if (shooter && vanished.length === 0 && actor.hpCurrent > 0) {
    const coverStep = tryTakeCoverAtEndOfTurn(state, actor, targets);
    if (coverStep) steps.push(coverStep);
  }
  if (actor.hpCurrent > 0 && (shooter || actor.hpCurrent <= actor.hpMax / 2)) {
    const doorStep = tryCloseDoorBehind(state, actor, turnBudget);
    if (doorStep) steps.push(doorStep);
  }

  if (steps.length === 0 && !actor.actionUsed) {
    // Проход перекрыт (чаще всего своими же в узком коридоре) — хотя бы не подставляться
    actor.conditions = [...actor.conditions.filter((c) => c.type !== "dodging"), { type: "dodging", duration: 1 }];
    actor.actionUsed = true;
    state.mark(actor.id);
    steps.push({ kind: "ability", text: `${actor.name} не может пробиться к врагу и уходит в глухую оборону (Уклонение)` });
  }
  if (steps.length === 0) {
    steps.push({ kind: "skip", text: `${actor.name} ничего не смог сделать` });
  }

  syncOverride();
  return { steps, ended: false };
}

/** Бот сыграл ход и передаёт его дальше */
export function finishBotTurn(state: CombatState): void {
  endTurn(state);
}

/** Автономно выполняет полный ход бота и завершает его */
export function decideBotTurn(state: CombatState, actorId?: string): BotTurnResult {
  if (actorId) {
    const idx = state.turnOrder.indexOf(actorId);
    if (idx !== -1) {
      state.currentTurnIndex = idx;
    }
  }
  const res = runBotTurn(state);
  finishBotTurn(state);
  return { ...res, ended: true };
}

/** Управляется ли текущий боец ботом */
export function isBotTurn(state: CombatState): boolean {
  const c = state.current();
  if (!c) return false;
  return c.isAIControlled || c.type === "enemy" || c.type === "npc";
}

