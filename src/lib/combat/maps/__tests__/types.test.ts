import { describe, it, expect } from "vitest";
import type { MapElement, MapElementType } from "../types";
import type {
  UniversalVTT,
  TacticalMapPreset,
  SpawnZoneDefinition,
  MapTagQuery,
  BiomeType,
} from "../types";

describe("Tactical Map Types", () => {
  it("should validate MapElementType including elevation, lava, water, cover", () => {
    const validTypes: MapElementType[] = [
      "wall",
      "door",
      "window",
      "obstacle",
      "cover",
      "difficult",
      "water",
      "lava",
      "elevation",
    ];
    expect(validTypes).toHaveLength(9);
  });

  it("should correctly structure TacticalMapPreset with spawn zones", () => {
    const preset: TacticalMapPreset = {
      id: "preset-test-1",
      name: "Тестовая карта",
      nameEn: "Test Map",
      biome: "temple",
      tags: ["temple", "holy", "columns"],
      gridWidth: 20,
      gridHeight: 15,
      cellSizeFt: 5,
      elements: [
        {
          id: "elem-1",
          type: "cover",
          x: 5,
          y: 5,
          width: 1,
          height: 1,
          properties: { coverBonus: 2, label: "Колонна" },
        },
      ],
      spawnZones: [
        {
          name: "party",
          cells: [
            { x: 1, y: 1 },
            { x: 2, y: 1 },
          ],
        },
        {
          name: "boss",
          cells: [{ x: 10, y: 13 }],
        },
      ],
    };

    expect(preset.id).toBe("preset-test-1");
    expect(preset.spawnZones).toHaveLength(2);
    expect(preset.elements[0].properties.coverBonus).toBe(2);
  });

  it("should validate MapTagQuery structure", () => {
    const query: MapTagQuery = {
      tags: ["cave", "lava"],
      biome: "lava_cave",
      indoor: true,
      hazards: ["lava"],
    };
    expect(query.tags).toContain("lava");
    expect(query.biome).toBe("lava_cave");
  });
});
