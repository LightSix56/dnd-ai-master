// Общая обвязка для боевых тестов рас: герой с выбранной расой, подрасой и классом.
// Math.random в тестах фиксируется через vi.spyOn(Math, "random").

import { proficiencyBonus } from "@/lib/dnd/dice";
import { extractAbilitiesFromCharacter } from "../../character-adapter";
import { resolveRaceForCharacter } from "../../races/race-defs";
import type { Combatant } from "../../types";
import { hero, type HeroOptions } from "./fighter-harness";

export { ally, bySrd, enemy, hasLog, makeState } from "./fighter-harness";
export { byName, cond, hasKey } from "./class-harness";

export interface RaceHeroOptions extends HeroOptions {
  className?: string;
  subclass?: string;
  racialVariants?: string[];
  profBonus?: number;
}

/** Герой с расой (и опциональной подрасой), собранный поверх fighter/class-harness */
export function raceHero(
  raceQuery: string,
  subraceQuery: string | null,
  id: string,
  level: number,
  o: RaceHeroOptions = {}
): Combatant {
  const c = hero(id, "", level, o);
  const profBonus = o.profBonus ?? proficiencyBonus(level);
  c.profBonus = profBonus;
  if (o.className !== undefined) c.className = o.className;

  if (o.className !== undefined || o.subclass || profBonus !== 3) {
    c.abilities = extractAbilitiesFromCharacter(
      { id, class: o.className ?? c.className, subclass: o.subclass ?? "", ...(o.sheet ?? {}) },
      level,
      profBonus,
      c.abilityMods
    );
  }

  const loadout = resolveRaceForCharacter(
    {
      race: raceQuery,
      subrace: subraceQuery,
      level,
      profBonus: c.profBonus,
      abilityMods: c.abilityMods,
      sheet: o.sheet,
      racialVariants: o.racialVariants,
    },
    id
  );
  if (!loadout) {
    throw new Error(`Неизвестная раса в raceHero: «${raceQuery}»${subraceQuery ? ` / «${subraceQuery}»` : ""}`);
  }

  c.race = loadout.raceName;
  c.raceId = loadout.raceId;
  if (loadout.subraceName) c.subrace = loadout.subraceName;
  if (loadout.subraceId) c.subraceId = loadout.subraceId;
  c.darkvision = loadout.darkvision;
  c.speed = loadout.speeds.walk;
  const specialSpeeds: NonNullable<Combatant["speeds"]> = {};
  if (loadout.speeds.fly) specialSpeeds.fly = loadout.speeds.fly;
  if (loadout.speeds.swim) specialSpeeds.swim = loadout.speeds.swim;
  if (loadout.speeds.climb) specialSpeeds.climb = loadout.speeds.climb;
  if (loadout.speeds.burrow) specialSpeeds.burrow = loadout.speeds.burrow;
  c.speeds = specialSpeeds;
  c.size = loadout.size;
  c.racialVariants = loadout.racialVariants;

  c.abilities = [...c.abilities, ...loadout.abilities];
  if (loadout.naturalAttacks.length > 0) {
    c.attacks = [...c.attacks, ...loadout.naturalAttacks];
  }
  if (loadout.resistances.length > 0) {
    c.damageResistances = [...new Set([...(c.damageResistances ?? []), ...loadout.resistances])];
  }
  if (loadout.conditionImmunities.length > 0) {
    c.conditionImmunities = [...new Set([...(c.conditionImmunities ?? []), ...loadout.conditionImmunities])];
  }

  return c;
}
