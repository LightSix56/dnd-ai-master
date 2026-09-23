import type { Character } from "@/lib/store";

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export interface AbilityMeta {
  key: AbilityKey;
  ruShort: string;
  ruFull: string;
  ruGenitive: string;
}

export const ABILITY_META_LIST: AbilityMeta[] = [
  { key: "str", ruShort: "СИЛ", ruFull: "Сила", ruGenitive: "Силы" },
  { key: "dex", ruShort: "ЛОВ", ruFull: "Ловкость", ruGenitive: "Ловкости" },
  { key: "con", ruShort: "ТЕЛ", ruFull: "Телосложение", ruGenitive: "Телосложения" },
  { key: "int", ruShort: "ИНТ", ruFull: "Интеллект", ruGenitive: "Интеллекта" },
  { key: "wis", ruShort: "МДР", ruFull: "Мудрость", ruGenitive: "Мудрости" },
  { key: "cha", ruShort: "ХАР", ruFull: "Харизма", ruGenitive: "Харизмы" },
];

export interface SkillDef {
  id: string;
  name: string;
  ability: AbilityKey;
}

export const DND_SKILLS: SkillDef[] = [
  { id: "athletics", name: "Атлетика", ability: "str" },
  { id: "acrobatics", name: "Акробатика", ability: "dex" },
  { id: "sleight_of_hand", name: "Ловкость рук", ability: "dex" },
  { id: "stealth", name: "Скрытность", ability: "dex" },
  { id: "arcana", name: "Магия", ability: "int" },
  { id: "history", name: "История", ability: "int" },
  { id: "investigation", name: "Анализ", ability: "int" },
  { id: "nature", name: "Природа", ability: "int" },
  { id: "religion", name: "Религия", ability: "int" },
  { id: "animal_handling", name: "Уход за животными", ability: "wis" },
  { id: "insight", name: "Проницательность", ability: "wis" },
  { id: "medicine", name: "Медицина", ability: "wis" },
  { id: "perception", name: "Внимательность", ability: "wis" },
  { id: "survival", name: "Выживание", ability: "wis" },
  { id: "deception", name: "Обман", ability: "cha" },
  { id: "intimidation", name: "Запугивание", ability: "cha" },
  { id: "performance", name: "Выступление", ability: "cha" },
  { id: "persuasion", name: "Убеждение", ability: "cha" },
];

export interface ParsedAttack {
  name: string;
  bonus: number;
  notation: string;
  damageAndType?: string;
}

export interface ParsedProficiencies {
  savingThrows: Set<string>;
  skills: Map<string, "proficient" | "expertise">;
  attacks: ParsedAttack[];
}

/** Вычисляет модификатор характеристики по правилам D&D 5e: floor((score - 10) / 2). */
export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** Дефолтные спасброски по классам D&D 5e (на случай если в notes их нет). */
const CLASS_SAVING_THROWS: Record<string, string[]> = {
  варвар: ["СИЛ", "ТЕЛ"],
  бард: ["ЛОВ", "ХАР"],
  жрец: ["МДР", "ХАР"],
  друид: ["ИНТ", "МДР"],
  воин: ["СИЛ", "ТЕЛ"],
  монах: ["СИЛ", "ЛОВ"],
  паладин: ["МДР", "ХАР"],
  следопыт: ["СИЛ", "ЛОВ"],
  плут: ["ЛОВ", "ИНТ"],
  чародей: ["ТЕЛ", "ХАР"],
  колдун: ["МДР", "ХАР"],
  волшебник: ["ИНТ", "МДР"],
  изобретатель: ["ТЕЛ", "ИНТ"],
};

/** Парсит заметки персонажа (notes) для извлечения спасбросков, навыков и атак. */
export function parseCharacterProficiencies(
  notes?: string | null,
  className?: string | null
): ParsedProficiencies {
  const text = notes || "";
  const savingThrows = new Set<string>();
  const skills = new Map<string, "proficient" | "expertise">();
  const attacks: ParsedAttack[] = [];

  // 1. Спасброски
  const savesMatch = text.match(/Спасброски:\s*([^\n\r]+)/i);
  if (savesMatch) {
    const rawSaves = savesMatch[1].split(/[,;]+/).map((s) => s.trim().toUpperCase());
    for (const s of rawSaves) {
      if (s) savingThrows.add(s);
    }
  } else if (className) {
    const defaultSaves = CLASS_SAVING_THROWS[className.toLowerCase().trim()];
    if (defaultSaves) {
      for (const s of defaultSaves) savingThrows.add(s);
    }
  }

  // 2. Навыки
  const skillsMatch = text.match(/Навыки:\s*([^\n\r]+)/i);
  if (skillsMatch) {
    const rawSkills = skillsMatch[1].split(/[,;]+/).map((s) => s.trim());
    for (const item of rawSkills) {
      if (!item) continue;
      if (item.toLowerCase().includes("компетенция") || item.toLowerCase().includes("экспертиза")) {
        const cleaned = item.replace(/\s*\([^)]*\)/g, "").trim();
        skills.set(cleaned, "expertise");
      } else {
        const cleaned = item.replace(/\s*\([^)]*\)/g, "").trim();
        skills.set(cleaned, "proficient");
      }
    }
  }

  // 3. Атаки
  const attacksMatch = text.match(/Атаки:\s*([^\n\r]+)/i);
  if (attacksMatch) {
    const items = attacksMatch[1].split(";").map((s) => s.trim()).filter(Boolean);
    for (const item of items) {
      // Пример: "Секира +5 1d12+3 рубящий"
      const m = item.match(/^([^+-\d]+?)\s*([+-]\d+)\s*(.*)$/);
      if (m) {
        attacks.push({
          name: m[1].trim(),
          bonus: parseInt(m[2], 10),
          notation: m[2],
          damageAndType: m[3].trim(),
        });
      } else {
        attacks.push({
          name: item,
          bonus: 0,
          notation: "+0",
        });
      }
    }
  }

  return { savingThrows, skills, attacks };
}

/** Вычисляет итоговый бонус навыка персонажа. */
export function getSkillBonus(
  character: Character,
  skill: SkillDef,
  parsed?: ParsedProficiencies
): number {
  const profs = parsed || parseCharacterProficiencies(character.notes, character.class);
  const baseStat = character[skill.ability] ?? 10;
  const baseMod = abilityModifier(baseStat);
  const prof = profs.skills.get(skill.name);
  const profBonus = character.profBonus || 2;

  if (prof === "expertise") {
    return baseMod + 2 * profBonus;
  }
  if (prof === "proficient") {
    return baseMod + profBonus;
  }
  return baseMod;
}

/** Вычисляет итоговый бонус спасброска персонажа. */
export function getSaveBonus(
  character: Character,
  ability: AbilityKey,
  parsed?: ParsedProficiencies
): number {
  const profs = parsed || parseCharacterProficiencies(character.notes, character.class);
  const baseStat = character[ability] ?? 10;
  const baseMod = abilityModifier(baseStat);
  const meta = ABILITY_META_LIST.find((a) => a.key === ability);
  const isProf = meta && profs.savingThrows.has(meta.ruShort);
  const profBonus = character.profBonus || 2;

  return isProf ? baseMod + profBonus : baseMod;
}

/** Форматирует строку броска в формате (16+4) по запросу пользователя. */
export function formatD20RollResult(
  label: string,
  roll: number,
  bonus: number
): string {
  const sign = bonus >= 0 ? `+${bonus}` : `${bonus}`;
  let extra = "";
  if (roll === 20) {
    extra = " — Натуральная 20! 🌟";
  } else if (roll === 1) {
    extra = " — Натуральная 1! 💀";
  }
  return `${label}: (${roll}${sign})${extra}`;
}

/** Генерирует случайный бросок d20 (1-20). */
export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

/** Генерирует случайный бросок кубика с заданным числом граней. */
export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}
