// Обвязка для боевых тестов классов: герой любого класса и подкласса, собранный так же, как в игре
// (extractAbilitiesFromCharacter), и состояние боя без БД.
// Math.random в тестах зафиксирован на 0.5: к20 = 11, к3 = 2, к4 = 3, к6 = 4, к8 = 5, к10 = 6, к12 = 7.

import { extractAbilitiesFromCharacter } from "../../character-adapter";
import type { Combatant } from "../../types";
import { hero, type HeroOptions } from "./fighter-harness";

export { ally, bySrd, enemy, hasLog, makeState } from "./fighter-harness";

/** Герой класса `className` с подклассом: атаки «sword» (1к8+3, +7) и «bow», характеристики как у hero() */
export function classHero(className: string, id: string, subclass: string, level: number, o: HeroOptions = {}): Combatant {
  const c = hero(id, "", level, o);
  c.className = className;
  c.abilities = extractAbilitiesFromCharacter({ id, class: className, subclass, ...(o.sheet ?? {}) }, level, c.profBonus, c.abilityMods);
  return c;
}

/** Способность по названию */
export const byName = (c: Combatant, name: string) => {
  const a = c.abilities.find((x) => x.name === name);
  if (!a) throw new Error(`${c.name}: нет способности «${name}»`);
  return a;
};

export const hasKey = (c: Combatant, key: string) => c.abilities.some((a) => a.parameters?.srdKey === key);
export const cond = (c: Combatant, type: string) => c.conditions.find((x) => x.type === type);
