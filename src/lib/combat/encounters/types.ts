import type { CreatureType, MonsterDefinition } from "../monsters/types";
import type { TacticalMapPreset } from "../maps/types";
import type { Combatant } from "../types";

export interface PartyMember {
  id: string;
  name: string;
  level: number;
}

export type EncounterDifficulty = "easy" | "medium" | "hard" | "deadly";
export type SquadArchetype = "boss_minions" | "tactical_squad" | "pack" | "solo_boss" | "any";

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
  biome?: string;
  storyFaction?: StoryFactionContext;
  archetype?: SquadArchetype;
  isActClimax?: boolean;
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
