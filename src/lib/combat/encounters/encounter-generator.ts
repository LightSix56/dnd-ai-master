import * as fs from "fs";
import * as path from "path";
import type {
  EncounterRequest,
  GeneratedEncounter,
  SpawnedEnemy,
  PartyMember,
} from "./types";
import type { MonsterDefinition, MonsterManifestEntry } from "../monsters/types";
import type { TacticalMapPreset, BiomeType } from "../maps/types";
import type { Combatant } from "../types";
import {
  calculatePartyXPBudget,
  calculateAwardedXP,
  calculateAdjustedXP,
} from "./xp-calculator";
import { getBiomeCandidatePool } from "./biome-matcher";
import { solveSquad } from "./archetype-solver";
import {
  getPresetById,
  getPresetByBiome,
  ALL_PRESETS,
} from "../maps/presets";
import {
  assignTacticalSpawns,
  type TacticalRole,
} from "../maps/spawn-director";
import { monsterDefinitionToCombatant } from "../monsters/monster-adapter";

export interface GenerateEncounterOptions {
  manifest?: MonsterManifestEntry[];
  monstersDir?: string;
}

let cachedManifest: MonsterManifestEntry[] | null = null;

/**
 * Loads the default compendium monsters manifest from disk.
 */
export function loadDefaultManifest(customDir?: string): MonsterManifestEntry[] {
  if (cachedManifest && !customDir) {
    return cachedManifest;
  }

  const baseDir = customDir || path.resolve(process.cwd(), "src/data/compendium/monsters");
  const manifestPath = path.join(baseDir, "monsters-manifest.json");

  if (fs.existsSync(manifestPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      if (Array.isArray(data)) {
        if (!customDir) cachedManifest = data;
        return data;
      }
    } catch {
      // Fallback below
    }
  }

  return [];
}

/**
 * Synthesizes a valid MonsterDefinition from a manifest entry if full file is absent.
 */
export function createMonsterDefinitionFromManifest(entry: MonsterManifestEntry): MonsterDefinition {
  return {
    id: entry.id,
    slug: entry.slug,
    name: entry.name,
    nameEn: entry.nameEn,
    size: entry.size,
    type: entry.type,
    alignment: "любое",
    challengeRating: entry.challengeRating,
    xp: entry.xp,
    source: entry.source,
    isNamed: entry.isNamed,
    armorClass: { value: entry.ac },
    hitPoints: { average: entry.hpAverage, hitDice: "1d8" },
    speed: { walk: 30 },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: {},
    skills: {},
    damageResistances: [],
    damageImmunities: [],
    damageVulnerabilities: [],
    conditionImmunities: [],
    senses: { passivePerception: 10 },
    languages: ["Общий"],
    traits: [],
    actions: [],
    reactions: [],
  };
}

/**
 * Loads a monster definition from disk or creates a fallback from manifest entry.
 */
export function loadMonsterDefinition(
  slug: string,
  entry?: MonsterManifestEntry,
  monstersDir?: string
): MonsterDefinition {
  if (entry?.filePath) {
    const baseDir = monstersDir || path.join(process.cwd(), "src/data/compendium/monsters");
    const filePath = path.join(/*turbopackIgnore: true*/ baseDir, entry.filePath);
    if (fs.existsSync(/*turbopackIgnore: true*/ filePath)) {
      try {
        return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ filePath, "utf8")) as MonsterDefinition;
      } catch {
        // Fallback to synthesizing
      }
    }
  }

  if (entry) {
    return createMonsterDefinitionFromManifest(entry);
  }

  return {
    id: slug,
    slug,
    name: slug,
    nameEn: slug,
    size: "medium",
    type: "humanoid",
    alignment: "любое",
    challengeRating: 1,
    xp: 200,
    source: "System",
    isNamed: false,
    armorClass: { value: 12 },
    hitPoints: { average: 25, hitDice: "1d8" },
    speed: { walk: 30 },
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    savingThrows: {},
    skills: {},
    damageResistances: [],
    damageImmunities: [],
    damageVulnerabilities: [],
    conditionImmunities: [],
    senses: { passivePerception: 10 },
    languages: ["Общий"],
    traits: [],
    actions: [],
    reactions: [],
  };
}

/**
 * Creates a minimal Combatant stub for tactical map positioning via SpawnDirector.
 */
function createCombatantStub(
  id: string,
  name: string,
  type: "player" | "enemy",
  hp: number,
  ac: number,
  role: TacticalRole
): Combatant {
  const isBackline = role === "backline";
  return {
    id,
    name,
    type,
    color: type === "player" ? "#3b82f6" : "#ef4444",
    x: 0,
    y: 0,
    hpCurrent: hp,
    hpMax: hp,
    hpTemp: 0,
    ac,
    speed: 30,
    initiative: 10,
    initiativeTiebreak: 10,
    dexMod: 0,
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: isBackline ? "Wizard" : "Fighter",
    level: 1,
    size: "medium",
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: isBackline
      ? [
          {
            id: "atk-ranged",
            name: "Дальнобойный лук",
            kind: "ranged",
            range: { normal: 60, long: 120 },
            attackBonus: 4,
            damage: [{ dice: "1d8", mod: 2, type: "piercing" }],
            actionCost: "action",
          },
        ]
      : [
          {
            id: "atk-melee",
            name: "Удар мечом",
            kind: "melee",
            range: { normal: 5 },
            attackBonus: 4,
            damage: [{ dice: "1d8", mod: 2, type: "slashing" }],
            actionCost: "action",
          },
        ],
    spells: { slots: {}, known: [] },
    abilities: [],
    concentration: null,
    saves: {},
    abilityMods: { STR: 0, DEX: 0, CON: 0, INT: 0, WIS: 0, CHA: 0 },
    profBonus: 2,
    isAIControlled: type === "enemy",
  };
}

/**
 * Generates an end-to-end tactical D&D 5e encounter with XP budget,
 * squad archetype balance, and valid tactical map grid positioning.
 */
export async function generateEncounter(
  request: EncounterRequest,
  options?: GenerateEncounterOptions
): Promise<GeneratedEncounter> {
  const party: PartyMember[] = request.party || [];
  const partySize = Math.max(1, party.length);

  // 1. Calculate XP budget according to DMG p. 82
  const targetXP = calculatePartyXPBudget(party, request.difficulty);

  // 2. Resolve Tactical Map Preset
  let mapPreset = getPresetById(request.mapPresetId);
  if (!mapPreset && request.biome) {
    mapPreset = getPresetByBiome(request.biome as BiomeType);
  }
  if (!mapPreset) {
    mapPreset = ALL_PRESETS[0];
  }

  const effectiveBiome = request.biome || mapPreset.biome || "dungeon";

  // 3. Resolve Monster Candidate Pool
  const manifest = options?.manifest || loadDefaultManifest(options?.monstersDir);
  const pool = getBiomeCandidatePool(manifest, effectiveBiome, request.storyFaction);

  // 4. Solve Squad Composition
  const squadPlan = solveSquad(
    pool,
    targetXP,
    request.archetype || "any",
    partySize,
    request.isActClimax
  );

  // 5. Assemble Entities for Tactical Placement
  const allCombatants: Combatant[] = [];
  const roleOverrides: Record<string, TacticalRole> = {};

  // Add party heroes
  party.forEach((hero, index) => {
    const heroCombatant = createCombatantStub(
      hero.id || `hero-${index}`,
      hero.name || `Герой ${index + 1}`,
      "player",
      20 + hero.level * 6,
      14,
      "vanguard"
    );
    allCombatants.push(heroCombatant);
  });

  // Add enemies from squad plan
  interface EnemyToSpawn {
    id: string;
    monster: MonsterDefinition;
    role: "boss" | "frontline" | "ranged" | "support" | "minion";
    combatant: Combatant;
  }

  const enemiesToSpawn: EnemyToSpawn[] = [];
  let enemyCounter = 0;

  for (const slot of squadPlan.slots) {
    const manifestEntry =
      pool.find((m) => m.slug === slot.monsterSlug) ||
      manifest.find((m) => m.slug === slot.monsterSlug);

    const monsterDef = loadMonsterDefinition(slot.monsterSlug, manifestEntry, options?.monstersDir);

    for (let count = 0; count < slot.count; count++) {
      enemyCounter++;
      const enemyId = `enemy-${slot.monsterSlug}-${enemyCounter}`;

      let tacticalRole: TacticalRole;
      if (slot.role === "boss") {
        tacticalRole = "boss";
      } else if (slot.role === "ranged" || slot.role === "support") {
        tacticalRole = "backline";
      } else {
        tacticalRole = "vanguard";
      }

      roleOverrides[enemyId] = tacticalRole;

      const enemyCombatant = monsterDefinitionToCombatant(monsterDef, {
        id: enemyId,
        role: tacticalRole,
        isAIControlled: true,
        type: "enemy",
      });

      allCombatants.push(enemyCombatant);
      enemiesToSpawn.push({
        id: enemyId,
        monster: monsterDef,
        role: slot.role,
        combatant: enemyCombatant,
      });
    }
  }

  // 6. Execute Spawn Placement with Obstacle & Line-of-Sight avoidance
  const positionedCombatants = assignTacticalSpawns(mapPreset, allCombatants, {
    roleOverrides,
    randomizeWithinZone: true,
  });

  const positionMap = new Map<string, { x: number; y: number }>();
  for (const c of positionedCombatants) {
    positionMap.set(c.id, { x: c.x, y: c.y });
  }

  const enemies: SpawnedEnemy[] = enemiesToSpawn.map((spawn) => {
    const pos = positionMap.get(spawn.id) || { x: 0, y: 0 };
    spawn.combatant.x = pos.x;
    spawn.combatant.y = pos.y;
    return {
      monster: spawn.monster,
      role: spawn.role,
      position: pos,
      combatant: spawn.combatant,
    };
  });

  // 7. Calculate Authoritative XP Metrics
  const allEnemiesXP = enemies.map((e) => e.monster.xp);
  const actualXP = allEnemiesXP.reduce((sum, xp) => sum + xp, 0);
  const adjustedXP = calculateAdjustedXP(allEnemiesXP, partySize);
  const { xpPerPlayer } = calculateAwardedXP(allEnemiesXP, partySize);

  return {
    difficulty: request.difficulty,
    targetXP,
    actualXP,
    adjustedXP,
    squadArchetype: squadPlan.archetype,
    enemies,
    mapPreset,
    xpPerPlayer,
    combatants: positionedCombatants,
  };
}
