import { describe, it, expect } from "vitest";
import { GENERATORS } from "../index";
import { classifyLayout } from "../classify";
import type { ProcgenBiome } from "../layout";

// Карты v=1 уже сохраняются в боях: разметка лежит в базе, а картинку браузер собирает
// заново по зерну. Если тест упал — генератор биома изменился, и старые бои нарисуются не
// так, как размечены. Тогда увеличьте VERSION в index.ts и сохраните старую ветку генератора.

function fnv1a(bytes: Uint8Array, hash = 0x811c9dc5): number {
  for (const b of bytes) hash = Math.imul(hash ^ b, 0x01000193) >>> 0;
  return hash;
}

function fingerprint(biome: ProcgenBiome, seed: number): string {
  const layout = GENERATORS[biome]!(seed);
  let h = fnv1a(new Uint8Array(layout.ground.data.buffer));
  h = fnv1a(new Uint8Array(layout.liquid.data.buffer), h);
  h = fnv1a(new TextEncoder().encode(JSON.stringify(layout.decor)), h);
  h = fnv1a(new TextEncoder().encode(classifyLayout(layout).flat().join(",")), h);
  return h.toString(16);
}

const GOLDEN: Partial<Record<ProcgenBiome, Record<number, string>>> = {
  lava: { 1: "3d539f7e", 42: "31311bcd", [-7]: "6c0980b1" },
};

describe.each(Object.entries(GOLDEN) as [ProcgenBiome, Record<number, string>][])("procgen v=1: %s не меняется", (biome, seeds) => {
  it.each(Object.entries(seeds))("зерно %s", (seed, expected) => {
    expect(fingerprint(biome, Number(seed))).toBe(expected);
  });
});
