// Заряды классовых способностей по правилам D&D 5e (PHB).
// Отдельный файл без тяжёлых импортов: им пользуются и сервер, и редактор способностей в браузере.

import type { ActionParameters, CombatAbility } from "./types";

export type AbilityUsesFormula = NonNullable<ActionParameters["usesFormula"]>;

/** Сколько раз варвар впадает в Ярость между длинными отдыхами (на 20 уровне — без ограничения) */
export function rageUses(level: number): number {
  if (level >= 20) return 0;
  if (level >= 17) return 6;
  if (level >= 12) return 5;
  if (level >= 6) return 4;
  if (level >= 3) return 3;
  return 2;
}

/** Бонус Ярости к урону рукопашной атакой Силой */
export function rageDamageBonus(level: number): number {
  if (level >= 16) return 4;
  if (level >= 9) return 3;
  return 2;
}

/** Кость Вдохновения барда: к6, к8 с 5 ур., к10 с 10 ур., к12 с 15 ур. */
export function bardicInspirationDie(level: number): number {
  if (level >= 15) return 12;
  if (level >= 10) return 10;
  if (level >= 5) return 8;
  return 6;
}

/** Кость боевых искусств монаха для безоружного удара */
export function martialArtsDie(level: number): string {
  if (level >= 17) return "1d10";
  if (level >= 11) return "1d8";
  if (level >= 5) return "1d6";
  return "1d4";
}

/**
 * Максимум зарядов и момент их восстановления для способности с параметрами `params`.
 * usesMax = 0 означает «без ограничения» (так понимает движок).
 */
export function resolveAbilityUses(
  params: Partial<ActionParameters> | undefined | null,
  ctx: { level: number; profBonus: number; abilityMods?: Record<string, number> }
): { usesMax: number; refresh: CombatAbility["refresh"] } {
  const level = Math.max(1, ctx.level || 1);
  const refresh = params?.refresh ?? "none";
  switch (params?.usesFormula) {
    case "profBonus":
      return { usesMax: ctx.profBonus, refresh };
    case "level":
      return { usesMax: level, refresh };
    case "rage":
      return { usesMax: rageUses(level), refresh: "long" };
    case "actionSurge":
      return { usesMax: level >= 17 ? 2 : 1, refresh: "short" };
    case "layOnHands":
      return { usesMax: level * 5, refresh: "long" };
    case "wildShape":
      // Архидруид (20 ур.): Дикий облик без ограничения
      return { usesMax: level >= 20 ? 0 : 2, refresh: "short" };
    case "bardicInspiration":
      // С 5 уровня (Источник вдохновения) восстанавливается и на коротком отдыхе
      return {
        usesMax: Math.max(1, ctx.abilityMods?.CHA ?? 0),
        refresh: level >= 5 ? "short" : "long",
      };
    default:
      return { usesMax: params?.uses ?? 0, refresh };
  }
}
