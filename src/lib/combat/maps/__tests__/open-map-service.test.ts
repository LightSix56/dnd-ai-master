import { describe, it, expect } from "vitest";
import {
  searchOpenMaps,
  getOpenMapById,
  getPopularTags,
  resolveBattlemapForNarrative,
  OPEN_BATTLEMAP_CATALOG,
} from "../open-map-service";

describe("Open Map Service", () => {
  it("has a rich catalog of open battlemaps with valid metadata", () => {
    expect(OPEN_BATTLEMAP_CATALOG.length).toBeGreaterThanOrEqual(15);
    for (const map of OPEN_BATTLEMAP_CATALOG) {
      expect(map.id).toBeTruthy();
      expect(map.name).toBeTruthy();
      expect(map.imageUrl).toBeTruthy();
      expect(map.gridWidth).toBeGreaterThanOrEqual(10);
      expect(map.gridHeight).toBeGreaterThanOrEqual(10);
      expect(map.tags.length).toBeGreaterThan(0);
      expect(map.license).toBeTruthy();
    }
  });

  it("searches maps by text query across name, description, and tags", () => {
    const results = searchOpenMaps({ query: "крипта" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((m) => m.name.toLowerCase().includes("крипт") || m.tags.includes("crypt"))).toBe(true);
  });

  it("filters maps by tag array", () => {
    const results = searchOpenMaps({ tags: ["forest"] });
    expect(results.length).toBeGreaterThan(0);
    for (const m of results) {
      expect(m.tags).toContain("forest");
    }
  });

  it("filters maps by biome category", () => {
    const results = searchOpenMaps({ category: "dungeon_cave" });
    expect(results.length).toBeGreaterThan(0);
    for (const m of results) {
      const b = m.biome.toLowerCase();
      expect(
        b.includes("dungeon") || b.includes("cave") || b.includes("crypt") || b.includes("underdark")
      ).toBe(true);
    }
  });

  it("retrieves a specific open map by its ID", () => {
    const first = OPEN_BATTLEMAP_CATALOG[0];
    const found = getOpenMapById(first.id);
    expect(found).toBeDefined();
    expect(found?.id).toBe(first.id);
  });

  it("returns popular tags for quick tag filtering", () => {
    const tags = getPopularTags();
    expect(tags.length).toBeGreaterThanOrEqual(8);
    expect(tags.some((t) => t.tag === "dungeon" || t.tag === "forest")).toBe(true);
  });

  it("resolves battlemap for narrative keywords with automatic fallback", () => {
    const resolved = resolveBattlemapForNarrative("Герои входят в древнюю затопленную крипту");
    expect(resolved).toBeDefined();
    expect(resolved.imageUrl).toBeTruthy();
    expect(resolved.gridWidth).toBeGreaterThan(0);
  });
});
