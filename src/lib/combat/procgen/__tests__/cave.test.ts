import { describe, it, expect } from "vitest";
import { generateCaveLayout, type CaveLayout } from "../cave";
import { SUB } from "../field";

function cellFloor(layout: CaveLayout, cx: number, cy: number): number {
  let sum = 0;
  for (let y = cy * SUB; y < (cy + 1) * SUB; y++) {
    for (let x = cx * SUB; x < (cx + 1) * SUB; x++) sum += layout.floor.get(x, y);
  }
  return sum / (SUB * SUB);
}

const fingerprint = (l: CaveLayout) =>
  JSON.stringify({ c: l.chambers, p: l.passages, n: l.niches, d: l.decor, f: l.floor.data.reduce((s, v) => s + v, 0) });

describe("generateCaveLayout", () => {
  it("одно зерно — один план", () => {
    expect(fingerprint(generateCaveLayout(11))).toBe(fingerprint(generateCaveLayout(11)));
  });

  it("разные зёрна — разные залы", () => {
    expect(JSON.stringify(generateCaveLayout(11).chambers)).not.toBe(JSON.stringify(generateCaveLayout(12).chambers));
  });

  it("2–4 зала, поля нужного размера", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const l = generateCaveLayout(seed);
      expect(l.chambers.length).toBeGreaterThanOrEqual(2);
      expect(l.chambers.length).toBeLessThanOrEqual(4);
      expect([l.floor.w, l.floor.h]).toEqual([24 * SUB, 16 * SUB]);
      expect([l.water.w, l.water.h]).toEqual([24 * SUB, 16 * SUB]);
    }
  });

  it("по краю карты — скала", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const l = generateCaveLayout(seed);
      for (let x = 0; x < 24; x++) {
        expect(cellFloor(l, x, 0)).toBeLessThan(0.5);
        expect(cellFloor(l, x, 15)).toBeLessThan(0.5);
      }
      for (let y = 0; y < 16; y++) {
        expect(cellFloor(l, 0, y)).toBeLessThan(0.5);
        expect(cellFloor(l, 23, y)).toBeLessThan(0.5);
      }
    }
  });

  it("крайние зёрна не ломают генератор", () => {
    for (const seed of [-5, 2 ** 31, 0]) expect(() => generateCaveLayout(seed)).not.toThrow();
  });
});
