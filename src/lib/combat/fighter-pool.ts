// Запасы и «заряженные» умения подклассов Воина: кости превосходства, кости псионической энергии,
// Магические выстрелы и приёмы, которые игрок выбирает перед атакой.
//
// Чистые функции без обращения к движку: ими пользуются и правила (rules.ts), и боевая логика
// (fighter-combat.ts), поэтому здесь нет импортов из engine.ts.

import { rollDice } from "@/lib/dnd/dice";
import type { CombatAbility, Combatant, Condition } from "./types";

/** Состояние «умение заряжено»: сработает при ближайшем подходящем попадании. source — srdKey умения */
export const RIDER_COND = "fighter_rider";

export const SUPERIORITY_POOL = "battlemaster/combat-superiority";
export const PSIONIC_POOL = "psi-warrior/psionic-power";
export const ARCANE_SHOT_POOL = "arcane-archer/arcane-shot";

/** Умение бойца по ключу SRD/dnd.su («battlemaster/parry») */
export function abilityByKey(c: Combatant, key: string): CombatAbility | undefined {
  return c.abilities?.find((a) => a.parameters?.srdKey === key);
}

/** Сколько зарядов осталось в запасе; 0, если запаса нет */
export function poolLeft(c: Combatant, poolKey: string): number {
  const pool = abilityByKey(c, poolKey);
  return pool ? Math.max(0, pool.usesMax - pool.usesUsed) : 0;
}

/** Размер кости запаса (к8 у Мастера боевых искусств), 0 если у запаса нет кости */
export function poolFaces(c: Combatant, poolKey: string): number {
  return abilityByKey(c, poolKey)?.parameters?.featureValue ?? 0;
}

/** Списывает заряд запаса; false, если запас пуст */
export function spendPool(c: Combatant, poolKey: string, amount = 1): boolean {
  const pool = abilityByKey(c, poolKey);
  if (!pool || pool.usesMax - pool.usesUsed < amount) return false;
  pool.usesUsed += amount;
  c.abilities = [...c.abilities];
  return true;
}

/** Тратит кость запаса и бросает её; null, если костей не осталось. Критический удар кости не удваивает */
export function rollPoolDie(c: Combatant, poolKey: string, count = 1): { total: number; faces: number } | null {
  const faces = poolFaces(c, poolKey);
  if (!faces || !spendPool(c, poolKey)) return null;
  return { total: rollDice(`${count}d${faces}`).total, faces };
}

/** Броски кубов по формуле «2d6»; при крите кости удваиваются */
export function rollDiceCrit(dice: string, crit: boolean): number {
  const m = dice.match(/^(\d+)d(\d+)$/);
  if (!m) return 0;
  return rollDice(`${Number(m[1]) * (crit ? 2 : 1)}d${m[2]}`).total;
}

// ============ ЗАРЯЖЕННЫЕ УМЕНИЯ ============

export function armedRiders(c: Combatant): Condition[] {
  return c.conditions.filter((x) => x.type === RIDER_COND);
}

export function armedRider(c: Combatant, key: string): Condition | undefined {
  return c.conditions.find((x) => x.type === RIDER_COND && x.source === key);
}

/** Заряжает умение до конца хода; повторная зарядка того же умения ничего не меняет */
export function armRider(c: Combatant, key: string, targetId?: string): void {
  c.conditions = [
    ...c.conditions.filter((x) => !(x.type === RIDER_COND && x.source === key)),
    { type: RIDER_COND, source: key, duration: 1, ...(targetId ? { targetId } : {}) },
  ];
}

export function disarmRider(c: Combatant, key: string): void {
  c.conditions = c.conditions.filter((x) => !(x.type === RIDER_COND && x.source === key));
}

/**
 * Точная атака: кость превосходства прибавляется к промаху, если этого хватает для попадания.
 * Возвращает прибавку к броску (0 — умение не заряжено, костей нет или промах слишком велик)
 */
export function spendPrecisionAttack(attacker: Combatant, missBy: number): { bonus: number; faces: number } | null {
  const key = "battlemaster/precision-attack";
  if (!armedRider(attacker, key)) return null;
  const faces = poolFaces(attacker, SUPERIORITY_POOL);
  // Кость, которой не хватит даже при максимальном броске, не тратим
  if (!faces || faces < missBy) return null;
  const die = rollPoolDie(attacker, SUPERIORITY_POOL);
  if (!die) return null;
  disarmRider(attacker, key);
  return { bonus: die.total, faces: die.faces };
}

/** Состояния, чьё значение прибавляется к КД (кость Активного уклонения, Защитный манёвр) */
export const AC_BONUS_CONDITIONS = ["evasive_footwork", "bait_and_switch", "warding_maneuver"] as const;

export function dynamicAcBonus(c: Combatant): number {
  return c.conditions.reduce((sum, x) => sum + ((AC_BONUS_CONDITIONS as readonly string[]).includes(x.type) ? x.value ?? 0 : 0), 0);
}
