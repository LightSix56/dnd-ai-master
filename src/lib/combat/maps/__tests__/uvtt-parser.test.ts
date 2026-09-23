import { describe, it, expect } from "vitest";
import { parseUniversalVTT } from "../uvtt-parser";
import type { UniversalVTT } from "../types";

describe("Universal VTT Parser (uvtt-parser)", () => {
  it("should parse a valid Universal VTT JSON into a TacticalMapPreset", () => {
    const mockUvtt: UniversalVTT = {
      format: 0.2,
      resolution: {
        map_origin: { x: 0, y: 0 },
        map_size: { x: 10, y: 10 },
        pixels_per_grid: 100,
      },
      line_of_sight: [
        // Horizontal wall from (2, 2) to (5, 2)
        [
          { x: 2, y: 2 },
          { x: 5, y: 2 },
        ],
      ],
      portals: [
        {
          position: { x: 3, y: 2 },
          bounds: [
            { x: 3, y: 2 },
            { x: 4, y: 2 },
          ],
          closed: true,
        },
      ],
      objects_line_of_sight: [
        [
          { x: 7.2, y: 7.2 },
          { x: 7.8, y: 7.8 },
        ],
      ],
    };

    const preset = parseUniversalVTT(mockUvtt, {
      id: "test-vtt-1",
      name: "Подземелье испытаний",
      nameEn: "Dungeon of Trials",
      biome: "dungeon_prison",
      tags: ["dungeon", "prison", "stone"],
    });

    expect(preset.id).toBe("test-vtt-1");
    expect(preset.gridWidth).toBe(10);
    expect(preset.gridHeight).toBe(10);
    expect(preset.cellSizeFt).toBe(5);

    // Should have walls
    const walls = preset.elements.filter((e) => e.type === "wall");
    expect(walls.length).toBeGreaterThan(0);

    // Should have a door at (3, 2) and replace wall there
    const doors = preset.elements.filter((e) => e.type === "door");
    expect(doors).toHaveLength(1);
    expect(doors[0].x).toBe(3);
    expect(doors[0].y).toBe(2);
    expect(doors[0].properties.isOpen).toBe(false);

    // Door cell should NOT also have a wall
    const wallAtDoor = walls.find((w) => w.x === 3 && w.y === 2);
    expect(wallAtDoor).toBeUndefined();

    // Should have cover from objects_line_of_sight
    const covers = preset.elements.filter((e) => e.type === "cover");
    expect(covers.length).toBeGreaterThan(0);
    expect(covers[0].properties.coverBonus).toBe(2);

    // Should generate automatic spawn zones
    expect(preset.spawnZones.length).toBeGreaterThan(0);
    const partyZone = preset.spawnZones.find((z) => z.name === "party");
    expect(partyZone).toBeDefined();
    expect(partyZone!.cells.length).toBeGreaterThan(0);
  });

  it("should parse stringified JSON input", () => {
    const rawJson = JSON.stringify({
      format: 0.2,
      resolution: {
        map_origin: { x: 0, y: 0 },
        map_size: { x: 8, y: 8 },
        pixels_per_grid: 70,
      },
      line_of_sight: [],
    });

    const preset = parseUniversalVTT(rawJson, {
      id: "json-str-1",
      name: "Комната",
      nameEn: "Room",
      biome: "tavern",
    });

    expect(preset.gridWidth).toBe(8);
    expect(preset.gridHeight).toBe(8);
  });

  it("should throw EngineError on invalid JSON or missing dimensions", () => {
    expect(() => parseUniversalVTT("invalid json {", { id: "err-1", name: "Err", nameEn: "Err", biome: "tavern" })).toThrow();
    expect(() => parseUniversalVTT({} as any, { id: "err-2", name: "Err", nameEn: "Err", biome: "tavern" })).toThrow();
    expect(() =>
      parseUniversalVTT(
        {
          format: 0.2,
          resolution: { map_size: { x: 0, y: -5 }, map_origin: { x: 0, y: 0 }, pixels_per_grid: 70 },
          line_of_sight: [],
        },
        { id: "err-3", name: "Err", nameEn: "Err", biome: "tavern" }
      )
    ).toThrow();
  });
});
