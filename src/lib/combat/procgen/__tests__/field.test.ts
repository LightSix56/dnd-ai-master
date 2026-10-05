import { describe, it, expect } from "vitest";
import { createRng } from "../rng";
import { Field, valueNoise, blurField } from "../field";

describe("createRng", () => {
  it("одно зерно даёт одну последовательность", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
    seqA.forEach((v) => expect(v >= 0 && v < 1).toBe(true));
  });

  it("разные зёрна дают разные последовательности", () => {
    expect(createRng(42).next()).not.toBe(createRng(43).next());
  });

  it("int(min, max) включает обе границы и ничего за ними", () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
});

describe("valueNoise", () => {
  it("детерминирован и лежит в [0, 1]", () => {
    const a = valueNoise(createRng(5), 64, 48, 6, 3);
    const b = valueNoise(createRng(5), 64, 48, 6, 3);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
    for (const v of a.data) expect(v >= 0 && v <= 1).toBe(true);
  });
});

describe("blurField", () => {
  it("сохраняет сумму и уменьшает пик", () => {
    const f = new Field(41, 41, 0);
    f.set(20, 20, 1);
    const b = blurField(f, 3);
    const sum = b.data.reduce((s, v) => s + v, 0);
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThan(1.01);
    expect(Math.max(...b.data)).toBeLessThan(1);
  });
});
