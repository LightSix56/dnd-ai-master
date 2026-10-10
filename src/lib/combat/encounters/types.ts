import type { CreatureType, MonsterDefinition } from "../monsters/types";
import type { TacticalMapPreset } from "../maps/types";
import type { Combatant } from "../types";

export interface PartyMember {
  id: string;
  name: string;
  level: number;
}

/** Пороги DMG p. 82; overwhelming — сверх «смертельного»: безнадёжная для отряда ситуация (армия, стража большого города) */
export type EncounterDifficulty = "easy" | "medium" | "hard" | "deadly" | "overwhelming";
/** boss_minions — босс со свитой, tactical_squad — сбалансированный отряд, pack — стая однотипных, horde — орда мелочи, solo_boss — один босс */
export type SquadArchetype = "boss_minions" | "tactical_squad" | "pack" | "horde" | "solo_boss" | "any";

export interface StoryFactionContext {
  name?: string;
  creatureTypes?: CreatureType[];
  tags?: string[];
  bossMonsterId?: string;
}

export interface EncounterRequest {
  party: PartyMember[];
  difficulty: EncounterDifficulty;
  mapPresetId: string;
  /** Зерно процедурной карты; без него — случайное */
  mapSeed?: number;
  biome?: string;
  storyFaction?: StoryFactionContext;
  archetype?: SquadArchetype;
  isActClimax?: boolean;
  /** Множитель бюджета опыта (сложность кампании при явной сложности мастера); без него 1 */
  budgetScale?: number;
}

export interface SpawnedEnemy {
  monster: MonsterDefinition;
  role: "boss" | "frontline" | "ranged" | "support" | "minion";
  position: { x: number; y: number };
  combatant?: Combatant;
}

export interface GeneratedEncounter {
  difficulty: EncounterDifficulty;
  targetXP: number;
  actualXP: number;
  adjustedXP: number;
  squadArchetype: string;
  enemies: SpawnedEnemy[];
  mapPreset: TacticalMapPreset;
  xpPerPlayer: number;
  combatants?: Combatant[];
}

export interface SquadMonsterSlot {
  monsterSlug: string;
  role: "boss" | "frontline" | "ranged" | "support" | "minion";
  count: number;
}

export interface SquadPlan {
  archetype: SquadArchetype;
  slots: SquadMonsterSlot[];
  targetAdjustedXP: number;
  estimatedRawXP: number;
  estimatedAdjustedXP: number;
}
