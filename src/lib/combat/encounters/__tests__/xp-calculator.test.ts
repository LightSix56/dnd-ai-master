import { describe, it, expect } from "vitest";
import {
  XP_THRESHOLDS_BY_LEVEL,
  calculatePartyXPBudget,
  getMonsterCountMultiplier,
  calculateAdjustedXP,
  calculateAwardedXP,
} from "../xp-calculator";
import type { PartyMember, EncounterDifficulty } from "../types";

describe("XP_THRESHOLDS_BY_LEVEL", () => {
  it("contains all 20 levels with correct DMG p. 82 values", () => {
    expect(XP_THRESHOLDS_BY_LEVEL[1]).toEqual({ easy: 25, medium: 50, hard: 75, deadly: 100 });
    expect(XP_THRESHOLDS_BY_LEVEL[2]).toEqual({ easy: 50, medium: 100, hard: 150, deadly: 200 });
    expect(XP_THRESHOLDS_BY_LEVEL[3]).toEqual({ easy: 75, medium: 150, hard: 225, deadly: 400 });
    expect(XP_THRESHOLDS_BY_LEVEL[4]).toEqual({ easy: 125, medium: 250, hard: 375, deadly: 500 });
    expect(XP_THRESHOLDS_BY_LEVEL[5]).toEqual({ easy: 250, medium: 500, hard: 750, deadly: 1100 });
    expect(XP_THRESHOLDS_BY_LEVEL[6]).toEqual({ easy: 300, medium: 600, hard: 900, deadly: 1400 });
    expect(XP_THRESHOLDS_BY_LEVEL[7]).toEqual({ easy: 350, medium: 750, hard: 1100, deadly: 1700 });
    expect(XP_THRESHOLDS_BY_LEVEL[8]).toEqual({ easy: 450, medium: 900, hard: 1400, deadly: 2100 });
    expect(XP_THRESHOLDS_BY_LEVEL[9]).toEqual({ easy: 550, medium: 1100, hard: 1600, deadly: 2400 });
    expect(XP_THRESHOLDS_BY_LEVEL[10]).toEqual({ easy: 600, medium: 1200, hard: 1900, deadly: 2800 });
    expect(XP_THRESHOLDS_BY_LEVEL[11]).toEqual({ easy: 800, medium: 1600, hard: 2400, deadly: 3600 });
    expect(XP_THRESHOLDS_BY_LEVEL[12]).toEqual({ easy: 1000, medium: 2000, hard: 3000, deadly: 4500 });
    expect(XP_THRESHOLDS_BY_LEVEL[13]).toEqual({ easy: 1100, medium: 2200, hard: 3400, deadly: 5100 });
    expect(XP_THRESHOLDS_BY_LEVEL[14]).toEqual({ easy: 1250, medium: 2500, hard: 3800, deadly: 5700 });
    expect(XP_THRESHOLDS_BY_LEVEL[15]).toEqual({ easy: 1400, medium: 2800, hard: 4300, deadly: 6400 });
    expect(XP_THRESHOLDS_BY_LEVEL[16]).toEqual({ easy: 1600, medium: 3200, hard: 4800, deadly: 7200 });
    expect(XP_THRESHOLDS_BY_LEVEL[17]).toEqual({ easy: 2000, medium: 3900, hard: 5900, deadly: 8800 });
    expect(XP_THRESHOLDS_BY_LEVEL[18]).toEqual({ easy: 2100, medium: 4200, hard: 6300, deadly: 9500 });
    expect(XP_THRESHOLDS_BY_LEVEL[19]).toEqual({ easy: 2400, medium: 4900, hard: 7300, deadly: 10900 });
    expect(XP_THRESHOLDS_BY_LEVEL[20]).toEqual({ easy: 2800, medium: 5700, hard: 8500, deadly: 12700 });
  });
});

describe("calculatePartyXPBudget", () => {
  it("returns 0 for an empty party", () => {
    expect(calculatePartyXPBudget([], "medium")).toBe(0);
  });

  it("calculates budget for a single level 1 character", () => {
    const party: PartyMember[] = [{ id: "1", name: "Fighter", level: 1 }];
    expect(calculatePartyXPBudget(party, "easy")).toBe(25);
    expect(calculatePartyXPBudget(party, "medium")).toBe(50);
    expect(calculatePartyXPBudget(party, "hard")).toBe(75);
    expect(calculatePartyXPBudget(party, "deadly")).toBe(100);
  });

  it("calculates budget for a standard party of 4 level 5 characters", () => {
    const party: PartyMember[] = [
      { id: "1", name: "A", level: 5 },
      { id: "2", name: "B", level: 5 },
      { id: "3", name: "C", level: 5 },
      { id: "4", name: "D", level: 5 },
    ];
    expect(calculatePartyXPBudget(party, "easy")).toBe(1000);
    expect(calculatePartyXPBudget(party, "medium")).toBe(2000);
    expect(calculatePartyXPBudget(party, "hard")).toBe(3000);
    expect(calculatePartyXPBudget(party, "deadly")).toBe(4400);
  });

  it("calculates budget for mixed levels", () => {
    const party: PartyMember[] = [
      { id: "1", name: "A", level: 1 },
      { id: "2", name: "B", level: 3 },
      { id: "3", name: "C", level: 5 },
    ];
    // level 1 medium (50) + level 3 medium (150) + level 5 medium (500) = 700
    expect(calculatePartyXPBudget(party, "medium")).toBe(700);
  });

  it("clamps levels below 1 to 1 and above 20 to 20", () => {
    const party: PartyMember[] = [
      { id: "1", name: "Underlevel", level: 0 },
      { id: "2", name: "Negative", level: -5 },
      { id: "3", name: "Epic", level: 25 },
    ];
    // clamped: level 1 (50) + level 1 (50) + level 20 (5700) = 5800
    expect(calculatePartyXPBudget(party, "medium")).toBe(5800);
  });
});

describe("getMonsterCountMultiplier", () => {
  it("returns 1.0 when monsterCount <= 0 regardless of party size", () => {
    expect(getMonsterCountMultiplier(0, 4)).toBe(1.0);
    expect(getMonsterCountMultiplier(-1, 1)).toBe(1.0);
    expect(getMonsterCountMultiplier(0, 7)).toBe(1.0);
  });

  describe("standard party size (3 to 5)", () => {
    it.each([
      [1, 1.0],
      [2, 1.5],
      [3, 2.0],
      [4, 2.0],
      [6, 2.0],
      [7, 2.5],
      [10, 2.5],
      [11, 3.0],
      [14, 3.0],
      [15, 4.0],
      [20, 4.0],
    ])("returns multiplier %f for %i monsters with partySize 4", (count: number, expected: number) => {
      expect(getMonsterCountMultiplier(count, 4)).toBe(expected);
    });

    it("verifies party sizes 3 and 5 use standard multipliers", () => {
      expect(getMonsterCountMultiplier(2, 3)).toBe(1.5);
      expect(getMonsterCountMultiplier(2, 5)).toBe(1.5);
    });
  });

  describe("small party size (< 3) - shifts 1 tier higher", () => {
    it.each([
      [1, 1.5],
      [2, 2.0],
      [3, 2.5],
      [6, 2.5],
      [7, 3.0],
      [10, 3.0],
      [11, 4.0],
      [14, 4.0],
      [15, 5.0],
      [25, 5.0],
    ])("returns shifted up multiplier %f for %i monsters with partySize 2", (count: number, expected: number) => {
      expect(getMonsterCountMultiplier(count, 2)).toBe(expected);
      expect(getMonsterCountMultiplier(count, 1)).toBe(expected);
    });
  });

  describe("large party size (>= 6) - shifts 1 tier lower", () => {
    it.each([
      [1, 0.5],
      [2, 1.0],
      [3, 1.5],
      [6, 1.5],
      [7, 2.0],
      [10, 2.0],
      [11, 2.5],
      [14, 2.5],
      [15, 3.0],
      [30, 3.0],
    ])("returns shifted down multiplier %f for %i monsters with partySize 6", (count: number, expected: number) => {
      expect(getMonsterCountMultiplier(count, 6)).toBe(expected);
      expect(getMonsterCountMultiplier(count, 8)).toBe(expected);
    });
  });
});

describe("calculateAdjustedXP", () => {
  it("returns 0 for empty monsters list", () => {
    expect(calculateAdjustedXP([], 4)).toBe(0);
  });

  it("calculates adjusted XP for a single monster with standard party", () => {
    expect(calculateAdjustedXP([100], 4)).toBe(100);
  });

  it("calculates adjusted XP for multiple monsters", () => {
    // 2 monsters = 1.5x multiplier: (100 + 200) * 1.5 = 450
    expect(calculateAdjustedXP([100, 200], 4)).toBe(450);
  });

  it("calculates adjusted XP with small party adjustment", () => {
    // 3 monsters with party size 2: multiplier 2.5x: 300 * 2.5 = 750
    expect(calculateAdjustedXP([100, 100, 100], 2)).toBe(750);
  });

  it("calculates adjusted XP with large party adjustment", () => {
    // 1 monster with party size 6: multiplier 0.5x: 50 * 0.5 = 25
    expect(calculateAdjustedXP([50], 6)).toBe(25);
  });

  it("properly rounds to integer", () => {
    // 45 * 1.5 = 67.5 -> 68
    expect(calculateAdjustedXP([20, 25], 4)).toBe(68);
  });
});

describe("calculateAwardedXP", () => {
  it("returns 0 total and 0 per player for empty monster list", () => {
    expect(calculateAwardedXP([], 4)).toEqual({ totalXP: 0, xpPerPlayer: 0 });
  });

  it("sums monsters XP and divides evenly among players (floored)", () => {
    expect(calculateAwardedXP([100, 200, 300], 4)).toEqual({
      totalXP: 600,
      xpPerPlayer: 150,
    });
    expect(calculateAwardedXP([100], 3)).toEqual({
      totalXP: 100,
      xpPerPlayer: 33,
    });
  });

  it("guards against partySize <= 0 by defaulting to 1", () => {
    expect(calculateAwardedXP([100], 0)).toEqual({
      totalXP: 100,
      xpPerPlayer: 100,
    });
    expect(calculateAwardedXP([100], -2)).toEqual({
      totalXP: 100,
      xpPerPlayer: 100,
    });
  });
});
