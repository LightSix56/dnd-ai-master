import { describe, it, expect } from "vitest";
import { generateCaveLayout } from "../cave";
import { classifyCells } from "../markup";

// Карты v=1 уже сохранены в боях: разметка лежит в базе, а арт браузер пересобирает по
// зерну. Если этот тест упал — генератор изменился, и старые бои нарисуются не так, как
// размечены. Тогда увеличьте VERSION в index.ts и сохраните старую ветку генератора.

function fnv1a(bytes: Uint8Array, hash = 0x811c9dc5): number {
  for (const b of bytes) hash = Math.imul(hash ^ b, 0x01000193) >>> 0;
  return hash;
}

function fingerprint(seed: number): string {
  const layout = generateCaveLayout(seed);
  let h = fnv1a(new Uint8Array(layout.floor.data.buffer));
  h = fnv1a(new Uint8Array(layout.water.data.buffer), h);
  h = fnv1a(new TextEncoder().encode(JSON.stringify(layout.decor)), h);
  h = fnv1a(new TextEncoder().encode(classifyCells(layout).flat().join(",")), h);
  return h.toString(16);
}

describe("procgen v=1 не меняется", () => {
  it.each([
    [1, "7b219fb"],
    [42, "69c640ee"],
    [-7, "fc1adc17"],
  ])("зерно %i", (seed, expected) => {
    expect(fingerprint(seed)).toBe(expected);
  });
});
