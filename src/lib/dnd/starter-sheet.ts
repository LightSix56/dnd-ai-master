// Стартовый лист нового героя: один и тот же в соло и в комнате.
import { extractCharacterStats, getArchetypeAbilityScores } from "@/lib/dnd/import-character";

/** Стартовый лист героя, созданного прямо в комнате или взятого из героев кампании без листа */
export function buildStarterSheet(input: {
  name: string;
  race?: string | null;
  className?: string | null;
  subclass?: string | null;
  level: number;
  scores?: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  hpMax?: number | null;
  hpCurrent?: number | null;
  armorClass?: number | null;
  speed?: number | null;
}): Record<string, any> {
  const scores = input.scores ?? getArchetypeAbilityScores(input.className);
  const sheet: Record<string, any> = {
    name: input.name.trim(),
    race: input.race || "",
    className: input.className || "",
    subclass: input.subclass || "",
    level: input.level,
    experiencePoints: 0,
    abilityScores: {
      СИЛ: scores.str, ЛОВ: scores.dex, ТЕЛ: scores.con, ИНТ: scores.int, МДР: scores.wis, ХАР: scores.cha,
    },
    speed: input.speed && input.speed > 0 ? input.speed : 30,
  };
  if (input.armorClass && input.armorClass > 0) sheet.armorClass = input.armorClass;
  // Хиты: заданные явно либо расчётные по классу и уровню
  const stats = extractCharacterStats({ ...sheet, hpMax: input.hpMax ?? undefined });
  sheet.hpMax = stats.hpMax;
  sheet.hpCurrent =
    typeof input.hpCurrent === "number" && input.hpCurrent >= 0 ? Math.min(input.hpCurrent, stats.hpMax) : stats.hpMax;
  sheet.hpTemp = 0;
  if (!sheet.armorClass) sheet.armorClass = stats.ac;
  return sheet;
}
