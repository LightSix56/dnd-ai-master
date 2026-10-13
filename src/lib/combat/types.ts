// Типы боевого движка

export type CombatantType = "player" | "npc" | "enemy" | "companion";
export type MapElementType = "wall" | "door" | "window" | "obstacle" | "cover" | "difficult" | "water" | "lava" | "elevation";
export type CombatStatus = "active" | "paused" | "ended";
export type CreatureSize = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan";

export type FacingDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type VisibilityStatus = "visible" | "cover" | "unseen";

export interface Cell {
  x: number;
  y: number;
}

export interface Combatant {
  id: string;
  characterId?: string | null;
  name: string;
  type: CombatantType;
  color: string;
  x: number;
  y: number;
  facing?: FacingDirection;
  hpCurrent: number;
  hpMax: number;
  hpTemp: number;
  ac: number;
  speed: number;
  initiative: number;
  initiativeTiebreak: number;
  dexMod: number;
  conditions: Condition[];
  isHidden: boolean;
  hasActed: boolean;
  className: string;
  level: number;
  size: CreatureSize;
  movementUsed: number;
  actionUsed: boolean;
  bonusActionUsed: boolean;
  reactionUsed: boolean;
  attacksPerAction: number;
  attacksMadeThisAction: number;
  extraActions: number;
  hotbar: HotbarItem[];
  attacks: Attack[];
  spells: SpellData;
  abilities: CombatAbility[];
  concentration: ConcentrationData | null;
  wildShape?: WildShapeState | null;
  saves: Record<string, { prof: boolean; mod: number }>;
  abilityMods: Record<string, number>;
  profBonus: number;
  isAIControlled: boolean;
  damageResistances?: string[];
  damageImmunities?: string[];
  damageVulnerabilities?: string[];
  conditionImmunities?: string[];
  multiattack?: MonsterMultiattack | null;
  legendaryState?: LegendaryState | null;
  rechargeAbilities?: RechargeAbility[];
  monsterTraits?: MonsterCombatTrait[];
  tacticalRole?: TacticalRole;
  suppressRegenerationUntilRound?: number;
  potions?: CombatPotion[];
  challengeRating?: number;
}

export interface CombatPotion {
  id: string;
  name: string;
  nameEn?: string;
  type: 'heal' | 'buff' | 'utility';
  quantity: number;
  formula?: string; // например "2d4+2"
  tempHp?: number;
  buffEffect?: string;
  description: string;
  rarity?: string;
  actionCost: 'bonus_action';
}

export type TacticalRole = "vanguard" | "backline" | "boss" | "flanker" | "leader";

export interface MonsterMultiattackOption {
  attackId: string;
  count: number;
}

export interface MonsterMultiattack {
  name: string;
  description: string;
  attacks: MonsterMultiattackOption[];
}

export interface LegendaryActionOption {
  id: string;
  name: string;
  cost: number;
  description: string;
  attackId?: string;
  abilityId?: string;
}

export interface LegendaryState {
  actionsPerRound: number;
  remainingActions: number;
  options: LegendaryActionOption[];
  legendaryResistancesMax: number;
  legendaryResistancesRemaining: number;
}

export interface RechargeAbility {
  id: string;
  name: string;
  recharge: "5-6" | "6";
  isCharged: boolean;
  actionCost: ActionCost;
  description: string;
}

export interface MonsterCombatTrait {
  name: string;
  description: string;
}

export type AbilityKey = "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
export type ActionCost = "action" | "bonus" | "reaction" | "free" | "none" | "action+bonus";

export interface Condition {
  type: string;
  duration?: number; // в раундах, undefined = пока не снято
  durationRounds?: number;
  source?: string;
  saveType?: AbilityKey;
  saveDC?: number;
  // Служебные поля для механики
  value?: number; // например, бонус AC от Щита
  targetId?: string; // для "helping" — кому помогает
  /** Эффект держится концентрацией source и снимается при её потере */
  concentration?: boolean;
}

export interface HotbarItem {
  id: string;
  type: "attack" | "spell" | "ability";
  name: string;
  libraryId?: string;
}

export type AttackKind = "melee" | "ranged" | "spell";

export interface Attack {
  id: string;
  name: string;
  attackBonus: number;
  damage: DamageRoll[];
  // Тип атаки определяет, как считается досягаемость и какие модификаторы применяются
  kind: AttackKind;
  range: { normal: number; long?: number };
  // Стоимость: обычная атака = "action", двойной удар = "action+bonus"
  actionCost: ActionCost;
  // Урон только при попадании второй частью (для двойных ударов) — уже в damage
  description?: string;
  // Свойства оружия
  finesse?: boolean;
  thrown?: boolean;
  versatile?: string; // урон двумя руками, напр. "1d10"
  // Атака идёт от заклинательной характеристики
  usesSpellAttack?: boolean;
  magical?: boolean;
}

export interface DamageRoll {
  dice: string; // "1d6", "2d8", "" если только модификатор
  mod: number;
  type: string; // slashing, piercing, fire, healing...
  save?: "half" | "none" | "full";
  // Не удваивается при крите (например, урон от яда-эффекта)
  noCrit?: boolean;
  // Временные хиты вместо лечения
  temp?: boolean;
  magical?: boolean;
}

export interface SpellData {
  slots: Record<number, { max: number; used: number }>;
  known: string[]; // ID из SpellLibrary
  prepared?: string[];
  spellcastingAbility?: AbilityKey | "";
  spellSaveDC?: number;
  spellAttackBonus?: number;
}

export interface CombatAbility {
  id: string;
  libraryId?: string;
  name: string;
  usesMax: number; // 0 = без ограничения
  usesUsed: number;
  refresh: "short" | "long" | "none" | "turn" | "round";
  parameters?: ActionParameters;
}

export interface ConcentrationData {
  spellId: string;
  spellName: string;
  targetId?: string;
  durationRounds: number;
}

export interface WildShapeState {
  formId: string;
  formName: string;
  formNameEn?: string;
  icon?: string;
  originalHpMax: number;
  originalHpCurrent: number;
  originalHpTemp: number;
  originalAc: number;
  originalSpeed: number;
  originalDexMod: number;
  originalAbilityMods: Record<string, number>;
  originalAttacks: Attack[];
  originalAbilities: CombatAbility[];
  originalSize?: string;
  originalName: string;
}

// Эффект, который способность/заклинание накладывает на цель
export interface AppliedEffect {
  condition: string;
  durationRounds?: number;
  saveType?: AbilityKey;
  saveDC?: number;
  value?: number;
  /** Эффект держится концентрацией заклинателя */
  concentration?: boolean;
}

export interface ActionParameters {
  name: string;
  type: "spell" | "weapon" | "ability";
  level?: number;
  school?: string;

  actionCost: ActionCost;

  range?: {
    type: "self" | "touch" | "ranged" | "melee" | "special" | "sphere" | "cone" | "line" | "cube";
    value?: number;
    longRange?: number;
  };

  aoe?: {
    shape: "sphere" | "cone" | "line" | "cylinder" | "cube";
    size: number;
  } | null;

  attackBonus?: number | null;
  attackType?: "ranged" | "melee" | "spell";

  saveType?: AbilityKey | null;
  saveDC?: number | null;

  damage?: DamageRoll[];
  // Урон масштабируется от уровня персонажа (заговоры)
  cantripScaling?: boolean;
  // Прибавлять модификатор заклинательной характеристики к урону/лечению
  addSpellMod?: boolean;

  // Эффекты на цель при провале спасброска / при попадании
  effects?: AppliedEffect[];
  // Эффекты на себя (баффы вроде Второго дыхания, Ярости)
  selfEffects?: AppliedEffect[];
  // Лечение себя (Второе дыхание)
  selfHeal?: { dice: string; mod: number; addLevel?: boolean } | null;
  // Даёт дополнительное Действие (Всплеск действий)
  grantsExtraAction?: boolean;
  // Даёт преимущество союзнику на следующую атаку (Помощь)
  grantsAllyAdvantage?: boolean;

  concentration?: boolean;
  duration?: string;
  spellSlotLevel?: number | null;
  zoneType?: "entangle" | "web" | "spike_growth" | "grease" | string;
  upcast?: {
    perLevel?: string;
    description?: string;
  } | null;

  uses?: number;
  /** Формула зарядов по уровню, см. resolveAbilityUses в ability-uses.ts */
  usesFormula?: "profBonus" | "level" | "rage" | "actionSurge" | "layOnHands" | "bardicInspiration" | "wildShape" | null;
  /** Сколько очков ци тратит приём монаха */
  kiCost?: number;
  /** Счётчик ресурса (очки ци), сам по себе не применяется */
  isResource?: boolean;
  /** Умение SRD, из которого собрана способность (см. class-features.ts), например «monk/stunning-strike» */
  srdKey?: string;
  /** Тратит из общего запаса другой способности: pool — её srdKey («cleric/channel-divinity») */
  resourceCost?: { pool: string; amount: number };
  /** Действует само (при попадании, в начале хода) или как справка мастеру — кнопки нет */
  passive?: boolean;
  /** Эффект разыгрывает мастер: движок тратит действие и заряды и пишет в журнал */
  manual?: boolean;
  /** Траты запаса списываются не при нажатии, а при срабатывании (заряженные приёмы, выстрелы, силы) */
  deferCost?: boolean;
  /** Число умения на уровне героя: лишние кости крита, порог крита, лечение Уцелевшего, бонус ауры */
  featureValue?: number;
  refresh?: "short" | "long" | "none" | "turn" | "round";

  friendlyFire?: boolean;
  // Сколько целей можно выбрать (магическая стрела и т.п.)
  maxTargets?: number;
  // Нацеливание: на бойца, на точку (AoE) или на себя
  targeting?: "creature" | "point" | "self" | "ally";

  vfx?: {
    color: string;
    icon?: string;
  };

  description?: string;
}

// Состояния с механическими эффектами
export interface ConditionEffect {
  attackDisadvantage?: boolean;
  attackAdvantage?: boolean;
  abilityCheckDisadvantage?: boolean;
  saveDisadvantage?: AbilityKey[];
  saveAdvantage?: AbilityKey[];
  speedMultiplier?: number;
  speedSetTo?: number;
  // Атаки ПО этому бойцу получают преимущество
  attackAdvantageAgainst?: boolean;
  // Атаки ПО этому бойцу получают помеху
  attackDisadvantageAgainst?: boolean;
  // Преимущество по нему только в ближнем бою, помеха на дальних (лежит)
  meleeAdvantageAgainst?: boolean;
  rangedDisadvantageAgainst?: boolean;
  noActions?: boolean;
  noReactions?: boolean;
  autoFailStrSave?: boolean;
  autoFailDexSave?: boolean;
  damagePerTurn?: { dice: string; type: string };
  acBonus?: number;
  // Бонус к атакам и спасброскам (Благословение)
  attackBonusDice?: string;
  // Не может атаковать источник (испуган не может приближаться — упрощено)
  cannotApproachSource?: boolean;
  // Расходуется на первую атаку (Помощь / преимущество от союзника)
  consumedOnAttack?: boolean;
}

export const CONDITION_EFFECTS: Record<string, {
  name: string;
  description: string;
  effects: ConditionEffect;
  /** Служебная отметка движка («уже использовано в этом ходу») — на карточке бойца не показывается */
  service?: boolean;
}> = {
  poisoned: {
    name: "Отравлен",
    description: "Помеха на атаки и проверки характеристик",
    effects: { attackDisadvantage: true, abilityCheckDisadvantage: true },
  },
  prone: {
    name: "Лежит",
    description: "Помеха на атаки; преимущество по нему вблизи, помеха издалека",
    effects: {
      attackDisadvantage: true,
      meleeAdvantageAgainst: true,
      rangedDisadvantageAgainst: true,
    },
  },
  restrained: {
    name: "Опутан",
    description: "Скорость 0; помеха на атаки и спасброски ЛОВ; преимущество по нему",
    effects: {
      speedSetTo: 0,
      attackDisadvantage: true,
      saveDisadvantage: ["DEX"],
      attackAdvantageAgainst: true,
    },
  },
  grappled: {
    name: "Схвачен",
    description: "Скорость 0",
    effects: { speedSetTo: 0 },
  },
  frightened: {
    name: "Испуган",
    description: "Помеха на проверки и атаки, пока видит источник страха",
    effects: { attackDisadvantage: true, abilityCheckDisadvantage: true, cannotApproachSource: true },
  },
  blinded: {
    name: "Ослеплён",
    description: "Помеха на свои атаки; преимущество на атаки по нему",
    effects: { attackDisadvantage: true, attackAdvantageAgainst: true },
  },
  invisible: {
    name: "Невидимый",
    description: "Преимущество на свои атаки; атаки по нему получают помеху; невидим для обычного зрения",
    effects: { attackAdvantage: true, attackDisadvantageAgainst: true },
  },
  greater_invisibility: {
    name: "Высшая невидимость",
    description: "Преимущество на свои атаки; атаки по нему получают помеху; невидим для обычного зрения (не спадает при атаках)",
    effects: { attackAdvantage: true, attackDisadvantageAgainst: true },
  },
  deafened: {
    name: "Оглох",
    description: "Не слышит",
    effects: {},
  },
  surprised: {
    name: "Застигнут врасплох",
    description: "Не может двигаться и действовать в первом раунде боя; уязвим для Ликвидации Ассасина",
    effects: { noActions: true, noReactions: true, speedSetTo: 0 },
  },
  charmed: {
    name: "Очарован",
    description: "Не может атаковать источник очарования",
    effects: { cannotApproachSource: true },
  },
  stunned: {
    name: "Оглушён",
    description: "Не может двигаться или действовать; преимущество по нему",
    effects: {
      noActions: true,
      noReactions: true,
      speedSetTo: 0,
      attackAdvantageAgainst: true,
      autoFailStrSave: true,
      autoFailDexSave: true,
    },
  },
  paralyzed: {
    name: "Парализован",
    description: "Не может действовать; преимущество по нему; криты вблизи",
    effects: {
      noActions: true,
      noReactions: true,
      speedSetTo: 0,
      attackAdvantageAgainst: true,
      autoFailStrSave: true,
      autoFailDexSave: true,
    },
  },
  unconscious: {
    name: "Без сознания",
    description: "Не может действовать; преимущество по нему; криты в радиусе 5 фт",
    effects: {
      noActions: true,
      noReactions: true,
      speedSetTo: 0,
      attackAdvantageAgainst: true,
      autoFailStrSave: true,
      autoFailDexSave: true,
    },
  },
  incapacitated: {
    name: "Недееспособен",
    description: "Не может совершать действия и реакции",
    effects: { noActions: true, noReactions: true },
  },
  burning: {
    name: "Горит",
    description: "1к6 урона огнём в начале хода",
    effects: { damagePerTurn: { dice: "1d6", type: "fire" } },
  },
  hasted: {
    name: "Ускорен",
    description: "Скорость ×2, +2 AC",
    effects: { speedMultiplier: 2, acBonus: 2 },
  },
  haste: {
    name: "Ускорение",
    description: "Скорость ×2, +2 к КД",
    effects: { speedMultiplier: 2, acBonus: 2 },
  },
  slow: {
    name: "Замедление",
    description: "-2 к КД, скорость уполовинена, нет реакций",
    effects: { acBonus: -2, speedMultiplier: 0.5, noReactions: true },
  },
  blessed: {
    name: "Благословлён",
    description: "+1к4 к атакам и спасброскам",
    effects: { attackBonusDice: "1d4" },
  },
  disarmed: {
    name: "Обезоружен",
    description: "Уронил оружие: помеха на атаки до конца хода",
    effects: { attackDisadvantage: true },
  },
  // Служебные состояния движка
  dashing: {
    name: "Рывок",
    description: "Движение удвоено",
    effects: {},
  },
  dodging: {
    name: "Уклонение",
    description: "Помеха на атаки по нему; преимущество на спасброски ЛОВ",
    effects: { attackDisadvantageAgainst: true, saveAdvantage: ["DEX"] },
  },
  disengaging: {
    name: "Отход",
    description: "Не провоцирует атаки при выходе из ближнего боя",
    effects: {},
  },
  helped: {
    name: "Помощь союзника",
    description: "Преимущество на следующую атаку",
    effects: { attackAdvantage: true, consumedOnAttack: true },
  },
  shielded: {
    name: "Щит",
    description: "+5 к AC до начала следующего хода",
    effects: { acBonus: 5 },
  },
  shield_of_faith: {
    name: "Щит веры",
    description: "+2 к AC",
    effects: { acBonus: 2 },
  },
  cover_half: {
    name: "Полуукрытие",
    description: "+2 к AC и спасброскам ЛОВ",
    effects: { acBonus: 2, saveAdvantage: [] },
  },
  cover_three_quarters: {
    name: "3/4 укрытие",
    description: "+5 к AC и спасброскам ЛОВ",
    effects: { acBonus: 5, saveAdvantage: [] },
  },
  raging: {
    name: "Ярость",
    description: "Преимущество на проверки и спасброски СИЛ, бонус к урону рукопашными атаками Силой, сопротивление дробящему, колющему и рубящему урону",
    effects: { saveAdvantage: ["STR"] },
  },
  // Подклассы Воина (fighter-combat.ts)
  fighter_rider: {
    name: "Умение заряжено",
    description: "Сработает при ближайшем подходящем попадании в этом ходу (приём, магический выстрел, руна, псионический удар)",
    effects: {},
  },
  feint: {
    name: "Финт",
    description: "Преимущество на следующую атаку по выбранной цели в этом ходу",
    effects: {},
    service: true,
  },
  distracted: {
    name: "Отвлечён",
    description: "Следующая атака по существу от кого-либо, кроме отвлёкшего, совершается с преимуществом",
    effects: {},
  },
  goaded: {
    name: "Спровоцирован",
    description: "Помеха на броски атаки по всем, кроме спровоцировавшего",
    effects: {},
  },
  unwavering_mark: {
    name: "Метка кавалериста",
    description: "Помеха на атаки по другим, пока рядом с отметившим (5 фт); его наказание срабатывает, если метка вредит другому",
    effects: {},
  },
  evasive_footwork: {
    name: "Активное уклонение",
    description: "Кость превосходства добавлена к КД, пока вы двигаетесь (до атаки или конца хода)",
    effects: {},
  },
  bait_and_switch: {
    name: "Подмена",
    description: "Кость превосходства добавлена к КД до начала следующего хода",
    effects: {},
  },
  warding_maneuver: {
    name: "Защитный манёвр",
    description: "Кость добавлена к КД против этой атаки; при попадании урон уменьшен вдвое",
    effects: {},
    service: true,
  },
  banished: {
    name: "Изгнан",
    description: "Недееспособен, скорость 0 (в безвредном месте Страны Фей до конца своего хода)",
    effects: { noActions: true, noReactions: true, speedSetTo: 0 },
  },
  stone_trance: {
    name: "Магический ступор",
    description: "Очарован руной: скорость 0, недееспособен; повторяет спасбросок в конце хода",
    effects: { noActions: true, noReactions: true, speedSetTo: 0 },
  },
  fire_shackles: {
    name: "Огненные кандалы",
    description: "Опутан огненными кандалами: 2к6 урона огнём в начале хода, повторяет спасбросок Силы",
    effects: {
      speedSetTo: 0,
      attackDisadvantage: true,
      saveDisadvantage: ["DEX"],
      attackAdvantageAgainst: true,
      damagePerTurn: { dice: "2d6", type: "fire" },
    },
  },
  enfeebled: {
    name: "Ослаблен",
    description: "Урон его атак оружием уменьшен вдвое",
    effects: {},
  },
  shadow_veil: {
    name: "Тень на глазах",
    description: "Не видит дальше 5 футов: помеха на атаки",
    effects: { attackDisadvantage: true },
  },
  grasping_briars: {
    name: "Колючие кусты",
    description: "Скорость уменьшена на 10 фт; 2к6 рубящего урона за первое перемещение в ход",
    effects: {},
  },
  giants_might: {
    name: "Мощь великана",
    description: "Преимущество на проверки и спасброски Силы; раз в ход оружие наносит дополнительный урон",
    effects: { saveAdvantage: ["STR"] },
  },
  fighting_spirit: {
    name: "Боевой дух",
    description: "Преимущество на броски атаки оружием до конца хода",
    effects: { attackAdvantage: true },
  },
  frost_rune: {
    name: "Ледяная руна",
    description: "+2 к проверкам и спасброскам Силы и Телосложения",
    effects: {},
  },
  hill_rune: {
    name: "Холмовая руна",
    description: "Сопротивление дробящему, рубящему и колющему урону",
    effects: {},
  },
  psi_leap: {
    name: "Пси-прыжок",
    description: "Скорость полёта вдвое больше скорости ходьбы до конца хода",
    effects: { speedMultiplier: 2 },
  },
  war_magic_ready: {
    name: "Боевая магия",
    description: "После заклинания можно бонусным действием атаковать оружием",
    effects: {},
  },
  rapid_strike: {
    name: "Стремительный удар",
    description: "Следующая атака без преимущества, но с дополнительной атакой",
    effects: {},
    service: true,
  },
  eldritch_struck: {
    name: "Мистический удар",
    description: "Помеха на спасбросок от следующего заклинания воина",
    effects: {},
  },
  echo: {
    name: "Эхо",
    description: "Магическое эхо воина",
    effects: {},
  },
  action_surge_used: {
    name: "Всплеск действий использован",
    description: "Всплеск действий уже применён в этом ходу",
    effects: {},
    service: true,
  },
  smite_ready: {
    name: "Божественная кара наготове",
    description: "Следующее попадание рукопашным оружием в этом ходу потратит ячейку и добавит урон излучением",
    effects: {},
  },
  bardic_inspiration: {
    name: "Вдохновение барда",
    description: "Кость вдохновения добавится к следующему неудачному броску атаки или спасброску",
    effects: {},
  },
  hunters_mark: {
    name: "Метка охотника",
    description: "Доп. урон 1к6 от отметившего",
    effects: {},
  },
  divine_strike_used: {
    name: "Божественный удар использован",
    description: "Божественный удар уже нанесён в этом ходу",
    effects: {},
    service: true,
  },
  colossus_slayer_used: {
    name: "Убийца колоссов использован",
    description: "Урон Убийцы колоссов уже добавлен в этом ходу",
    effects: {},
    service: true,
  },
  last_attack: {
    name: "Атаковал в этом ходу",
    description: "Последняя атака бойца в этом ходу (для Сокрушителя орды и Ошеломляющего удара)",
    effects: {},
    service: true,
  },
  horde_breaker_used: {
    name: "Сокрушитель орды использован",
    description: "Дополнительная атака Сокрушителя орды уже сделана в этом ходу",
    effects: {},
    service: true,
  },
  relentless_rage: {
    name: "Непреклонная ярость",
    description: "Сколько раз сработала Непреклонная ярость: каждый раз СЛ спасброска выше на 5",
    effects: {},
    service: true,
  },
  battle_start_done: {
    name: "Начало боя учтено",
    description: "Умения, срабатывающие при броске инициативы, уже учтены",
    effects: {},
    service: true,
  },
  turned: {
    name: "Изгнан",
    description: "Бежит от изгнавшего: не атакует и не совершает реакций, не подходит к нему. Проходит через минуту или при получении урона",
    effects: { noActions: true, noReactions: true, cannotApproachSource: true },
  },
  sneak_used: {
    name: "Скрытая атака использована",
    description: "Скрытая атака уже применена в этом ходу",
    effects: {},
    service: true,
  },
  sneak_ready: {
    name: "Скрытая атака готова",
    description: "Скрытая атака ещё не использована в этом ходу",
    effects: {},
  },
  stable: {
    name: "Стабилизирован",
    description: "Без сознания, но не делает спасброски от смерти",
    effects: {
      noActions: true,
      noReactions: true,
      speedSetTo: 0,
      attackAdvantageAgainst: true,
      autoFailStrSave: true,
      autoFailDexSave: true,
    },
  },
  dead: {
    name: "Мёртв",
    description: "Персонаж погиб",
    effects: {
      noActions: true,
      noReactions: true,
      speedSetTo: 0,
    },
  },
  faerie_fire: {
    name: "Огонь фей",
    description: "Светится: преимущество на атаки по нему, не может быть невидимым",
    effects: { attackAdvantageAgainst: true },
  },
  shelled: {
    name: "Укрытие в панцире",
    description: "+4 к КД, преимущество на спасброски СИЛ и ТЕЛ, скорость 0, ничком, помеха на спасброски ЛОВ",
    effects: {
      acBonus: 4,
      speedSetTo: 0,
      saveAdvantage: ["STR", "CON"],
      saveDisadvantage: ["DEX"],
      meleeAdvantageAgainst: true,
      rangedDisadvantageAgainst: true,
    },
  },
  shillelagh: {
    name: "Дубинка (Shillelagh)",
    description: "Древесина посоха/дубинки зачарована: урон 1к8 магический дробящий, атака от Мудрости",
    effects: {},
  },
  barkskin: {
    name: "Дубовая кожа",
    description: "Кожа твердеет как кора: базовый КД не может быть меньше 16",
    effects: {},
  },
  pass_without_trace: {
    name: "Бесследное передвижение",
    description: "+10 к проверкам Скрытности, невозможно отследить немагически",
    effects: {},
  },
  heat_metal: {
    name: "Раскалённый металл",
    description: "Металл на цели раскалён докрасна: помеха на броски атак и проверки характеристик",
    effects: { attackDisadvantage: true },
  },
  absorb_elements: {
    name: "Поглощение стихий",
    description: "Сопротивление к стихийному урону и +1к6 к следующей атаке",
    effects: {},
  },
  booming_resonance: {
    name: "Громовой резонанс",
    description: "При перемещении получает урон звуком (Громовой клинок)",
    effects: {},
  },
  armor_of_agathys: {
    name: "Доспех Агатиса",
    description: "Временные хиты и ответный урон холодом атакующим в ближнем бою",
    effects: {},
  },
  stoneskin: {
    name: "Каменная кожа",
    description: "Сопротивление к немагическому дробящему, колющему и рубящему урону",
    effects: {},
  },
  fire_shield: {
    name: "Огненный щит",
    description: "Сопротивление стихии, 2к8 ответного урона атакующим в ближнем бою",
    effects: {},
  },
  longstrider: {
    name: "Долгоход",
    description: "+10 фт к скорости передвижения",
    effects: {},
  },
  wild_shape: {
    name: "Дикий облик",
    description: "Форма зверя: физические параметры и пул временных хитов зверя",
    effects: {},
  },
  aid: {
    name: "Помощь (Aid)",
    description: "+5 к текущим и максимальным хитам на 8 часов",
    effects: {},
  },
  reckless: {
    name: "Безрассудная атака",
    description: "Преимущество на рукопашные атаки Силой; враги имеют преимущество на атаки по вам",
    // Преимущество на свои атаки — только рукопашные Силой, см. computeAttackAdvantage
    effects: { attackAdvantageAgainst: true },
  },
  patient_defense: {
    name: "Терпеливая оборона",
    description: "Помеха на атаки по вам, преимущество на спасброски ЛОВ",
    effects: { attackDisadvantageAgainst: true, saveAdvantage: ["DEX"] },
  },
  vow_of_enmity: {
    name: "Обет вражды",
    description: "Преимущество на атаки против заклятого врага",
    effects: { attackAdvantage: true },
  },
  feline_agility: {
    name: "Кошачья ловкость",
    description: "Скорость перемещения удвоена до конца текущего хода",
    effects: { speedMultiplier: 2 },
  },
  cutting_words: {
    name: "Режущие слова",
    description: "Вычитает кость вдохновения из броска цели",
    effects: {},
  },
  fleeing: {
    name: "В панике / Бегство",
    description: "Существо сломлено страхом и стремится покинуть поле боя",
    effects: { attackDisadvantage: true },
  },
};

export interface MapElementProperties {
  label?: string;
  isOpen?: boolean;
  isLocked?: boolean;
  coverBonus?: 2 | 5;
  damagePerTurn?: { dice: string; type: string };
  elevationFt?: number;
  destructible?: { hp: number; ac: number };
  // Поля динамических зон заклинаний (Spell Zones / Hazards)
  isSpellZone?: boolean;
  spellId?: string;
  spellName?: string;
  casterId?: string;
  concentration?: boolean;
  durationRounds?: number;
  saveType?: AbilityKey;
  saveDC?: number;
  zoneType?: "entangle" | "web" | "spike_growth" | "grease" | "fog" | "darkness" | "generic_hazard";
  difficultTerrain?: boolean;
  damageOnEnter?: DamageRoll[];
  damagePer5ft?: DamageRoll[];
  damageOnTurnStart?: DamageRoll[];
  conditionOnFail?: string;
  flammable?: boolean;
  [key: string]: unknown;
}

export interface MapElement {
  id: string;
  type: MapElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  properties: MapElementProperties;
}

export interface LogEntry {
  round: number;
  actor?: string;
  text: string;
  kind: "attack" | "spell" | "ability" | "move" | "turn" | "system" | "damage" | "save";
}

export interface Combat {
  id: string;
  name: string;
  status: CombatStatus;
  round: number;
  currentTurnIndex: number;
  turnOrder: string[];
  gridWidth: number;
  gridHeight: number;
  cellSize: number;
  backgroundUrl?: string;
  log: LogEntry[];
  combatants: Combatant[];
  mapElements: MapElement[];
  createdAt: string;
  updatedAt: string;
}

// Цвета по типу персонажа
export const TYPE_COLORS: Record<CombatantType, string> = {
  player: "#10b981",
  npc: "#f59e0b",
  enemy: "#ef4444",
  companion: "#3b82f6",
};

export const TYPE_LABELS: Record<CombatantType, string> = {
  player: "Игрок",
  npc: "NPC",
  enemy: "Враг",
  companion: "Спутник",
};

// Кто кому враг: определяет выбор целей ботом и дружественный огонь
export const HOSTILE_TO: Record<CombatantType, CombatantType[]> = {
  player: ["enemy"],
  companion: ["enemy"],
  npc: ["enemy"],
  enemy: ["player", "companion", "npc"],
};

export function isHostile(a: CombatantType, b: CombatantType): boolean {
  return HOSTILE_TO[a]?.includes(b) ?? false;
}

// Размер существа в клетках
export const SIZE_CELLS: Record<CreatureSize, number> = {
  tiny: 1,
  small: 1,
  medium: 1,
  large: 2,
  huge: 3,
  gargantuan: 4,
};

export const ELEMENT_COLORS: Record<MapElementType, string> = {
  wall: "#475569",
  door: "#92400e",
  window: "#0ea5e9",
  obstacle: "#78716c",
  cover: "#a16207",
  difficult: "#65a30d",
  water: "#0284c7",
  lava: "#ea580c",
  elevation: "#9333ea",
};

export const ELEMENT_LABELS: Record<MapElementType, string> = {
  wall: "Стена",
  door: "Дверь",
  window: "Окно",
  obstacle: "Препятствие",
  cover: "Укрытие",
  difficult: "Трудная местность",
  water: "Вода",
  lava: "Лава",
  elevation: "Возвышение",
};

export const DAMAGE_TYPE_LABELS: Record<string, string> = {
  slashing: "рубящий",
  piercing: "колющий",
  bludgeoning: "дробящий",
  fire: "огонь",
  cold: "холод",
  lightning: "электричество",
  thunder: "звук",
  poison: "яд",
  acid: "кислота",
  psychic: "психический",
  necrotic: "некротический",
  radiant: "излучение",
  force: "силовой",
  healing: "лечение",
};

export const ABILITY_LABELS: Record<AbilityKey, string> = {
  STR: "СИЛ",
  DEX: "ЛОВ",
  CON: "ТЕЛ",
  INT: "ИНТ",
  WIS: "МДР",
  CHA: "ХАР",
};

export interface CharacterPreset {
  id: string;
  name: string;
  type: CombatantType;
  className: string;
  level: number;
  cr?: string;
  size: CreatureSize;
  color: string;
  icon?: string;
  hpMax: number;
  ac: number;
  speed: number;
  dexMod?: number;
  initiativeMod?: number;
  attacksPerAction: number;
  abilityMods: Record<string, number>;
  saves?: Record<string, { prof: boolean; mod: number }>;
  profBonus: number;
  attacks: Attack[];
  spells: SpellData;
  abilities: CombatAbility[];
  category?: "heroes" | "monsters" | "npc" | "custom";
  description?: string;
  tags?: string[];
  isTemplate?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

