import type { EncounterDifficulty, SpawnedEnemy } from "./types";

/** Сложность кампании (Campaign.difficulty) → сложность столкновения по DMG */
const CAMPAIGN_TO_ENCOUNTER: Record<string, EncounterDifficulty> = {
  easy: "easy",
  normal: "medium",
  hard: "hard",
  brutal: "deadly",
};

/**
 * Сложность боя: та, что назвал мастер, иначе — сложность кампании, иначе средняя.
 * Состав врагов от неё не зависит напрямую: он всегда считается по бюджету опыта партии.
 */
export function resolveEncounterDifficulty(
  masterDifficulty: EncounterDifficulty | undefined,
  campaignDifficulty: string | null | undefined
): EncounterDifficulty {
  if (masterDifficulty) return masterDifficulty;
  return CAMPAIGN_TO_ENCOUNTER[campaignDifficulty ?? ""] ?? "medium";
}

/**
 * Даёт сюжетное имя вожаку отряда: боссу, а если босса нет — самому сильному врагу.
 * Меняется только имя: характеристики вожака остаются подобранными под баланс.
 */
export function applyLeaderName(enemies: SpawnedEnemy[], leaderName: string | undefined): void {
  const name = leaderName?.trim();
  if (!name || enemies.length === 0) return;

  const leader =
    enemies.find((e) => e.role === "boss") ??
    enemies.reduce((best, e) => ((e.monster.xp ?? 0) > (best.monster.xp ?? 0) ? e : best));
  if (leader.combatant) leader.combatant.name = name;
}
