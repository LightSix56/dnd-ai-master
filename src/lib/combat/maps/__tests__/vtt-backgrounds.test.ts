import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { ALL_PRESETS } from "../presets";
import { parseUniversalVTT } from "../uvtt-parser";

describe("VTT Battlemaps & Background Artwork Verification", () => {
  it("every preset in ALL_PRESETS has a backgroundUrl pointing to an existing file in public/maps", () => {
    expect(ALL_PRESETS.length).toBeGreaterThanOrEqual(24);

    for (const preset of ALL_PRESETS) {
      expect(preset.backgroundUrl, `Preset ${preset.id} (${preset.name}) must have a backgroundUrl`).toBeDefined();
      expect(preset.backgroundUrl!.length).toBeGreaterThan(0);

      // Verify file exists on disk
      const relativePath = preset.backgroundUrl!.replace(/^\//, "");
      const fullPath = path.resolve(process.cwd(), "public", relativePath);
      expect(
        fs.existsSync(fullPath),
        `Background file '${preset.backgroundUrl}' for preset ${preset.id} must exist on disk at ${fullPath}`
      ).toBe(true);
    }
  });

  it("parseUniversalVTT extracts embedded base64 image as backgroundUrl", () => {
    const mockUVTT = {
      format: 0.2,
      resolution: {
        map_origin: { x: 0, y: 0 },
        map_size: { x: 10, y: 10 },
        pixels_per_grid: 64,
      },
      line_of_sight: [
        [{ x: 0, y: 0 }, { x: 10, y: 0 }]
      ],
      image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    };

    const preset = parseUniversalVTT(mockUVTT as any, {
      id: "test-uvtt",
      name: "Тестовая карта",
      nameEn: "Test Map",
      biome: "dungeon_prison",
    });

    expect(preset.backgroundUrl).toBeDefined();
    expect(preset.backgroundUrl).toContain("data:image/png;base64,");
    expect(preset.gridWidth).toBe(10);
    expect(preset.gridHeight).toBe(10);
    expect(preset.elements.length).toBeGreaterThan(0);
  });
});
