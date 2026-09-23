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

function totalScore(src: SheetCharacter, key: string): number {
  const base = src.abilityScores?.[key];
  const racial = src.abilityBonuses?.[key] ?? 0;
  const asi = src.asiBonuses?.[key] ?? 0;
  return (typeof base === "number" ? base : 10) + racial + asi;
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
  const v = value as Record<string, unknown>;
  // Ключевой признак формата — характеристики русскими ключами.
  return (
    typeof v.abilityScores === "object" &&
    v.abilityScores !== null &&
    ABILITY_KEYS.some((k) => k in (v.abilityScores as Record<string, unknown>))
  );
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
  src: SheetCharacter,
  type: string = "player"
): MappedCharacter {
  const level = clampLevel(src.level);
  const str = totalScore(src, "СИЛ");
  const dex = totalScore(src, "ЛОВ");
  const con = totalScore(src, "ТЕЛ");
  const int = totalScore(src, "ИНТ");
  const wis = totalScore(src, "МДР");
  const cha = totalScore(src, "ХАР");

  // На сайте hpMax может быть null (поле не заполнено) — тогда прикидываем по
  // кости хитов, иначе персонаж создастся с дефолтными 10 хитами.
  const hitDieMatch = (src.hitDice || "").match(/[dк](\d+)/i);
  const hitDie = hitDieMatch ? parseInt(hitDieMatch[1], 10) : 8;
  const fallbackHp = hitDie + modifier(con) + (level - 1) * (Math.ceil((1 + hitDie) / 2) + modifier(con));
  const hpMax = typeof src.hpMax === "number" && src.hpMax > 0 ? src.hpMax : Math.max(1, fallbackHp);
  const hpCurrent =
    typeof src.hpCurrent === "number" && src.hpCurrent > 0 ? Math.min(src.hpCurrent, hpMax) : hpMax;

  const ac =
    typeof src.armorClass === "number" && src.armorClass > 0
      ? src.armorClass
      : typeof src.calculatedAC === "number" && src.calculatedAC > 0
      ? src.calculatedAC
      : typeof src.ac === "number" && src.ac > 0
      ? src.ac
      : 10 + modifier(dex);

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

  const spells: string[] = [...(src.cantrips || []).filter(Boolean).map((c) => `${c} (заговор)`)];
  for (const [lvl, list] of Object.entries(src.spellsByLevel || {})) {
    for (const spell of list || []) {
      if (spell?.name) spells.push(`${spell.name} (${lvl} ур.${spell.prepared ? ", подготовлено" : ""})`);
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
  const slots = Object.entries(src.spellSlots || {})
    .filter(([, s]) => (s?.totalSlots ?? 0) > 0)
    .map(([lvl, s]) => `${lvl} ур.: ${s.totalSlots}`);
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
