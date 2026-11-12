// Запасы и чистые функции подклассов Плута: кости псионической энергии Клинка души и безделушки Фантома.
//
// Файл без обращений к движку: ним пользуются и правила броска атаки (rules.ts), и боевая часть
// (classes/rogue-combat.ts).

import { rollDice } from "@/lib/dnd/dice";
import { abilityByKey, poolLeft, spendPool } from "./fighter-pool";
import type { Attack, Combatant } from "./types";

/** Запас костей псионической энергии Клинка души (ключ умения) */
export const PSIONIC_DICE_POOL = "soulknife/psionic-power";
/** Запас безделушек Фантома: «осталось» = сколько безделушек у плута сейчас */
export const SOUL_TRINKETS_POOL = "phantom/soul-trinkets";

/** Идентификаторы атак психическим клинком */
export const BLADE_ATTACK_ID = "psychic_blade";
export const BLADE_BONUS_ATTACK_ID = "psychic_blade_bonus";

export const isPsychicBlade = (attack: Pick<Attack, "id">) => attack.id === BLADE_ATTACK_ID || attack.id === BLADE_BONUS_ATTACK_ID;

/** Размер кости псионической энергии по уровню плута (dnd.su, 2014): к6, с 5 ур. к8, с 11 ур. к10, с 17 ур. к12 */
export function psionicFaces(level: number): number {
  return level >= 17 ? 12 : level >= 11 ? 10 : level >= 5 ? 8 : 6;
}

/**
 * Самонаводящиеся удары (Клинки души, 9 ур.): промах психическим клинком можно исправить костью
 * псионической энергии. Кость бросается, но расходуется только если с ней удар попал.
 */
export function spendHomingStrike(attacker: Combatant, attack: Attack, missBy: number): { bonus: number; faces: number } | null {
  if (!isPsychicBlade(attack) || !abilityByKey(attacker, "soulknife/soul-blades")) return null;
  const pool = abilityByKey(attacker, PSIONIC_DICE_POOL);
  if (!pool || poolLeft(attacker, PSIONIC_DICE_POOL) < 1) return null;
  const faces = pool.parameters?.featureValue ?? psionicFaces(attacker.level || 1);
  const bonus = rollDice(`1d${faces}`).total;
  if (bonus < missBy) return null;
  spendPool(attacker, PSIONIC_DICE_POOL);
  return { bonus, faces };
}
