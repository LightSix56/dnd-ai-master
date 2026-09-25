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
  // Даёт дополнительное Действие (Порыв действия)
  grantsExtraAction?: boolean;
  // Даёт преимущество союзнику на следующую атаку (Помощь)
  grantsAllyAdvantage?: boolean;

  concentration?: boolean;
  duration?: string;
  spellSlotLevel?: number | null;
  upcast?: {
    perLevel?: string;
    description?: string;
  } | null;

  uses?: number;
  usesFormula?: "profBonus" | "level" | null;
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
    description: "Преимущество на проверки СИЛ, бонус к урону",
    effects: {},
  },
  hunters_mark: {
    name: "Метка охотника",
    description: "Доп. урон 1к6 от отметившего",
    effects: {},
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
    effects: { attackAdvantage: true, attackAdvantageAgainst: true },
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
  bardic_inspiration: {
    name: "Вдохновение барда",
    description: "+1к6 (или +1к8) к броску атаки, спасброску или проверке характеристики",
    effects: {},
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

