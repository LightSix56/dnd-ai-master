import type { EncounterDifficulty, SpawnedEnemy, SquadArchetype } from "./types";

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
 * Сложность кампании как множитель бюджета, когда мастер сам назвал сложность боя:
 * без него настройка кампании не влияла бы на бои, где мастер указал уровень.
 */
const CAMPAIGN_BUDGET_SCALE: Record<string, number> = {
  easy: 0.85,
  normal: 1,
  hard: 1.15,
  brutal: 1.3,
};

export function campaignBudgetScale(campaignDifficulty: string | null | undefined): number {
  return CAMPAIGN_BUDGET_SCALE[campaignDifficulty ?? ""] ?? 1;
}

/** Имена составов, которые называет мастер (и старые), → типы решателя отряда */
const ARCHETYPE_ALIASES: Record<string, SquadArchetype> = {
  any: "any",
  solo_boss: "solo_boss",
  boss_with_minions: "boss_minions",
  boss_minions: "boss_minions",
  balanced_squad: "tactical_squad",
  tactical_squad: "tactical_squad",
  ambush_duo: "tactical_squad",
  horde: "horde",
  pack: "pack",
};

export function normalizeArchetype(value: string | null | undefined): SquadArchetype | undefined {
  if (!value) return undefined;
  const mapped = ARCHETYPE_ALIASES[value];
  return mapped === "any" ? undefined : mapped;
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
