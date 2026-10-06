import { describe, it, expect } from "vitest";
import { layoutForUrl, generateProcgenMap } from "../index";
import { PROCGEN_BIOMES } from "../biomes";

describe("layoutForUrl", () => {
  it("по ссылке карты собирается план того же биома и зерна", () => {
    for (const biome of PROCGEN_BIOMES) {
      const map = generateProcgenMap(biome, 3);
      const layout = layoutForUrl(map.backgroundUrl!);
      expect(layout?.biome, biome).toBe(biome);
      expect(layout?.width).toBe(24);
    }
  });

  it("битая ссылка — null", () => {
    expect(layoutForUrl("procgen:volcano?seed=1&v=1")).toBeNull();
    expect(layoutForUrl("/maps/x.jpg")).toBeNull();
  });
});
