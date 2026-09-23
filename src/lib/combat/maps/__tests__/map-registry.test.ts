import { describe, it, expect, beforeEach } from "vitest";
import { MapRegistry } from "../map-registry";
import type { TacticalMapPreset } from "../types";

describe("Map Registry & Lazy Loading (map-registry)", () => {
  let registry: MapRegistry;

  beforeEach(() => {
    registry = new MapRegistry();
  });

  it("should match maps by tags with ranking", () => {
    const results = registry.search({
      tags: ["cave", "lava"],
    });

    expect(results.length).toBeGreaterThan(0);
    // The top result should have lava / cave tags
    expect(results[0].tags).toContain("lava");
    expect(results[0].biome).toBe("lava_cave");
  });

  it("should filter maps by biome and indoor criteria", () => {
    const outdoorResults = registry.search({
      tags: ["ship"],
      indoor: false,
    });
    expect(outdoorResults.length).toBeGreaterThan(0);
    expect(outdoorResults[0].biome).toBe("ship_battle");

    const templeResults = registry.search({
      biome: "temple",
    });
    expect(templeResults.length).toBeGreaterThan(0);
    expect(templeResults[0].biome).toBe("temple");
  });

  it("should allow registering and retrieving custom presets in cache", () => {
    const customPreset: TacticalMapPreset = {
      id: "custom-arena-99",
      name: "Кастомная Арена",
      nameEn: "Custom Arena",
      biome: "gladiator_arena",
      tags: ["arena", "blood", "sand"],
      gridWidth: 15,
      gridHeight: 15,
      cellSizeFt: 5,
      elements: [],
      spawnZones: [{ name: "party", cells: [{ x: 0, y: 0 }] }],
    };

    registry.registerPreset(customPreset);

    const retrieved = registry.getPreset("custom-arena-99");
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe("Кастомная Арена");
  });

  it("should return null for non-existent preset", () => {
    const result = registry.getPreset("non-existent-id-404");
    expect(result).toBeNull();
  });
});
