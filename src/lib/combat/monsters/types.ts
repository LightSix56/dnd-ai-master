/**
 * 14 каноничных типов существ D&D 5e
 */
export type CreatureType =
  | "aberration"    // Аберрация
  | "beast"         // Зверь
  | "celestial"     // Небожитель
  | "construct"     // Конструкт
  | "dragon"        // Дракон
  | "elemental"     // Элементаль
  | "fey"           // Фея
  | "fiend"         // Исчадие
  | "giant"         // Великан
  | "humanoid"      // Гуманоид
  | "monstrosity"   // Монстр / Чудовище
  | "ooze"          // Слизь
  | "plant"         // Растение
  | "undead";       // Нежить

export type CreatureSize = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan";

export interface MonsterSpeed {
  walk: number;
  fly?: number;
  hover?: boolean;
  swim?: number;
  burrow?: number;
  climb?: number;
}

export interface MonsterAbilities {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface MonsterDamageComponent {
  dice: string;
  mod: number;
  type: string;
}

export interface MonsterAction {
  name: string;
  nameEn?: string;
  type: "melee_attack" | "ranged_attack" | "multiattack" | "breath" | "special" | "spell";
  description: string;
  attackBonus?: number;
  reachFt?: number;
  range?: { normal: number; long?: number };
  damage?: MonsterDamageComponent[];
  aoe?: {
    shape: "cone" | "line" | "sphere" | "cube";
    sizeFt: number;
  };
  save?: {
    ability: "STR" | "DEX" | "CON" | "INT" | "WIS" | "CHA";
    dc: number;
    halfOnSuccess?: boolean;
  };
  recharge?: "5-6" | "6" | "short_rest" | "long_rest";
}

export interface MonsterTrait {
  name: string;
  nameEn?: string;
  description: string;
}

export interface MonsterLegendaryActions {
  actionsPerRound: number;
  description?: string;
  options: Array<{
    name: string;
    cost: number;
    description: string;
  }>;
}

export interface MonsterSpellcasting {
  casterLevel?: number;
  spellSaveDC?: number;
  spellAttackBonus?: number;
  ability?: "INT" | "WIS" | "CHA";
  slots?: Record<number, number>;
  spellsByLevel?: Record<number, string[]>;
  atWill?: string[];
  perDay?: Record<string, string[]>; // "1/день": ["fireball"]
}

export interface MonsterDefinition {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  size: CreatureSize;
  type: CreatureType;
  subtype?: string | null;
  alignment: string;
  challengeRating: number;
  xp: number;
  source: string;
  isNamed: boolean;
  armorClass: {
    value: number;
    type?: string;
  };
  hitPoints: {
    average: number;
    hitDice: string;
  };
  speed: MonsterSpeed;
  abilities: MonsterAbilities;
  savingThrows: Partial<Record<"str" | "dex" | "con" | "int" | "wis" | "cha", number>>;
  skills: Record<string, number>;
  damageResistances: string[];
  damageImmunities: string[];
  damageVulnerabilities: string[];
  conditionImmunities: string[];
  senses: {
    blindsight?: number;
    darkvision?: number;
    tremorsense?: number;
    truesight?: number;
    passivePerception: number;
  };
  languages: string[];
  traits: MonsterTrait[];
  actions: MonsterAction[];
  reactions: MonsterAction[];
  legendaryActions?: MonsterLegendaryActions | null;
  lairActions?: string[];
  spellcasting?: MonsterSpellcasting | null;
}

export interface MonsterManifestEntry {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  type: CreatureType;
  size: CreatureSize;
  challengeRating: number;
  xp: number;
  hpAverage: number;
  ac: number;
  source: string;
  isNamed: boolean;
  filePath: string;
}

export interface MonsterQueryFilter {
  type?: CreatureType;
  minCR?: number;
  maxCR?: number;
  size?: CreatureSize;
  isNamed?: boolean;
  search?: string;
}
