import type { CombatState } from "./engine";
import type { Cell, Combatant } from "./types";

export interface MoraleTriggerCheck {
  shouldCheck: boolean;
  reason?: "boss_killed" | "squad_half_dead" | "critical_hp";
}

/**
 * Проверяет условия паники / проверки морали:
 * 1. Только живой враг (hpCurrent > 0 && type === 'enemy').
 * 2. Не проверяется, если существо уже в панике (fleeing), босс (tacticalRole === 'boss')
 *    или имеет иммунитет к страху / черту 'бесстрашный'.
 * 3. Триггер 'boss_killed': есть босс и все боссы мертвы (hpCurrent <= 0).
 * 4. Триггер 'squad_half_dead': погибло >= 50% врагов отряда (при условии не менее 2 погибших).
 */
export function checkMoraleTrigger(
  combatant: Combatant,
  allCombatants: Combatant[]
): MoraleTriggerCheck {
  if (combatant.hpCurrent <= 0 || combatant.type !== "enemy") {
    return { shouldCheck: false };
  }

  if (combatant.conditions?.some((c) => c.type === "fleeing")) {
    return { shouldCheck: false };
  }

  if (combatant.tacticalRole === "boss") {
    return { shouldCheck: false };
  }

  const hasFearlessTrait = combatant.monsterTraits?.some((t) => {
    const name = (t.name || "").toLowerCase();
    const desc = (t.description || "").toLowerCase();
    return (
      name.includes("бесстрашный") ||
      desc.includes("бесстрашный") ||
      name.includes("fearless") ||
      desc.includes("fearless")
    );
  });
  if (hasFearlessTrait) {
    return { shouldCheck: false };
  }

  const hasFearImmunity = combatant.conditionImmunities?.some((ci) => {
    const s = ci.toLowerCase();
    return s === "frightened" || s === "испуг" || s === "испуган";
  });
  if (hasFearImmunity) {
    return { shouldCheck: false };
  }

  // Триггер 1: Босс повержен
  const enemyBosses = allCombatants.filter(
    (c) => c.type === "enemy" && c.tacticalRole === "boss"
  );
  if (enemyBosses.length > 0 && enemyBosses.every((b) => b.hpCurrent <= 0)) {
    return { shouldCheck: true, reason: "boss_killed" };
  }

  // Триггер 2: Отряд потерял >= 50% состава (при минимум 2 погибших)
  const allEnemies = allCombatants.filter((c) => c.type === "enemy");
  const deadEnemies = allEnemies.filter((c) => c.hpCurrent <= 0);
  if (deadEnemies.length >= 2 && deadEnemies.length >= allEnemies.length / 2) {
    return { shouldCheck: true, reason: "squad_half_dead" };
  }

  return { shouldCheck: false };
}

/**
 * Проводит спасбросок Мудрости для проверки морали против DC (по умолчанию 10).
 */
export function resolveMoraleCheck(
  combatant: Combatant,
  dc = 10,
  d20RollOverride?: number
): { passed: boolean; roll: number; dc: number } {
  const wisMod = combatant.saves?.WIS?.mod ?? combatant.abilityMods?.WIS ?? 0;
  const d20 = d20RollOverride ?? Math.floor(Math.random() * 20) + 1;
  const total = d20 + wisMod;
  return {
    passed: total >= dc,
    roll: total,
    dc,
  };
}

/**
 * Применяет состояние бегства / паники к бойцу при провале морали.
 */
export function applyMoraleFailure(state: CombatState, combatantId: string): void {
  const combatant = state.get(combatantId);
  if (!combatant) return;

  combatant.conditions = [
    ...combatant.conditions.filter((c) => c.type !== "fleeing"),
    { type: "fleeing", duration: 10, durationRounds: 10 },
  ];
  state.addLog(`${combatant.name} сломлен паникой и обращается в бегство!`, "system", combatant.name);
  state.mark(combatant.id);
  state.markCombat();
}

/**
 * Рассчитывает точку побега у границы карты подальше от игроков / врагов.
 */
export function getFleeingDestination(
  actor: Combatant,
  gridWidth: number,
  gridHeight: number,
  enemiesOrPlayers: Combatant[]
): Cell {
  const w = Math.max(1, gridWidth);
  const h = Math.max(1, gridHeight);

  const borderCells: Cell[] = [];
  for (let x = 0; x < w; x++) {
    borderCells.push({ x, y: 0 });
    if (h > 1) borderCells.push({ x, y: h - 1 });
  }
  for (let y = 1; y < h - 1; y++) {
    borderCells.push({ x: 0, y });
    if (w > 1) borderCells.push({ x: w - 1, y });
  }

  if (borderCells.length === 0) {
    return { x: 0, y: 0 };
  }

  const livingThreats = (enemiesOrPlayers || []).filter((p) => p.hpCurrent > 0);

  if (livingThreats.length === 0) {
    let bestCell = borderCells[0];
    let bestDist = Infinity;
    for (const c of borderCells) {
      const d = Math.hypot(c.x - actor.x, c.y - actor.y);
      if (d < bestDist) {
        bestDist = d;
        bestCell = c;
      }
    }
    return bestCell;
  }

  let bestCell = borderCells[0];
  let bestScore = Infinity;

  for (const c of borderCells) {
    const distToActor = Math.hypot(c.x - actor.x, c.y - actor.y);
    let minThreatDist = Infinity;
    for (const threat of livingThreats) {
      const td = Math.hypot(c.x - threat.x, c.y - threat.y);
      if (td < minThreatDist) {
        minThreatDist = td;
      }
    }

    const score = distToActor - minThreatDist * 1.5;
    if (score < bestScore) {
      bestScore = score;
      bestCell = c;
    }
  }

  return bestCell;
}
