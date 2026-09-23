import { describe, it, expect } from "vitest";
import {
  ALL_PRESETS,
  PRESETS_BY_BIOME,
  getPresetByBiome,
  getPresetById,
} from "../presets";
import type { BiomeType } from "../types";

describe("24 Canonical Biome Presets (presets)", () => {
  const REQUIRED_BIOMES: BiomeType[] = [
    "ship_battle",
    "temple",
    "tavern",
    "forest_ambush",
    "lava_cave",
    "dungeon_prison",
    "city_street",
    "gladiator_arena",
    "swamp_bog",
    "snowy_mountain",
    "desert_dunes",
    "underdark_mushrooms",
    "graveyard_crypt",
    "bridge_chasm",
    "mine_tracks",
    "sewers",
    "wizard_tower",
    "castle_courtyard",
    "bandit_camp",
    "spider_nest",
    "docks_harbor",
    "tomb_pyramid",
    "foundry_forge",
    "astral_rift",
  ];

  it("should provide exactly 24 canonical biome presets", () => {
    expect(ALL_PRESETS).toHaveLength(24);
    for (const biome of REQUIRED_BIOMES) {
      expect(PRESETS_BY_BIOME[biome]).toBeDefined();
      expect(PRESETS_BY_BIOME[biome].biome).toBe(biome);
    }
  });

  it("should have valid dimensions, elements, and spawn zones for each preset", () => {
    for (const preset of ALL_PRESETS) {
      expect(preset.gridWidth).toBeGreaterThanOrEqual(10);
      expect(preset.gridHeight).toBeGreaterThanOrEqual(10);
      expect(preset.cellSizeFt).toBe(5);

      // Spawn zones must contain at least party, enemy_frontline, and boss
      const partyZone = preset.spawnZones.find((z) => z.name === "party");
      expect(partyZone).toBeDefined();
      expect(partyZone!.cells.length).toBeGreaterThan(0);

      const bossZone = preset.spawnZones.find((z) => z.name === "boss");
      expect(bossZone).toBeDefined();
      expect(bossZone!.cells.length).toBeGreaterThan(0);

      // Verify no spawn zone cell is inside a solid wall
      const wallKeys = new Set(
        preset.elements
          .filter((e) => e.type === "wall")
          .map((e) => `${e.x},${e.y}`)
      );

      for (const zone of preset.spawnZones) {
        for (const cell of zone.cells) {
          expect(wallKeys.has(`${cell.x},${cell.y}`)).toBe(false);
          expect(cell.x).toBeGreaterThanOrEqual(0);
          expect(cell.x).toBeLessThan(preset.gridWidth);
          expect(cell.y).toBeGreaterThanOrEqual(0);
          expect(cell.y).toBeLessThan(preset.gridHeight);
        }
      }

      // Verify element coordinates are within grid bounds
      for (const elem of preset.elements) {
        expect(elem.x).toBeGreaterThanOrEqual(0);
        expect(elem.x + elem.width).toBeLessThanOrEqual(preset.gridWidth);
        expect(elem.y).toBeGreaterThanOrEqual(0);
        expect(elem.y + elem.height).toBeLessThanOrEqual(preset.gridHeight);
      }
    }
  });

  it("should retrieve presets by biome or ID", () => {
    const temple = getPresetByBiome("temple");
    expect(temple).toBeDefined();
    expect(temple?.nameEn).toBe("Ancient Temple");

    const lava = getPresetById("preset-lava-cave");
    expect(lava).toBeDefined();
    expect(lava?.biome).toBe("lava_cave");
    // Lava cave must contain lava elements
    const lavaHazards = lava!.elements.filter((e) => e.type === "lava");
    expect(lavaHazards.length).toBeGreaterThan(0);
  });
});
