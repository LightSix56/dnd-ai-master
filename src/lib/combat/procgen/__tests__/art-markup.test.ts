import { describe, it, expect } from "vitest";
import { GENERATORS } from "../index";
import { classifyLayout } from "../classify";
import { DECOR_CELL } from "../biomes";
import type { ProcgenBiome } from "../layout";

const RANK: Record<string, number> = { floor: 0, difficult: 1, cover: 2, obstacle: 3 };

describe("нарисованные объекты размечены", () => {
  it.each(Object.keys(GENERATORS) as ProcgenBiome[])("%s: на 100 зёрнах каждый объект виден в разметке", (biome) => {
    for (let seed = 1; seed <= 100; seed++) {
      const layout = GENERATORS[biome]!(seed);
      const cells = classifyLayout(layout);
      for (const d of layout.decor) {
        const kind = DECOR_CELL[d.kind];
        if (!kind) continue;
        const x0 = Math.floor(d.x);
        const y0 = Math.floor(d.y);
        for (let y = y0; y < y0 + (d.h ?? 1); y++) {
          for (let x = x0; x < x0 + (d.w ?? 1); x++) {
            const got = cells[y]?.[x];
            if (got === undefined || got === "wall" || got === "water" || got === "lava") continue;
            expect(RANK[got], `${biome} seed ${seed}: ${d.kind} в (${x}, ${y}) размечен как ${got}`).toBeGreaterThanOrEqual(RANK[kind]);
          }
        }
      }
    }
  }, 120000);
});
