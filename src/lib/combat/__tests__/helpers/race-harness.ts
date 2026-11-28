// Общая обвязка для боевых тестов рас: герой с выбранной расой, подрасой и классом.
// Math.random в тестах фиксируется через vi.spyOn(Math, "random").

import { proficiencyBonus } from "@/lib/dnd/dice";
import { detectArmorType, extractAbilitiesFromCharacter, innateSpellToCombatAbility } from "../../character-adapter";
import { resolveRaceForCharacter } from "../../races/race-defs";
import type { CombatAbility, Combatant } from "../../types";
import { hero, type HeroOptions } from "./fighter-harness";

export { ally, bySrd, enemy, hasLog, makeState } from "./fighter-harness";
export { byName, cond, hasKey } from "./class-harness";

export interface RaceHeroOptions extends HeroOptions {
  className?: string;
  subclass?: string;
  racialVariants?: string[];
  profBonus?: number;
  hpMax?: number;
  hpCurrent?: number;
  ac?: number;
  attacks?: Combatant["attacks"];
  saves?: Combatant["saves"];
  isAIControlled?: boolean;
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
  if (o.hpMax !== undefined) c.hpMax = o.hpMax;
  if (o.hpCurrent !== undefined) c.hpCurrent = o.hpCurrent;
  if (o.ac !== undefined) c.ac = o.ac;
  if (o.attacks !== undefined) c.attacks = [...o.attacks];
  if (o.saves !== undefined) c.saves = { ...o.saves };
  if (o.isAIControlled !== undefined) c.isAIControlled = o.isAIControlled;
  if (o.armorType !== undefined) c.armorType = o.armorType;
  else if (o.sheet) {
    const detected = detectArmorType({ sheet: o.sheet });
    if (detected) c.armorType = detected;
  }

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

  const innateAbilities = loadout.innateSpells.map((s) =>
    innateSpellToCombatAbility(s, loadout.raceId, c.abilityMods, c.profBonus, id)
  );
  const seen = new Set<string>();
  const merged: CombatAbility[] = [];
  for (const ab of [...c.abilities, ...loadout.abilities, ...innateAbilities]) {
    const key = ab.parameters?.srdKey ? `srd:${ab.parameters.srdKey}` : `name:${ab.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(ab);
  }
  c.abilities = merged;
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
