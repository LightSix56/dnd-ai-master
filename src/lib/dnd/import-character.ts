// Импорт персонажа из формата генератора листа (dnd5e-character-sheet).
// Там характеристики хранятся русскими ключами (СИЛ/ЛОВ/...) и разбиты на три
// слагаемых: базовое значение + расовый бонус + бонусы за уровни (ASI).

import { proficiencyBonus } from "@/lib/dnd/dice";

const ABILITY_KEYS = ["СИЛ", "ЛОВ", "ТЕЛ", "ИНТ", "МДР", "ХАР"] as const;

const SKILL_ABILITY: Record<string, (typeof ABILITY_KEYS)[number]> = {
  Акробатика: "ЛОВ",
  Анализ: "ИНТ",
  Атлетика: "СИЛ",
  Внимательность: "МДР",
  Выживание: "МДР",
  Выступление: "ХАР",
  Запугивание: "ХАР",
  История: "ИНТ",
  "Ловкость рук": "ЛОВ",
  Магия: "ИНТ",
  Медицина: "МДР",
  Обман: "ХАР",
  Природа: "ИНТ",
  Проницательность: "МДР",
  Религия: "ИНТ",
  Скрытность: "ЛОВ",
  Убеждение: "ХАР",
  "Уход за животными": "МДР",
};

export interface SheetCharacter {
  name?: string;
  className?: string;
  level?: number;
  race?: string;
  background?: string;
  alignment?: string;
  playerName?: string;
  abilityScores?: Record<string, number>;
  abilityBonuses?: Record<string, number>;
  asiBonuses?: Record<string, number>;
  savingThrowProficiencies?: Record<string, boolean>;
  skillProficiencies?: Record<string, boolean>;
  skillExpertise?: Record<string, boolean>;
  armorClass?: number | null;
  calculatedAC?: number | null;
  ac?: number | null;
  speed?: number;
  hpMax?: number | null;
  hpCurrent?: number;
  hitDice?: string;
  attacks?: Array<{ name?: string; attackBonus?: string; damageAndType?: string }>;
  cp?: number;
  sp?: number;
  ep?: number;
  gp?: number;
  pp?: number;
  personalityTraits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  otherProficienciesLanguages?: string;
  featuresTraits?: string;
  equipment?: string;
  appearance?: string;
  age?: string;
  height?: string;
  weight?: string;
  eyes?: string;
  skin?: string;
  hair?: string;
  backstory?: string;
  treasure?: string;
  alliesOrganizations?: string;
  spellcastingClass?: string;
  spellcastingAbility?: string;
  cantrips?: string[];
  spellsByLevel?: Record<string, Array<{ name?: string; prepared?: boolean }>>;
  spellSlots?: Record<string, { totalSlots?: number; expendedSlots?: number }>;
}

export interface ExtractedStats {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  speed: number;
}

const CLASS_STANDARD_SCORES: Record<string, { str: number; dex: number; con: number; int: number; wis: number; cha: number }> = {
  варвар: { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 10 },
  barbarian: { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 10 },
  воин: { str: 16, dex: 14, con: 15, int: 10, wis: 12, cha: 8 },
  fighter: { str: 16, dex: 14, con: 15, int: 10, wis: 12, cha: 8 },
  паладин: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 16 },
  paladin: { str: 16, dex: 10, con: 14, int: 8, wis: 10, cha: 16 },
  жрец: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
  cleric: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
  друид: { str: 10, dex: 14, con: 14, int: 12, wis: 16, cha: 8 },
  druid: { str: 10, dex: 14, con: 14, int: 12, wis: 16, cha: 8 },
  плут: { str: 10, dex: 16, con: 14, int: 13, wis: 12, cha: 14 },
  rogue: { str: 10, dex: 16, con: 14, int: 13, wis: 12, cha: 14 },
  вор: { str: 10, dex: 16, con: 14, int: 13, wis: 12, cha: 14 },
  следопыт: { str: 12, dex: 16, con: 14, int: 10, wis: 15, cha: 8 },
  ranger: { str: 12, dex: 16, con: 14, int: 10, wis: 15, cha: 8 },
  монах: { str: 12, dex: 16, con: 14, int: 10, wis: 15, cha: 8 },
  monk: { str: 12, dex: 16, con: 14, int: 10, wis: 15, cha: 8 },
  бард: { str: 8, dex: 14, con: 14, int: 12, wis: 10, cha: 16 },
  bard: { str: 8, dex: 14, con: 14, int: 12, wis: 10, cha: 15 },
  волшебник: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
  wizard: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
  маг: { str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10 },
  колдун: { str: 8, dex: 14, con: 14, int: 12, wis: 10, cha: 16 },
  warlock: { str: 8, dex: 14, con: 14, int: 12, wis: 10, cha: 16 },
  чародей: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 16 },
  sorcerer: { str: 8, dex: 14, con: 14, int: 10, wis: 12, cha: 16 },
  изобретатель: { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 8 },
  artificer: { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 8 },
};

export function getArchetypeAbilityScores(className?: string | null): {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
} {
  if (!className) return { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  const lower = className.trim().toLowerCase();
  for (const [key, val] of Object.entries(CLASS_STANDARD_SCORES)) {
    if (lower.includes(key)) return { ...val };
  }
  return { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
}

const STAT_ALIASES: Record<"str" | "dex" | "con" | "int" | "wis" | "cha", string[]> = {
  str: ["СИЛ", "str", "STR", "Сила", "сила", "strength", "Strength"],
  dex: ["ЛОВ", "dex", "DEX", "Ловкость", "ловкость", "dexterity", "Dexterity"],
  con: ["ТЕЛ", "con", "CON", "Телосложение", "телосложение", "constitution", "Constitution"],
  int: ["ИНТ", "int", "INT", "Интеллект", "интеллект", "intelligence", "Intelligence"],
  wis: ["МДР", "wis", "WIS", "Мудрость", "мудрость", "wisdom", "Wisdom"],
  cha: ["ХАР", "cha", "CHA", "Харизма", "харизма", "charisma", "Charisma"],
};

function readStatFromContainer(
  container: Record<string, any> | undefined | null,
  aliases: string[]
): number | undefined {
  if (!container || typeof container !== "object") return undefined;
  for (const key of aliases) {
    const val = container[key];
    if (typeof val === "number" && !isNaN(val) && val > 0) return val;
    if (typeof val === "string") {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }
  return undefined;
}

export function extractCharacterStats(raw: unknown): ExtractedStats {
  const root = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const data = (root.data && typeof root.data === "object" ? root.data : {}) as Record<string, any>;
  const rawSheet = (root.rawSheet && typeof root.rawSheet === "object" ? root.rawSheet : {}) as Record<string, any>;
  const charSnap = (root.characterSnapshot && typeof root.characterSnapshot === "object" ? root.characterSnapshot : {}) as Record<string, any>;
  const charObj = (root.character && typeof root.character === "object" ? root.character : {}) as Record<string, any>;

  // Класс и уровень
  const className =
    root.className ||
    root.class ||
    data.className ||
    data.class ||
    charSnap.className ||
    charSnap.class ||
    rawSheet.className ||
    rawSheet.class ||
    "";
  const level = clampLevel(
    root.level ?? data.level ?? charSnap.level ?? rawSheet.level ?? 1
  );

  const fallbackArchetype = getArchetypeAbilityScores(className);

  // Возможные контейнеры характеристик
  const scoreContainers = [
    root.abilityScores,
    data.abilityScores,
    charSnap.abilityScores,
    rawSheet.abilityScores,
    charObj.abilityScores,
    root.attributes,
    data.attributes,
    root.stats,
    data.stats,
    root,
    data,
    charSnap,
    rawSheet,
  ];

  const bonusContainers = [
    root.abilityBonuses,
    data.abilityBonuses,
    charSnap.abilityBonuses,
    rawSheet.abilityBonuses,
  ];

  const asiContainers = [
    root.asiBonuses,
    data.asiBonuses,
    charSnap.asiBonuses,
    rawSheet.asiBonuses,
  ];

  function extractOneStat(statKey: "str" | "dex" | "con" | "int" | "wis" | "cha"): number {
    const aliases = STAT_ALIASES[statKey];
    let baseScore: number | undefined;

    for (const c of scoreContainers) {
      const found = readStatFromContainer(c, aliases);
      if (found !== undefined) {
        baseScore = found;
        break;
      }
    }

    let bonus = 0;
    for (const bc of bonusContainers) {
      const b = readStatFromContainer(bc, aliases);
      if (b !== undefined) {
        bonus += b;
        break;
      }
    }

    let asi = 0;
    for (const ac of asiContainers) {
      const a = readStatFromContainer(ac, aliases);
      if (a !== undefined) {
        asi += a;
        break;
      }
    }

    if (baseScore !== undefined) {
      return baseScore + bonus + asi;
    }

    // Если характеристика не найдена вообще — берём классовый архетип
    return fallbackArchetype[statKey];
  }

  const str = extractOneStat("str");
  const dex = extractOneStat("dex");
  const con = extractOneStat("con");
  const int = extractOneStat("int");
  const wis = extractOneStat("wis");
  const cha = extractOneStat("cha");

  // HP
  const hitDieMatch = String(
    root.hitDice || data.hitDice || charSnap.hitDice || ""
  ).match(/[dк](\d+)/i);
  let hitDie = hitDieMatch ? parseInt(hitDieMatch[1], 10) : 8;
  if (!hitDieMatch) {
    const lowerClass = String(className).toLowerCase();
    if (lowerClass.includes("варвар")) hitDie = 12;
    else if (lowerClass.includes("воин") || lowerClass.includes("паладин") || lowerClass.includes("следопыт")) hitDie = 10;
    else if (lowerClass.includes("волшебник") || lowerClass.includes("чародей")) hitDie = 6;
    else hitDie = 8;
  }

  const conMod = modifier(con);
  const calculatedHp = hitDie + conMod + (level - 1) * (Math.ceil((1 + hitDie) / 2) + conMod);

  const rawHpMax =
    root.hpMax ??
    root.maxHp ??
    data.hpMax ??
    data.maxHp ??
    charSnap.hpMax ??
    charSnap.maxHp;
  const hpMax =
    typeof rawHpMax === "number" && rawHpMax > 0 ? rawHpMax : Math.max(1, calculatedHp);

  const rawHpCurrent =
    root.hpCurrent ??
    data.hpCurrent ??
    charSnap.hpCurrent ??
    root.currentHp ??
    data.currentHp;
  const hpCurrent =
    typeof rawHpCurrent === "number" && rawHpCurrent > 0 ? Math.min(rawHpCurrent, hpMax) : hpMax;

  // AC
  const dexMod = modifier(dex);
  const rawAc =
    root.ac ??
    root.armorClass ??
    root.calculatedAC ??
    data.ac ??
    data.armorClass ??
    data.calculatedAC ??
    charSnap.ac ??
    charSnap.armorClass;
  const ac = typeof rawAc === "number" && rawAc > 0 ? rawAc : 10 + dexMod;

  // Speed
  const rawSpeed = root.speed ?? data.speed ?? charSnap.speed;
  const speed = typeof rawSpeed === "number" && rawSpeed > 0 ? rawSpeed : 30;

  return { str, dex, con, int, wis, cha, hpMax, hpCurrent, ac, speed };
}

function totalScore(src: SheetCharacter, key: string): number {
  const stats = extractCharacterStats(src);
  if (key === "СИЛ" || key.toLowerCase() === "str") return stats.str;
  if (key === "ЛОВ" || key.toLowerCase() === "dex") return stats.dex;
  if (key === "ТЕЛ" || key.toLowerCase() === "con") return stats.con;
  if (key === "ИНТ" || key.toLowerCase() === "int") return stats.int;
  if (key === "МДР" || key.toLowerCase() === "wis") return stats.wis;
  if (key === "ХАР" || key.toLowerCase() === "cha") return stats.cha;
  return 10;
}

function modifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

function clampLevel(level: unknown): number {
  const n = typeof level === "number" ? Math.trunc(level) : 1;
  return Math.min(20, Math.max(1, n || 1));
}

export function isSheetCharacter(value: unknown): value is SheetCharacter {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, any>;
  const nested = v.data || v.character || v.characterSnapshot || v;

  // 1. Русские ключи в abilityScores
  const scores = nested.abilityScores || v.abilityScores;
  if (scores && typeof scores === "object") {
    if (ABILITY_KEYS.some((k) => k in scores)) return true;
    if (["str", "dex", "con", "STR", "DEX", "CON"].some((k) => k in scores)) return true;
  }
  // 2. Прямые ключи str, dex, con
  if (
    ("str" in nested && "dex" in nested) ||
    ("STR" in nested && "DEX" in nested) ||
    ("str" in v && "dex" in v)
  ) {
    return true;
  }
  // 3. Лист с именем и классом/уровнем
  if (
    (typeof v.name === "string" || typeof nested.name === "string") &&
    (v.className || v.class || nested.className || nested.class)
  ) {
    return true;
  }
  return false;
}

export interface MappedCharacter {
  name: string;
  type: string;
  race: string | null;
  class: string | null;
  level: number;
  background: string | null;
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
  hpCurrent: number;
  hpMax: number;
  ac: number;
  speed: number;
  profBonus: number;
  inventory: string;
  spells: string;
  appearance: string | null;
  personality: string | null;
  bonds: string | null;
  flaws: string | null;
  notes: string | null;
}

/** Приводит лист персонажа с сайта к строке таблицы Character. */
export function mapSheetToCharacter(
  src: SheetCharacter | Record<string, any>,
  type: string = "player"
): MappedCharacter {
  const unwrapped: Record<string, any> = (src as any)?.data || (src as any)?.character || src;
  const level = clampLevel(unwrapped.level || (src as any).level);
  const stats = extractCharacterStats(src);
  const str = stats.str;
  const dex = stats.dex;
  const con = stats.con;
  const int = stats.int;
  const wis = stats.wis;
  const cha = stats.cha;
  const hpMax = stats.hpMax;
  const hpCurrent = stats.hpCurrent;
  const ac = stats.ac;
  const speed = stats.speed;

  const inventory: string[] = [];
  for (const line of (src.equipment || "").split("\n")) {
    const item = line.trim();
    if (item) inventory.push(item);
  }
  const coins = [
    src.pp ? `${src.pp} пм` : "",
    src.gp ? `${src.gp} зм` : "",
    src.ep ? `${src.ep} эм` : "",
    src.sp ? `${src.sp} см` : "",
    src.cp ? `${src.cp} мм` : "",
  ].filter(Boolean);
  if (coins.length) inventory.push(`Деньги: ${coins.join(", ")}`);
  if (src.treasure?.trim()) inventory.push(`Сокровища: ${src.treasure.trim()}`);

  const srcSheet = src as SheetCharacter;
  const spells: string[] = [...(srcSheet.cantrips || []).filter(Boolean).map((c) => `${c} (заговор)`)];
  const spellsByLevel = (srcSheet.spellsByLevel || {}) as Record<string, Array<{ name?: string; prepared?: boolean }>>;
  for (const [lvl, list] of Object.entries(spellsByLevel)) {
    if (Array.isArray(list)) {
      for (const spell of list) {
        if (spell?.name) spells.push(`${spell.name} (${lvl} ур.${spell.prepared ? ", подготовлено" : ""})`);
      }
    }
  }

  const notes: string[] = [];
  if (src.playerName?.trim()) notes.push(`Игрок: ${src.playerName.trim()}`);
  if (src.alignment?.trim()) notes.push(`Мировоззрение: ${src.alignment.trim()}`);
  if (src.hitDice?.trim()) notes.push(`Кость хитов: ${src.hitDice.trim()}`);
  if (src.ideals?.trim()) notes.push(`Идеалы: ${src.ideals.trim()}`);
  if (src.otherProficienciesLanguages?.trim()) notes.push(src.otherProficienciesLanguages.trim());
  if (src.featuresTraits?.trim()) notes.push(`Умения: ${src.featuresTraits.trim()}`);

  const savingThrows = ABILITY_KEYS.filter((k) => src.savingThrowProficiencies?.[k]);
  if (savingThrows.length) notes.push(`Спасброски: ${savingThrows.join(", ")}`);

  const skills = Object.entries(src.skillProficiencies || {})
    .filter(([, has]) => has)
    .map(([skill]) => (src.skillExpertise?.[skill] ? `${skill} (компетенция)` : skill));
  if (skills.length) notes.push(`Навыки: ${skills.join(", ")}`);

  const attacks = (src.attacks || [])
    .filter((a) => a?.name?.trim())
    .map((a) => `${a.name} ${a.attackBonus || ""} ${a.damageAndType || ""}`.replace(/\s+/g, " ").trim());
  if (attacks.length) notes.push(`Атаки: ${attacks.join("; ")}`);

  if (src.spellcastingClass?.trim() || src.spellcastingAbility?.trim()) {
    notes.push(
      `Магия: ${src.spellcastingClass || "—"}${src.spellcastingAbility ? ` (${src.spellcastingAbility})` : ""}`
    );
  }
  const spellSlots = (srcSheet.spellSlots || {}) as Record<string, { totalSlots?: number; expendedSlots?: number }>;
  const slots = Object.entries(spellSlots)
    .filter(([, s]) => ((s as any)?.totalSlots ?? 0) > 0)
    .map(([lvl, s]) => `${lvl} ур.: ${(s as any).totalSlots}`);
  if (slots.length) notes.push(`Ячейки заклинаний: ${slots.join(", ")}`);

  const appearanceParts = [
    src.appearance?.trim(),
    [
      src.age?.trim() && `возраст ${src.age.trim()}`,
      src.height?.trim() && `рост ${src.height.trim()}`,
      src.weight?.trim() && `вес ${src.weight.trim()}`,
      src.eyes?.trim() && `глаза ${src.eyes.trim()}`,
      src.hair?.trim() && `волосы ${src.hair.trim()}`,
      src.skin?.trim() && `кожа ${src.skin.trim()}`,
    ]
      .filter(Boolean)
      .join(", "),
  ].filter(Boolean);

  return {
    name: src.name?.trim() || "Безымянный",
    type,
    race: src.race?.trim() || null,
    class: src.className?.trim() || null,
    level,
    background: src.background?.trim() || null,
    str,
    dex,
    con,
    int,
    wis,
    cha,
    hpCurrent,
    hpMax,
    ac,
    speed: typeof src.speed === "number" && src.speed >= 0 ? src.speed : 30,
    profBonus: proficiencyBonus(level),
    inventory: JSON.stringify(inventory),
    spells: JSON.stringify(spells),
    appearance: appearanceParts.join(". ") || null,
    personality: src.personalityTraits?.trim() || null,
    bonds: src.bonds?.trim() || null,
    flaws: src.flaws?.trim() || null,
    notes: notes.join("\n") || null,
  };
}

export interface DerivedMemory {
  category: string;
  subject: string;
  content: string;
  importance: number;
}

/** Факты для долгосрочной памяти — чтобы мастер знал персонажа, а не только цифры. */
export function deriveMemories(src: SheetCharacter, mapped: MappedCharacter): DerivedMemory[] {
  const out: DerivedMemory[] = [];
  const who = mapped.name;

  out.push({
    category: "character",
    subject: who,
    content:
      `${who} — ${mapped.race || "?"} ${mapped.class || "?"} ${mapped.level} ур.` +
      ` Хиты ${mapped.hpCurrent}/${mapped.hpMax}, КД ${mapped.ac}, скорость ${mapped.speed} фт.` +
      ` Характеристики: СИЛ ${mapped.str}, ЛОВ ${mapped.dex}, ТЕЛ ${mapped.con},` +
      ` ИНТ ${mapped.int}, МДР ${mapped.wis}, ХАР ${mapped.cha}.`,
    importance: 10,
  });

  if (src.backstory?.trim()) {
    out.push({
      category: "character",
      subject: `${who} — предыстория`,
      content: src.backstory.trim().slice(0, 2000),
      importance: 8,
    });
  }

  const personality = [
    src.personalityTraits?.trim() && `Черты: ${src.personalityTraits.trim()}`,
    src.ideals?.trim() && `Идеалы: ${src.ideals.trim()}`,
    src.bonds?.trim() && `Привязанности: ${src.bonds.trim()}`,
    src.flaws?.trim() && `Слабости: ${src.flaws.trim()}`,
  ].filter(Boolean);
  if (personality.length) {
    out.push({
      category: "character",
      subject: `${who} — характер`,
      content: personality.join(" | "),
      importance: 7,
    });
  }

  if (src.alliesOrganizations?.trim()) {
    out.push({
      category: "relationship",
      subject: `${who} — союзники`,
      content: src.alliesOrganizations.trim().slice(0, 1500),
      importance: 6,
    });
  }

  if (src.featuresTraits?.trim()) {
    out.push({
      category: "character",
      subject: `${who} — умения`,
      content: src.featuresTraits.trim().slice(0, 2000),
      importance: 6,
    });
  }

  const skills = Object.entries(src.skillProficiencies || {})
    .filter(([, has]) => has)
    .map(([skill]) => {
      const ability = SKILL_ABILITY[skill];
      const score = ability ? totalScore(src, ability) : 10;
      const bonus =
        modifier(score) + proficiencyBonus(mapped.level) * (src.skillExpertise?.[skill] ? 2 : 1);
      return `${skill} ${bonus >= 0 ? "+" : ""}${bonus}`;
    });
  if (skills.length) {
    out.push({
      category: "character",
      subject: `${who} — навыки`,
      content: `Владение навыками: ${skills.join(", ")}.`,
      importance: 6,
    });
  }

  return out;
}
