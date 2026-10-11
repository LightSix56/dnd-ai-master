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
      srdKey: "barbarian/rage",
      actionCost: "bonus",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      selfEffects: [{ condition: "raging", durationRounds: 10 }],
      usesFormula: "rage",
      refresh: "long",
      description: "Бонусное действие: вход в ярость на 1 минуту. Преимущество на проверки и спасброски Силы, +2 к урону рукопашными атаками Силой (+3 с 9 ур., +4 с 16 ур.), сопротивление дробящему, колющему и рубящему урону. В ярости нельзя колдовать. 2 раза за длинный отдых (больше с уровнем).",
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
      srdKey: "barbarian/reckless-attack",
      actionCost: "free",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      // Без длительности: снимается в начале следующего хода варвара (startTurn)
      selfEffects: [{ condition: "reckless" }],
      description: "Преимущество на рукопашные атаки Силой в этом ходу; атаки по вам до вашего следующего хода совершаются с преимуществом.",
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
      srdKey: "fighter/second-wind",
      actionCost: "bonus",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      selfHeal: { dice: "1d10", mod: 0, addLevel: true },
      uses: 1,
      refresh: "short",
      description: "Бонусное действие: восстанавливает 1к10 + уровень воина хитов. 1 раз за короткий или длинный отдых.",
    },
  },
  {
    name: "Всплеск действий",
    source: "PHB",
    className: "Воин",
    minLevel: 2,
    category: "buff",
    parameters: {
      name: "Всплеск действий",
      type: "ability",
      srdKey: "fighter/action-surge",
      actionCost: "free",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      grantsExtraAction: true,
      usesFormula: "actionSurge",
      refresh: "short",
      description: "Дарует одно дополнительное Действие в текущем ходу (не чаще раза за ход). 1 раз за короткий или длинный отдых, с 17 уровня — 2 раза.",
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
      srdKey: "rogue/sneak-attack",
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
      srdKey: "rogue/uncanny-dodge",
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
      srdKey: "paladin/divine-smite",
      actionCost: "free",
      range: { type: "self" },
      targeting: "self",
      description: "Готовит кару на этот ход: следующее попадание рукопашным оружием тратит самую низкую свободную ячейку и наносит дополнительно 2к8 урона излучением (+1к8 за каждый круг выше 1-го, максимум 5к8; +1к8 против нежити и исчадий). Повторное нажатие отменяет.",
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
      srdKey: "paladin/lay-on-hands",
      actionCost: "action",
      range: { type: "touch", value: 5 },
      damage: [],
      targeting: "creature",
      usesFormula: "layOnHands",
      refresh: "long",
      description: "Действие: прикосновением восстанавливает хиты из запаса паладина (уровень × 5 хитов за длинный отдых). Лечит столько, сколько не хватает цели, но не больше остатка запаса.",
    },
  },

  // МОНАХ
  {
    name: "Очки ци",
    source: "PHB",
    className: "Монах",
    minLevel: 2,
    category: "utility",
    parameters: {
      name: "Очки ци",
      type: "ability",
      srdKey: "monk/monks-focus",
      actionCost: "none",
      usesFormula: "level",
      refresh: "short",
      isResource: true,
      description: "Запас ци монаха: столько очков, каков уровень монаха; восстанавливается на коротком отдыхе. Тратится на Шквал ударов, Терпеливую оборону и Поступь ветра.",
    },
  },
  {
    name: "Шквал ударов",
    source: "PHB",
    className: "Монах",
    minLevel: 2,
    category: "damage",
    parameters: {
      name: "Шквал ударов",
      type: "ability",
      srdKey: "monk/flurry-of-blows",
      actionCost: "bonus",
      range: { type: "melee", value: 5 },
      targeting: "creature",
      kiCost: 1,
      description: "Тратит 1 очко ци: сразу после Действия Атаки совершает бонусным действием два безоружных удара.",
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
      srdKey: "monk/patient-defense",
      actionCost: "bonus",
      range: { type: "self" },
      targeting: "self",
      selfEffects: [{ condition: "patient_defense", durationRounds: 1 }],
      kiCost: 1,
      description: "Тратит 1 очко ци: бонусным действием совершает Уклонение до начала следующего хода.",
    },
  },
  {
    name: "Поступь ветра: Отход",
    source: "PHB",
    className: "Монах",
    minLevel: 2,
    category: "defense",
    parameters: {
      name: "Поступь ветра: Отход",
      type: "ability",
      actionCost: "bonus",
      range: { type: "self" },
      targeting: "self",
      selfEffects: [{ condition: "disengaging", durationRounds: 1 }],
      kiCost: 1,
      description: "Тратит 1 очко ци: бонусным действием совершает Отход — перемещение не провоцирует атак до конца хода.",
    },
  },
  {
    name: "Поступь ветра: Рывок",
    source: "PHB",
    className: "Монах",
    minLevel: 2,
    category: "utility",
    parameters: {
      name: "Поступь ветра: Рывок",
      type: "ability",
      actionCost: "bonus",
      range: { type: "self" },
      targeting: "self",
      selfEffects: [{ condition: "dashing", durationRounds: 1 }],
      kiCost: 1,
      description: "Тратит 1 очко ци: бонусным действием совершает Рывок — скорость удваивается до конца хода.",
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
      srdKey: "druid/wild-shape",
      actionCost: "action",
      range: { type: "self" },
      damage: [],
      targeting: "self",
      uses: 2,
      refresh: "short",
      description: "Действие (или бонусное для Круга Луны): превращение в зверя. Заменяет физические статы и получает пул HP зверя. 2 раза за короткий или длинный отдых.",
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
      srdKey: "bard/bardic-inspiration",
      actionCost: "bonus",
      range: { type: "ranged", value: 60 },
      targeting: "ally",
      usesFormula: "bardicInspiration",
      refresh: "long",
      description: "Бонусное действие: вдохновляет союзника в 60 фт костью к6 (к8 с 5 ур., к10 с 10 ур., к12 с 15 ур.). Кость добавляется к его следующему броску атаки или спасброску, который иначе был бы неудачным. Зарядов — модификатор Харизмы; восстанавливаются на длинном отдыхе (с 5 ур. — и на коротком).",
    },
  },
];

// ============ АЛИАСЫ И ХЕЛПЕРЫ ============

export const ABILITY_ALIASES: Record<string, string> = {
  rage: "Ярость",
  reckless: "Безрассудная атака",
  reckless_attack: "Безрассудная атака",
  second_wind: "Второе дыхание",
  action_surge: "Всплеск действий",
  "порыв к действию": "Всплеск действий",
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
  step_of_the_wind: "Поступь ветра: Отход",
  step_of_the_wind_dash: "Поступь ветра: Рывок",
  ki: "Очки ци",
  ki_points: "Очки ци",
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
