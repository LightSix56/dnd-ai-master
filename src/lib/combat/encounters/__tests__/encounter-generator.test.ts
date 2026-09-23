import { describe, it, expect } from "vitest";
import { generateEncounter } from "../encounter-generator";
import type { EncounterRequest, PartyMember } from "../types";
import type { MonsterManifestEntry } from "../../monsters/types";
import { dungeonPrisonPreset } from "../../maps/presets/dungeon-prison";
import { forestAmbushPreset } from "../../maps/presets/forest-ambush";

function createMockEntry(
  slug: string,
  type: MonsterManifestEntry["type"],
  name: string,
  nameEn: string,
  xp: number,
  cr: number,
  options?: Partial<MonsterManifestEntry>
): MonsterManifestEntry {
  return {
    id: slug,
    slug,
    name,
    nameEn,
    type,
    size: "medium",
    challengeRating: cr,
    xp,
    hpAverage: 30,
    ac: 13,
    source: "Monster Manual",
    isNamed: false,
    filePath: `${type}/${slug}.json`,
    ...options,
  };
}

const mockManifest: MonsterManifestEntry[] = [
  // Humanoids
  createMockEntry("goblin-warrior", "humanoid", "Гоблин-воин", "Goblin Warrior", 50, 0.25, { ac: 15, hpAverage: 7 }),
  createMockEntry("goblin-archer", "humanoid", "Гоблин-лучник", "Goblin Archer", 50, 0.25, { ac: 13, hpAverage: 7 }),
  createMockEntry("goblin-boss", "humanoid", "Главарь гоблинов", "Goblin Boss", 200, 1, { ac: 17, hpAverage: 21 }),
  createMockEntry("orc-berserker", "humanoid", "Орк-берсерк", "Orc Berserker", 450, 2, { ac: 14, hpAverage: 45 }),

  // Beasts
  createMockEntry("wolf", "beast", "Волк", "Wolf", 50, 0.25, { ac: 13, hpAverage: 11 }),
  createMockEntry("dire-wolf", "beast", "Лютоволк", "Dire Wolf", 200, 1, { ac: 14, hpAverage: 37 }),
  createMockEntry("brown-bear", "beast", "Бурый медведь", "Brown Bear", 200, 1, { ac: 11, hpAverage: 34 }),

  // Undead
  createMockEntry("skeleton-archer", "undead", "Скелет-лучник", "Skeleton Archer", 50, 0.25, { ac: 13, hpAverage: 13 }),
  createMockEntry("zombie", "undead", "Зомби", "Zombie", 50, 0.25, { ac: 8, hpAverage: 22 }),
  createMockEntry("wight", "undead", "Упырь", "Wight", 700, 3, { ac: 14, hpAverage: 45 }),
  createMockEntry("vampire-spawn", "undead", "Вампирское отродье", "Vampire Spawn", 1800, 5, { ac: 15, hpAverage: 82 }),

  // Monstrosities
  createMockEntry("manticore", "monstrosity", "Мантикора", "Manticore", 700, 3, { ac: 14, hpAverage: 68 }),
];

describe("Encounter Generator Pipeline", () => {
  const standardParty: PartyMember[] = [
    { id: "p1", name: "Fighter", level: 3 },
    { id: "p2", name: "Wizard", level: 3 },
    { id: "p3", name: "Rogue", level: 3 },
    { id: "p4", name: "Cleric", level: 3 },
  ];

  it("should generate a balanced encounter for a standard 4-player party", async () => {
    const request: EncounterRequest = {
      party: standardParty,
      difficulty: "medium",
      mapPresetId: dungeonPrisonPreset.id,
      biome: "dungeon",
    };

    const encounter = await generateEncounter(request, { manifest: mockManifest });

    expect(encounter).toBeDefined();
    expect(encounter.difficulty).toBe("medium");
    expect(encounter.targetXP).toBe(600); // 150 * 4 = 600
    expect(encounter.enemies.length).toBeGreaterThan(0);
    expect(encounter.actualXP).toBeGreaterThan(0);
    expect(encounter.adjustedXP).toBeGreaterThan(0);
    expect(encounter.xpPerPlayer).toBe(Math.floor(encounter.actualXP / 4));
    expect(encounter.mapPreset.id).toBe(dungeonPrisonPreset.id);

    // Verify all enemies have valid grid positions within bounds
    for (const enemy of encounter.enemies) {
      expect(enemy.position.x).toBeGreaterThanOrEqual(0);
      expect(enemy.position.x).toBeLessThan(encounter.mapPreset.gridWidth);
      expect(enemy.position.y).toBeGreaterThanOrEqual(0);
      expect(enemy.position.y).toBeLessThan(encounter.mapPreset.gridHeight);
      expect(enemy.monster).toBeDefined();
      expect(enemy.role).toBeDefined();
    }
  });

  it("should guarantee solo_boss or boss_minions for an Act Climax", async () => {
    const request: EncounterRequest = {
      party: standardParty,
      difficulty: "deadly",
      mapPresetId: dungeonPrisonPreset.id,
      biome: "dungeon",
      isActClimax: true,
    };

    const encounter = await generateEncounter(request, { manifest: mockManifest });

    expect(["solo_boss", "boss_minions"]).toContain(encounter.squadArchetype);
    const hasBossRole = encounter.enemies.some((e) => e.role === "boss");
    expect(hasBossRole).toBe(true);
  });

  it("should prioritize story faction creatures when specified", async () => {
    const request: EncounterRequest = {
      party: standardParty,
      difficulty: "medium",
      mapPresetId: dungeonPrisonPreset.id,
      biome: "dungeon",
      storyFaction: {
        name: "Undead Legion",
        creatureTypes: ["undead"],
      },
    };

    const encounter = await generateEncounter(request, { manifest: mockManifest });

    expect(encounter.enemies.length).toBeGreaterThan(0);
    // Primary enemies should belong to undead
    const undeadEnemies = encounter.enemies.filter((e) => e.monster.type === "undead");
    expect(undeadEnemies.length).toBeGreaterThan(0);
  });

  it("should correctly handle small party size (< 3 players) with shifted multipliers", async () => {
    const soloParty: PartyMember[] = [{ id: "solo", name: "Ranger", level: 4 }];

    const request: EncounterRequest = {
      party: soloParty,
      difficulty: "hard",
      mapPresetId: forestAmbushPreset.id,
      biome: "forest",
    };

    const encounter = await generateEncounter(request, { manifest: mockManifest });

    expect(encounter.targetXP).toBe(375); // Level 4 Hard = 375
    expect(encounter.enemies.length).toBeGreaterThan(0);
    expect(encounter.xpPerPlayer).toBe(encounter.actualXP); // 1 player gets 100% of XP
  });

  it("should correctly handle large party size (>= 6 players) with shifted multipliers", async () => {
    const largeParty: PartyMember[] = [
      { id: "1", name: "P1", level: 2 },
      { id: "2", name: "P2", level: 2 },
      { id: "3", name: "P3", level: 2 },
      { id: "4", name: "P4", level: 2 },
      { id: "5", name: "P5", level: 2 },
      { id: "6", name: "P6", level: 2 },
    ];

    const request: EncounterRequest = {
      party: largeParty,
      difficulty: "medium",
      mapPresetId: forestAmbushPreset.id,
      biome: "forest",
      archetype: "pack",
    };

    const encounter = await generateEncounter(request, { manifest: mockManifest });

    expect(encounter.targetXP).toBe(600); // 100 * 6 = 600
    expect(encounter.enemies.length).toBeGreaterThan(0);
    expect(encounter.xpPerPlayer).toBe(Math.floor(encounter.actualXP / 6));
  });

  it("should verify no enemy is placed on blocking walls", async () => {
    const request: EncounterRequest = {
      party: standardParty,
      difficulty: "hard",
      mapPresetId: dungeonPrisonPreset.id,
      biome: "dungeon",
    };

    const encounter = await generateEncounter(request, { manifest: mockManifest });

    const wallCells = new Set<string>();
    for (const elem of encounter.mapPreset.elements) {
      if (elem.type === "wall" || elem.type === "obstacle") {
        for (let dx = 0; dx < elem.width; dx++) {
          for (let dy = 0; dy < elem.height; dy++) {
            wallCells.add(`${elem.x + dx},${elem.y + dy}`);
          }
        }
      }
    }

    for (const enemy of encounter.enemies) {
      const key = `${enemy.position.x},${enemy.position.y}`;
      expect(wallCells.has(key)).toBe(false);
    }
  });

  it("should fallback gracefully if map preset is not found", async () => {
    const request: EncounterRequest = {
      party: standardParty,
      difficulty: "easy",
      mapPresetId: "non-existent-map-preset",
      biome: "forest",
    };

    const encounter = await generateEncounter(request, { manifest: mockManifest });

    expect(encounter).toBeDefined();
    expect(encounter.mapPreset).toBeDefined();
    expect(encounter.enemies.length).toBeGreaterThan(0);
  });

  it("should generate encounter using the real compendium database (2,875 monsters)", async () => {
    const request: EncounterRequest = {
      party: [
        { id: "hero-1", name: "Thorgar", level: 5 },
        { id: "hero-2", name: "Lyra", level: 5 },
        { id: "hero-3", name: "Finn", level: 5 },
        { id: "hero-4", name: "Rowan", level: 5 },
      ],
      difficulty: "hard",
      mapPresetId: forestAmbushPreset.id,
      biome: "forest",
    };

    // No manifest passed in options -> loads real monsters-manifest.json from disk
    const encounter = await generateEncounter(request);

    expect(encounter).toBeDefined();
    expect(encounter.targetXP).toBe(3000); // 750 * 4 = 3000
    expect(encounter.enemies.length).toBeGreaterThan(0);
    expect(encounter.actualXP).toBeGreaterThan(0);
    expect(encounter.adjustedXP).toBeGreaterThan(0);
    expect(encounter.xpPerPlayer).toBe(Math.floor(encounter.actualXP / 4));

    // Verify enemies have full statblock definitions loaded
    for (const enemy of encounter.enemies) {
      expect(enemy.monster.id).toBeDefined();
      expect(enemy.monster.name).toBeDefined();
      expect(enemy.monster.type).toBeDefined();
      expect(enemy.monster.hitPoints.average).toBeGreaterThan(0);
      expect(enemy.monster.armorClass.value).toBeGreaterThan(0);
      expect(enemy.position.x).toBeGreaterThanOrEqual(0);
      expect(enemy.position.y).toBeGreaterThanOrEqual(0);
    }
  });

  it("should create full combat-ready Combatant objects with traits and attacks for spawned enemies", async () => {
    const request: EncounterRequest = {
      party: [
        { id: "hero-1", name: "Thorgar", level: 5 },
        { id: "hero-2", name: "Lyra", level: 5 },
      ],
      difficulty: "hard",
      mapPresetId: forestAmbushPreset.id,
      biome: "forest",
    };

    const encounter = await generateEncounter(request);

    expect(encounter.combatants).toBeDefined();
    expect(encounter.combatants!.length).toBeGreaterThan(0);

    for (const enemy of encounter.enemies) {
      expect(enemy.combatant).toBeDefined();
      expect(enemy.combatant!.hpCurrent).toBe(enemy.monster.hitPoints.average);
      expect(enemy.combatant!.hpMax).toBe(enemy.monster.hitPoints.average);
      expect(enemy.combatant!.ac).toBe(enemy.monster.armorClass.value);
      expect(enemy.combatant!.isAIControlled).toBe(true);
      expect(enemy.combatant!.attacks.length).toBeGreaterThan(0);
      expect(enemy.combatant!.x).toBe(enemy.position.x);
      expect(enemy.combatant!.y).toBe(enemy.position.y);
      expect(enemy.combatant!.tacticalRole).toBeDefined();
    }
  });
});

