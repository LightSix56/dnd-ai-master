import { describe, it, expect } from "vitest";
import { rollInitiativeFor, rollInitiativeForAll, sortByInitiative } from "../initiative";
import { CombatState, rollInitiative } from "../engine";

describe("Combat Initiative Engine Robustness", () => {
  it("rolls valid integer initiative with standard dexMod", () => {
    const init = rollInitiativeFor({ dexMod: 3 });
    expect(Number.isInteger(init)).toBe(true);
    expect(init).toBeGreaterThanOrEqual(4); // 1 + 3
    expect(init).toBeLessThanOrEqual(23); // 20 + 3
  });

  it("handles null, undefined, and NaN dexMod without returning NaN", () => {
    const initNull = rollInitiativeFor({ dexMod: null as any });
    const initUndef = rollInitiativeFor({ dexMod: undefined as any });
    const initNaN = rollInitiativeFor({ dexMod: NaN });

    expect(Number.isInteger(initNull)).toBe(true);
    expect(Number.isInteger(initUndef)).toBe(true);
    expect(Number.isInteger(initNaN)).toBe(true);
    expect(isNaN(initNull)).toBe(false);
    expect(isNaN(initUndef)).toBe(false);
    expect(isNaN(initNaN)).toBe(false);
  });

  it("sorts cleanly even if combatants have NaN or missing initiative values", () => {
    const combatants = [
      { id: "c1", initiative: NaN, dexMod: 2, initiativeTiebreak: 10 },
      { id: "c2", initiative: 18, dexMod: 1, initiativeTiebreak: 20 },
      { id: "c3", initiative: 18, dexMod: 3, initiativeTiebreak: 15 },
      { id: "c4", initiative: (null as any), dexMod: (undefined as any), initiativeTiebreak: 0 },
    ];

    const sorted = sortByInitiative(combatants);
    expect(sorted.map((c) => c.id)).toEqual(["c3", "c2", "c1", "c4"]);
  });

  it("handles empty combatants state without crashing in rollInitiative", () => {
    const state = new CombatState({
      id: "combat-empty",
      name: "Empty Battle",
      status: "active",
      round: 1,
      currentTurnIndex: 0,
      turnOrder: [],
      gridWidth: 20,
      gridHeight: 20,
      cellSize: 40,
      backgroundUrl: undefined,
      combatants: [],
      mapElements: [],
      log: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    expect(() => rollInitiative(state)).not.toThrow();
    expect(state.turnOrder).toEqual([]);
    expect(state.currentTurnIndex).toBe(0);
  });
});
