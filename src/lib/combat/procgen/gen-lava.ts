// Лавовая пещера: тот же план пещеры, но вместо подземных луж — озёра лавы.
// Здесь же — перевод плана пещеры в общий план карты (для рисовальщика и лавы).

import { generateCaveLayout, type CaveLayout } from "./cave";
import { Field, SUB, blurField, valueNoise } from "./field";
import { createRng } from "./rng";
import type { ProcgenBiome, ProcgenLayout } from "./layout";

export function caveToLayout(cave: CaveLayout, biome: ProcgenBiome = "cave"): ProcgenLayout {
  return {
    biome,
    seed: cave.seed,
    width: cave.width,
    height: cave.height,
    ground: cave.floor,
    liquid: cave.water,
    decor: cave.decor,
    areas: cave.chambers,
    flankAreas: cave.niches,
    paths: cave.passages.map((p) => p.points),
    structures: [],
  };
}

/** Озеро лавы в зале: эллипс с рваным краем, только там, где есть пол */
function lavaPool(cave: CaveLayout): Field {
  const rng = createRng((cave.seed ^ 0x51ed270b) >>> 0);
  const host = cave.chambers[rng.int(1, cave.chambers.length - 1)];
  const cx = host.cx + (rng.next() - 0.5) * 0.8 * host.rx;
  const cy = host.cy + (rng.next() - 0.5) * 0.8 * host.ry;
  const rx = 0.9 + rng.next() * 0.6;
  const ry = 0.9 + rng.next() * 0.6;
  const noise = valueNoise(rng, cave.floor.w, cave.floor.h, 12, 2);
  const pool = new Field(cave.floor.w, cave.floor.h);
  for (let y = 0; y < pool.h; y++) {
    for (let x = 0; x < pool.w; x++) {
      const d = Math.hypot(((x + 0.5) / SUB - cx) / rx, ((y + 0.5) / SUB - cy) / ry);
      if (d + (noise.get(x, y) - 0.5) * 0.4 < 1 && cave.floor.get(x, y) > 0.5) pool.set(x, y, 1);
    }
  }
  return blurField(pool, 1);
}

export function generateLavaLayout(seed: number): ProcgenLayout {
  const cave = generateCaveLayout(seed);
  const hasLiquid = cave.water.data.some((v) => v > 0.5);
  const layout = caveToLayout(cave, "lava");
  return hasLiquid ? layout : { ...layout, liquid: lavaPool(cave) };
}
