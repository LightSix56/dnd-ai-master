// D&D 5e SRD 5.1 Official Compendium Library
import type { ActionParameters, AttackKind, ActionCost, DamageRoll } from "./types";
import {
  getAllSRDSpells,
  getAllCombatSpells,
  getSRDSpell,
  searchSRDSpells,
  srdSpellToSpellDefinition,
  getAllSRDWeapons,
  getSRDWeapon,
  searchSRDWeapons,
  srdWeaponToAttackDefinition,
  type SRDSpell,
  type SRDWeapon,
} from "./srd/adapter";

export interface AttackDefinition {
  name: string;
  kind: AttackKind;
  attackBonus: number;
  damage: DamageRoll[];
  rangeNormal: number;
  rangeLong?: number;
  finesse?: boolean;
  actionCost?: ActionCost;
  description?: string;
}

export interface SpellDefinition {
  name: string;
  level: number;
  school: string;
  parameters: ActionParameters;
}

export interface AbilityDefinition {
  name: string;
  source: string;
  className: string;
  minLevel: number;
  category?: "damage" | "utility" | "buff" | "debuff" | "control" | "healing" | "defense" | "passive";
  parameters: ActionParameters;
}

// ============ БИБЛИОТЕКА ОРУЖИЯ (SRD 5.1) ============

export const ATTACK_LIBRARY: AttackDefinition[] = [
  ...getAllSRDWeapons().map(srdWeaponToAttackDefinition),
  {
    name: "Безоружный удар",
    kind: "melee",
    attackBonus: 0,
    damage: [{ dice: "1", mod: 0, type: "bludgeoning" }],
    rangeNormal: 5,
    actionCost: "action",
    description: "Удар кулаком, ногой или головой (1 + мод. СИЛ дробящего урона).",
  },
  {
    name: "Дубинка / Посох (Шиллейла)",
    kind: "melee",
    attackBonus: 0,
    damage: [{ dice: "1d8", mod: 0, type: "bludgeoning", magical: true }],
    rangeNormal: 5,
    actionCost: "action",
    description: "Магический урон 1к8 + мод. МУД. Зачаровано силой природы.",
  },
  {
    name: "Пламенеющий клинок (Атака)",
    kind: "melee",
    attackBonus: 0,
    damage: [{ dice: "3d6", mod: 0, type: "fire", magical: true }],
    rangeNormal: 5,
    actionCost: "action",
    description: "Удар клинком из чистого огня за Действие (3к6 урона огнем).",
  },
  {
    name: "Теневой клинок (Атака)",
    kind: "melee",
    attackBonus: 0,
    damage: [{ dice: "2d8", mod: 0, type: "psychic", magical: true }],
    rangeNormal: 5,
    rangeLong: 60,
    finesse: true,
    actionCost: "action",
    description: "Сотканный из тьмы клинок (2к8 психического урона, метательное 20/60).",
  },
];

// ============ БИБЛИОТЕКА ЗАКЛИНАНИЙ (502 ЗАКЛИНАНИЯ: SRD 5.1 + РАСШИРЕННЫЙ ПУЛ) ============

export const SPELL_LIBRARY: SpellDefinition[] = getAllCombatSpells().map(srdSpellToSpellDefinition);

// ============ БИБЛИОТЕКА КЛАССОВЫХ СПОСОБНОСТЕЙ ============

export const ABILITY_LIBRARY: AbilityDefinition[] = [
  // ВАРВАР
  {
    name: "Ярость",
    source: "PHB",
    className: "Варвар",
    minLevel: 1,
    category: "buff",
    parameters: {
      name: "Ярость",
      type: "ability",
      actionCost: "bonus",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      selfEffects: [{ condition: "raging", durationRounds: 10 }],
      description: "Бонусное действие: вход в ярость на 1 минуту. Преимущество на проверки и спасброски Силы, +2 к урону рукопашным оружием, сопротивление дробящему, колющему и рубящему урону.",
    },
  },
  {
    name: "Безрассудная атака",
    source: "PHB",
    className: "Варвар",
    minLevel: 2,
    category: "buff",
    parameters: {
      name: "Безрассудная атака",
      type: "ability",
      actionCost: "free",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      selfEffects: [{ condition: "reckless", durationRounds: 1 }],
      description: "Преимущество на все рукопашные атаки Силой до конца хода; атаки по вам до следующего хода совершаются с преимуществом.",
    },
  },

  // ВОИН
  {
    name: "Второе дыхание",
    source: "PHB",
    className: "Воин",
    minLevel: 1,
    category: "healing",
    parameters: {
      name: "Второе дыхание",
      type: "ability",
      actionCost: "bonus",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      selfHeal: { dice: "1d10", mod: 0, addLevel: true },
      description: "Бонусное действие: восстанавливает 1к10 + уровень воина хитов. 1 раз за короткий или длинный отдых.",
    },
  },
  {
    name: "Порыв к действию",
    source: "PHB",
    className: "Воин",
    minLevel: 2,
    category: "buff",
    parameters: {
      name: "Порыв к действию",
      type: "ability",
      actionCost: "free",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      grantsExtraAction: true,
      description: "Дарует одно дополнительное Действие в текущем ходу. 1 раз за короткий или длинный отдых.",
    },
  },

  // ПЛУТ
  {
    name: "Скрытая атака",
    source: "PHB",
    className: "Плут",
    minLevel: 1,
    category: "damage",
    parameters: {
      name: "Скрытая атака",
      type: "ability",
      actionCost: "free",
      damage: [{ dice: "1d6", mod: 0, type: "piercing" }],
      description: "+1к6 (или более по уровню) урона оружием при преимуществе на атаку или когда рядом с целью есть союзник.",
    },
  },
  {
    name: "Хитрое действие: Рывок",
    source: "PHB",
    className: "Плут",
    minLevel: 2,
    category: "utility",
    parameters: {
      name: "Хитрое действие: Рывок",
      type: "ability",
      actionCost: "bonus",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      selfEffects: [{ condition: "dashing", durationRounds: 1 }],
      description: "Бонусное действие: удваивает скорость перемещения до конца хода.",
    },
  },
  {
    name: "Хитрое действие: Отход",
    source: "PHB",
    className: "Плут",
    minLevel: 2,
    category: "defense",
    parameters: {
      name: "Хитрое действие: Отход",
      type: "ability",
      actionCost: "bonus",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      selfEffects: [{ condition: "disengaging", durationRounds: 1 }],
      description: "Бонусное действие: ваше перемещение не провоцирует атаки до конца текущего хода.",
    },
  },
  {
    name: "Хитрое действие: Засада",
    source: "PHB",
    className: "Плут",
    minLevel: 2,
    category: "utility",
    parameters: {
      name: "Хитрое действие: Засада",
      type: "ability",
      actionCost: "bonus",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      selfEffects: [{ condition: "hiding", durationRounds: 1 }],
      description: "Бонусное действие: совершить попытку скрыться в тени или за укрытием.",
    },
  },
  {
    name: "Ликвидация (Убийца)",
    source: "PHB",
    className: "Плут",
    minLevel: 3,
    category: "damage",
    parameters: {
      name: "Ликвидация (Убийца)",
      type: "ability",
      actionCost: "free",
      description: "Преимущество на атаки по существам, которые еще не ходили в бою. Любое попадание по застигнутому врасплох существу становится критическим.",
    },
  },
  {
    name: "Невероятное уклонение",
    source: "PHB",
    className: "Плут",
    minLevel: 5,
    category: "defense",
    parameters: {
      name: "Невероятное уклонение",
      type: "ability",
      actionCost: "reaction",
      description: "Реакция: когда видимый нападающий попадает по вам атакой, вы уполовиниваете получаемый урон.",
    },
  },

  // ПАЛАДИН
  {
    name: "Божественная кара",
    source: "PHB",
    className: "Паладин",
    minLevel: 2,
    category: "damage",
    parameters: {
      name: "Божественная кара",
      type: "ability",
      actionCost: "free",
      damage: [{ dice: "2d8", mod: 0, type: "radiant" }],
      description: "При попадании оружием расходует ячейку 1-го круга и наносит дополнительные 2к8 урона излучением (+1к8 за каждый круг выше 1-го, +1к8 против нежити/исчадий).",
    },
  },
  {
    name: "Наложение рук",
    source: "PHB",
    className: "Паладин",
    minLevel: 1,
    category: "healing",
    parameters: {
      name: "Наложение рук",
      type: "ability",
      actionCost: "action",
      range: { type: "touch" },
      damage: [],
      targeting: "creature",
      description: "Прикосновением восстанавливает хиты из бассейна паладина (уровень × 5 хитов) или нейтрализует яд/болезнь за 5 хитов.",
    },
  },

  // МОНАХ
  {
    name: "Шквал ударов",
    source: "PHB",
    className: "Монах",
    minLevel: 2,
    category: "damage",
    parameters: {
      name: "Шквал ударов",
      type: "ability",
      actionCost: "bonus",
      description: "Тратит 1 очко Ци: совершает два безоружных удара бонусным действием сразу после Действия Атаки.",
    },
  },
  {
    name: "Терпеливая оборона",
    source: "PHB",
    className: "Монах",
    minLevel: 2,
    category: "defense",
    parameters: {
      name: "Терпеливая оборона",
      type: "ability",
      actionCost: "bonus",
      range: { type: "self" },
      targeting: "self",
      selfEffects: [{ condition: "patient_defense", durationRounds: 1 }],
      description: "Тратит 1 очко Ци: бонусным действием совершает Уклонение (Dodge) до начала следующего хода.",
    },
  },
  {
    name: "Поступь ветра",
    source: "PHB",
    className: "Монах",
    minLevel: 2,
    category: "utility",
    parameters: {
      name: "Поступь ветра",
      type: "ability",
      actionCost: "bonus",
      range: { type: "self" },
      targeting: "self",
      description: "Тратит 1 очко Ци: бонусным действием совершает Отход или Рывок, а дальность прыжков удваивается.",
    },
  },

  // ДРУИД
  {
    name: "Дикий облик",
    source: "PHB",
    className: "Друид",
    minLevel: 2,
    category: "buff",
    parameters: {
      name: "Дикий облик",
      type: "ability",
      actionCost: "action",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      description: "Действие (или бонусное для Круга Луны): превращение в зверя. Заменяет физические статы и получает пул HP зверя.",
    },
  },

  // БАРД
  {
    name: "Вдохновение барда",
    source: "PHB",
    className: "Бард",
    minLevel: 1,
    category: "buff",
    parameters: {
      name: "Вдохновение барда",
      type: "ability",
      actionCost: "bonus",
      range: { type: "ranged", value: 60 },
      targeting: "creature",
      description: "Бонусное действие: вдохновляет союзника костью 1к6 (или выше по уровню), которую можно добавить к атаке, спасброску или проверке характеристики.",
    },
  },
];

// ============ АЛИАСЫ И ХЕЛПЕРЫ ============

export const ABILITY_ALIASES: Record<string, string> = {
  rage: "Ярость",
  reckless: "Безрассудная атака",
  reckless_attack: "Безрассудная атака",
  second_wind: "Второе дыхание",
  action_surge: "Порыв к действию",
  sneak_attack: "Скрытая атака",
  cunning_action_dash: "Хитрое действие: Рывок",
  cunning_action_disengage: "Хитрое действие: Отход",
  cunning_action_hide: "Хитрое действие: Засада",
  assassinate: "Ликвидация (Убийца)",
  uncanny_dodge: "Невероятное уклонение",
  divine_smite: "Божественная кара",
  lay_on_hands: "Наложение рук",
  flurry_of_blows: "Шквал ударов",
  patient_defense: "Терпеливая оборона",
  step_of_the_wind: "Поступь ветра",
  wild_shape: "Дикий облик",
  bardic_inspiration: "Вдохновение барда",
};

/** Поиск заклинания по имени (русскому или английскому) или ID */
export function getSpellDefinition(nameOrId: string): SpellDefinition | undefined {
  if (!nameOrId) return undefined;
  const srd = getSRDSpell(nameOrId);
  if (srd) return srdSpellToSpellDefinition(srd);
  return SPELL_LIBRARY.find((s) => s.name.toLowerCase() === nameOrId.trim().toLowerCase());
}

/** Поиск атаки/оружия по имени или ID */
export function getAttackDefinition(nameOrId: string): AttackDefinition | undefined {
  if (!nameOrId) return undefined;
  const srd = getSRDWeapon(nameOrId);
  if (srd) return srdWeaponToAttackDefinition(srd);
  return ATTACK_LIBRARY.find((a) => a.name.toLowerCase() === nameOrId.trim().toLowerCase());
}

/** Поиск способности по имени или ID */
export function getAbilityDefinition(nameOrId: string): AbilityDefinition | undefined {
  if (!nameOrId) return undefined;
  const clean = nameOrId.trim();
  const lower = clean.toLowerCase();

  const direct = ABILITY_LIBRARY.find(
    (a) => a.name.toLowerCase() === lower || a.parameters.name.toLowerCase() === lower
  );
  if (direct) return direct;

  const normalizedKey = lower.replace(/^ab_/, "").replace(/^ability_/, "");
  const aliasName = ABILITY_ALIASES[normalizedKey] || ABILITY_ALIASES[lower];
  if (aliasName) {
    const aliased = ABILITY_LIBRARY.find((a) => a.name.toLowerCase() === aliasName.toLowerCase());
    if (aliased) return aliased;
  }

  return ABILITY_LIBRARY.find((a) => a.name.toLowerCase().includes(lower) || lower.includes(a.name.toLowerCase()));
}

/** Список способностей, доступных классу на заданном уровне */
export function abilitiesForClass(className: string, level: number): AbilityDefinition[] {
  if (!className) return [];
  const lower = className.trim().toLowerCase();
  return ABILITY_LIBRARY.filter(
    (a) => a.className.toLowerCase() === lower && a.minLevel <= level
  );
}

/** Количество атак за одно Действие по классу и уровню */
export function attacksPerAction(className: string, level: number): number {
  if (!className) return 1;
  const lower = className.trim().toLowerCase();
  if (lower.includes("воин") || lower.includes("fighter")) {
    if (level >= 20) return 4;
    if (level >= 11) return 3;
    if (level >= 5) return 2;
    return 1;
  }
  if (
    lower.includes("варвар") ||
    lower.includes("barbarian") ||
    lower.includes("паладин") ||
    lower.includes("paladin") ||
    lower.includes("следопыт") ||
    lower.includes("ranger") ||
    lower.includes("монах") ||
    lower.includes("monk")
  ) {
    if (level >= 5) return 2;
  }
  return 1;
}

/** Множитель костей заговоров по уровню персонажа */
export function cantripDiceMultiplier(level: number): number {
  if (level >= 17) return 4;
  if (level >= 11) return 3;
  if (level >= 5) return 2;
  return 1;
}

/** Кость скрытой атаки плута по уровню */
export function sneakAttackDice(level: number): string {
  const diceCount = Math.ceil(level / 2);
  return `${diceCount}d6`;
}
