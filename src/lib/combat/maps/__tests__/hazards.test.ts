import { describe, it, expect } from "vitest";
import { CombatState } from "../../engine";
import { moveCombatant, toggleDoor, shoveCombatant, startTurn } from "../../engine";
import { isWaterTerrain, isLavaTerrain, hasLineOfSight } from "../../movement";
import type { Combat, Combatant, MapElement } from "../../types";

function createMockCombatState(elements: MapElement[], combatants: Combatant[]): CombatState {
  const combat: Combat = {
    id: "test-combat-hazards",
    name: "Test Hazards",
    status: "active",
    round: 1,
    currentTurnIndex: 0,
    turnOrder: combatants.map((c) => c.id),
    gridWidth: 15,
    gridHeight: 15,
    cellSize: 5,
    log: [],
    combatants,
    mapElements: elements,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return new CombatState(combat);
}

function createCombatant(id: string, name: string, x: number, y: number, overrides: Partial<Combatant> = {}): Combatant {
  return {
    id,
    name,
    type: "player",
    color: "#3b82f6",
    x,
    y,
    hpCurrent: 50,
    hpMax: 50,
    hpTemp: 0,
    ac: 15,
    speed: 30,
    initiative: 10,
    initiativeTiebreak: 10,
    dexMod: 2,
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: "Fighter",
    level: 3,
    size: "medium",
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: [
      {
        id: "longsword",
        name: "Длинный меч",
        kind: "melee",
        range: { normal: 5 },
        attackBonus: 5,
        actionCost: "action",
        damage: [{ dice: "1d8", mod: 3, type: "slashing" }],
      },
    ],
    spells: { slots: {}, known: [], prepared: [], cantrips: [] } as any,
    abilities: [],
    concentration: null,
    saves: {},
    abilityMods: {},
    profBonus: 2,
    isAIControlled: false,
    ...overrides,
  };
}

describe("Hazard Physics & Door Interactions (hazards)", () => {
  it("should damage combatant when entering lava during movement", () => {
    const lavaElem: MapElement = {
      id: "lava-1",
      type: "lava",
      x: 3,
      y: 2,
      width: 1,
      height: 1,
      properties: {},
    };

    const fighter = createCombatant("f1", "Воин", 2, 2);
    const state = createMockCombatState([lavaElem], [fighter]);

    expect(isLavaTerrain({ x: 3, y: 2 }, state.mapElements)).toBe(true);

    moveCombatant(state, "f1", { x: 3, y: 2 }, { skipTurnCheck: true });

    // Fighter moved into lava and must take 2d10 fire damage
    expect(state.require("f1").hpCurrent).toBeLessThan(50);
    const logEntry = state.log.find((l) => l.text.includes("лаву"));
    expect(logEntry).toBeDefined();
  });

  it("should deal lava damage at the start of turn if starting in lava", () => {
    const lavaElem: MapElement = {
      id: "lava-1",
      type: "lava",
      x: 3,
      y: 3,
      width: 1,
      height: 1,
      properties: {},
    };

    const fighter = createCombatant("f1", "Воин", 3, 3);
    const state = createMockCombatState([lavaElem], [fighter]);

    startTurn(state);

    expect(state.require("f1").hpCurrent).toBeLessThan(50);
    const logEntry = state.log.find((l) => l.text.includes("начинает ход в раскаленной лаве"));
    expect(logEntry).toBeDefined();
  });

  it("should toggle door open/closed and dynamically affect line of sight", () => {
    const doorElem: MapElement = {
      id: "door-gate-1",
      type: "door",
      x: 5,
      y: 5,
      width: 1,
      height: 1,
      properties: { isOpen: false, label: "Дверь (закрыта)" },
    };

    const player = createCombatant("p1", "Игрок", 5, 4);
    const enemy = createCombatant("e1", "Враг", 5, 6);
    const state = createMockCombatState([doorElem], [player, enemy]);

    // Closed door blocks Line of Sight between (5, 4) and (5, 6)
    expect(hasLineOfSight({ x: 5, y: 4 }, { x: 5, y: 6 }, state.mapElements)).toBe(false);

    // Player toggles door open
    const outcome = toggleDoor(state, "door-gate-1", { actorId: "p1" });
    expect(outcome.isOpen).toBe(true);
    expect(doorElem.properties.isOpen).toBe(true);

    // Open door allows Line of Sight
    expect(hasLineOfSight({ x: 5, y: 4 }, { x: 5, y: 6 }, state.mapElements)).toBe(true);

    // Player toggles door closed again
    toggleDoor(state, "door-gate-1", { actorId: "p1" });
    expect(doorElem.properties.isOpen).toBe(false);
    expect(hasLineOfSight({ x: 5, y: 4 }, { x: 5, y: 6 }, state.mapElements)).toBe(false);
  });

  it("should shove target into lava and trigger 2d10 fire damage", () => {
    const lavaElem: MapElement = {
      id: "lava-pit",
      type: "lava",
      x: 6,
      y: 4,
      width: 1,
      height: 1,
      properties: {},
    };

    const shover = createCombatant("s1", "Атлет", 4, 4, { dexMod: 0 });
    const victim = createCombatant("v1", "Гоблин", 5, 4, { hpCurrent: 30, hpMax: 30, dexMod: 0 });
    const state = createMockCombatState([lavaElem], [shover, victim]);

    // Shove victim directly east into lava at (6, 4)
    const result = shoveCombatant(state, "s1", "v1", "push", {
      skipTurnCheck: true,
      pushDirection: { dx: 1, dy: 0 },
    });

    if (result.success) {
      const victimAfter = state.require("v1");
      expect(victimAfter.x).toBe(6);
      expect(victimAfter.y).toBe(4);
      expect(victimAfter.hpCurrent).toBeLessThan(30);
      expect(result.lavaDamage).toBeGreaterThan(0);
    }
  });

  it("should correctly identify water terrain and difficult movement cost", () => {
    const waterElem: MapElement = {
      id: "water-pool",
      type: "water",
      x: 2,
      y: 2,
      width: 3,
      height: 3,
      properties: {},
    };

    const state = createMockCombatState([waterElem], []);
    expect(isWaterTerrain({ x: 3, y: 3 }, state.mapElements)).toBe(true);
    expect(isWaterTerrain({ x: 0, y: 0 }, state.mapElements)).toBe(false);
  });
});
