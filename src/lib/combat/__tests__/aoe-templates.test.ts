import { describe, it, expect } from "vitest";
import {
  getSphereCells,
  getConeCells,
  getLineCells,
  getCubeCells,
  classifyAoeTargets,
} from "../aoe-templates";
import type { Combatant } from "../types";

describe("AoE Spell Templates & Grid Overlay (Phase 4)", () => {
  describe("getSphereCells", () => {
    it("returns expected circle of cells for a 10 ft radius sphere (e.g. Shatter)", () => {
      // 10 ft = 2 cells radius. Euclidean circle with r=2 on center (5, 5).
      // Cells where dx^2 + dy^2 <= 4:
      // (0,0) [1]
      // (0,±1), (±1,0) [4]
      // (±1,±1) [4]
      // (0,±2), (±2,0) [4]
      // Total = 13 cells
      const center = { x: 5, y: 5 };
      const cells = getSphereCells(center, 10, 20, 20);

      expect(cells.length).toBe(13);
      // Contains center
      expect(cells).toContainEqual({ x: 5, y: 5 });
      // Contains cardinals at dist 1 and 2
      expect(cells).toContainEqual({ x: 5, y: 4 });
      expect(cells).toContainEqual({ x: 5, y: 3 });
      expect(cells).toContainEqual({ x: 5, y: 6 });
      expect(cells).toContainEqual({ x: 5, y: 7 });
      expect(cells).toContainEqual({ x: 4, y: 5 });
      expect(cells).toContainEqual({ x: 3, y: 5 });
      expect(cells).toContainEqual({ x: 6, y: 5 });
      expect(cells).toContainEqual({ x: 7, y: 5 });
      // Contains diagonals at dist 1 (sqrt(2) <= 2)
      expect(cells).toContainEqual({ x: 4, y: 4 });
      expect(cells).toContainEqual({ x: 6, y: 4 });
      expect(cells).toContainEqual({ x: 4, y: 6 });
      expect(cells).toContainEqual({ x: 6, y: 6 });
      // Does not contain (4, 3) which is dx=1, dy=2 -> dx^2 + dy^2 = 5 > 4
      expect(cells).not.toContainEqual({ x: 4, y: 3 });
    });

    it("supports Chebyshev metric option", () => {
      // 5 ft = 1 cell radius with Chebyshev gives 3x3 = 9 cells
      const center = { x: 5, y: 5 };
      const cells = getSphereCells(center, 5, 20, 20, { metric: "chebyshev" });
      expect(cells.length).toBe(9);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          expect(cells).toContainEqual({ x: 5 + dx, y: 5 + dy });
        }
      }
    });

    it("clips cells out of grid bounds", () => {
      // Center at corner (0, 0) with 10 ft radius
      const cells = getSphereCells({ x: 0, y: 0 }, 10, 10, 10);
      expect(cells.every((c) => c.x >= 0 && c.x < 10 && c.y >= 0 && c.y < 10)).toBe(true);
      expect(cells.length).toBeLessThan(13);
      expect(cells).toContainEqual({ x: 0, y: 0 });
      expect(cells).toContainEqual({ x: 1, y: 0 });
      expect(cells).toContainEqual({ x: 2, y: 0 });
      expect(cells).toContainEqual({ x: 0, y: 1 });
      expect(cells).toContainEqual({ x: 0, y: 2 });
    });

    it("returns empty array for zero or negative radius", () => {
      expect(getSphereCells({ x: 5, y: 5 }, 0, 10, 10)).toEqual([]);
      expect(getSphereCells({ x: 5, y: 5 }, -5, 10, 10)).toEqual([]);
    });

    it("contains no duplicate cells", () => {
      const cells = getSphereCells({ x: 5, y: 5 }, 15, 20, 20);
      const keys = cells.map((c) => `${c.x},${c.y}`);
      const uniqueKeys = new Set(keys);
      expect(keys.length).toBe(uniqueKeys.size);
    });
  });

  describe("getConeCells", () => {
    it("projects 15 ft cone North for Burning Hands, widening symmetrically", () => {
      // 15 ft = 3 cells. Origin is caster at (5, 5).
      // Row 1 (dist 1, y = 4): 1 cell wide -> (5, 4)
      // Row 2 (dist 2, y = 3): 2 cells wide -> (5, 3), (6, 3) or (4, 3), (5, 3)
      // Row 3 (dist 3, y = 2): 3 cells wide -> (4, 2), (5, 2), (6, 2)
      // Total: 1 + 2 + 3 = 6 cells
      const origin = { x: 5, y: 5 };
      const cells = getConeCells(origin, 15, "N", 20, 20);

      expect(cells.length).toBe(6);
      // Origin is not hit
      expect(cells).not.toContainEqual({ x: 5, y: 5 });
      // Row 1
      expect(cells).toContainEqual({ x: 5, y: 4 });
      // Row 3
      expect(cells).toContainEqual({ x: 4, y: 2 });
      expect(cells).toContainEqual({ x: 5, y: 2 });
      expect(cells).toContainEqual({ x: 6, y: 2 });

      // Check widths at each distance
      const row1 = cells.filter((c) => c.y === 4);
      const row2 = cells.filter((c) => c.y === 3);
      const row3 = cells.filter((c) => c.y === 2);
      expect(row1.length).toBe(1);
      expect(row2.length).toBe(2);
      expect(row3.length).toBe(3);
    });

    it("projects cone in cardinal directions (S, E, W)", () => {
      const origin = { x: 5, y: 5 };
      const southCells = getConeCells(origin, 10, "S", 20, 20); // 2 cells long -> 1 + 2 = 3 cells
      expect(southCells.length).toBe(3);
      expect(southCells.every((c) => c.y > 5)).toBe(true);

      const eastCells = getConeCells(origin, 10, "E", 20, 20);
      expect(eastCells.length).toBe(3);
      expect(eastCells.every((c) => c.x > 5)).toBe(true);

      const westCells = getConeCells(origin, 10, "W", 20, 20);
      expect(westCells.length).toBe(3);
      expect(westCells.every((c) => c.x < 5)).toBe(true);
    });

    it("projects cone in diagonal directions (NE, NW, SE, SW)", () => {
      const origin = { x: 5, y: 5 };
      const neCells = getConeCells(origin, 15, "NE", 20, 20);
      expect(neCells.length).toBe(6);
      // All cells should be in the NE quadrant relative to origin
      expect(neCells.every((c) => c.x >= 5 && c.y <= 5)).toBe(true);
      expect(neCells).not.toContainEqual({ x: 5, y: 5 });
    });

    it("clips cone to grid bounds and has no duplicates", () => {
      const origin = { x: 1, y: 1 };
      const cells = getConeCells(origin, 25, "NW", 10, 10);
      expect(cells.every((c) => c.x >= 0 && c.x < 10 && c.y >= 0 && c.y < 10)).toBe(true);
      const keys = cells.map((c) => `${c.x},${c.y}`);
      expect(keys.length).toBe(new Set(keys).size);
    });

    it("returns empty array for zero or negative length", () => {
      expect(getConeCells({ x: 5, y: 5 }, 0, "N", 10, 10)).toEqual([]);
      expect(getConeCells({ x: 5, y: 5 }, -15, "N", 10, 10)).toEqual([]);
    });
  });

  describe("getLineCells", () => {
    it("traces a 30 ft line for Lightning Bolt", () => {
      // 30 ft = 6 cells. From (2, 2) towards (2, 8).
      const origin = { x: 2, y: 2 };
      const target = { x: 2, y: 8 };
      const cells = getLineCells(origin, target, 30, 5, 20, 20);

      expect(cells.length).toBe(6);
      expect(cells).not.toContainEqual(origin);
      expect(cells).toEqual([
        { x: 2, y: 3 },
        { x: 2, y: 4 },
        { x: 2, y: 5 },
        { x: 2, y: 6 },
        { x: 2, y: 7 },
        { x: 2, y: 8 },
      ]);
    });

    it("clamps ray to lengthFt even if target is far away", () => {
      const origin = { x: 0, y: 0 };
      const target = { x: 0, y: 50 }; // target is 50 cells away
      const cells = getLineCells(origin, target, 20, 5, 100, 100); // 20 ft = 4 cells
      expect(cells.length).toBe(4);
      expect(cells).toEqual([
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 0, y: 3 },
        { x: 0, y: 4 },
      ]);
    });

    it("projects full lengthFt even if target is only 1 cell away", () => {
      const origin = { x: 5, y: 5 };
      const target = { x: 6, y: 5 }; // 1 cell East
      const cells = getLineCells(origin, target, 25, 5, 20, 20); // 25 ft = 5 cells
      expect(cells.length).toBe(5);
      expect(cells).toEqual([
        { x: 6, y: 5 },
        { x: 7, y: 5 },
        { x: 8, y: 5 },
        { x: 9, y: 5 },
        { x: 10, y: 5 },
      ]);
    });

    it("handles diagonal line vector", () => {
      const origin = { x: 0, y: 0 };
      const target = { x: 5, y: 5 };
      const cells = getLineCells(origin, target, 15, 5, 20, 20); // 15 ft = 3 cells
      expect(cells.length).toBe(3);
      expect(cells).toEqual([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ]);
    });

    it("clips line at grid boundary", () => {
      const origin = { x: 8, y: 0 };
      const target = { x: 9, y: 0 };
      const cells = getLineCells(origin, target, 30, 5, 10, 10); // 6 cells, but hits wall at x=10
      // Origin is at 8, so cells are { x: 9, y: 0 }, then x=10 is out of bounds
      expect(cells.length).toBe(1);
      expect(cells).toEqual([{ x: 9, y: 0 }]);
    });

    it("returns empty array for zero length or identical origin/target", () => {
      expect(getLineCells({ x: 2, y: 2 }, { x: 2, y: 5 }, 0, 5, 10, 10)).toEqual([]);
      expect(getLineCells({ x: 2, y: 2 }, { x: 2, y: 2 }, 30, 5, 10, 10)).toEqual([]);
    });
  });

  describe("getCubeCells", () => {
    it("returns 3x3 square of cells for 15 ft cube", () => {
      // 15 ft = 3 cells. 3x3 = 9 cells.
      const origin = { x: 2, y: 2 };
      const cells = getCubeCells(origin, 15, 10, 10);
      expect(cells.length).toBe(9);
      for (let dx = 0; dx < 3; dx++) {
        for (let dy = 0; dy < 3; dy++) {
          expect(cells).toContainEqual({ x: 2 + dx, y: 2 + dy });
        }
      }
    });

    it("supports centered placement", () => {
      const origin = { x: 5, y: 5 };
      const cells = getCubeCells(origin, 15, 20, 20, true);
      expect(cells.length).toBe(9);
      expect(cells).toContainEqual({ x: 4, y: 4 });
      expect(cells).toContainEqual({ x: 5, y: 5 });
      expect(cells).toContainEqual({ x: 6, y: 6 });
    });

    it("clips cube at grid boundaries", () => {
      const origin = { x: 9, y: 9 };
      const cells = getCubeCells(origin, 15, 10, 10);
      // Only (9, 9) is in bounds
      expect(cells.length).toBe(1);
      expect(cells).toEqual([{ x: 9, y: 9 }]);
    });

    it("returns empty array for zero or negative size", () => {
      expect(getCubeCells({ x: 0, y: 0 }, 0, 10, 10)).toEqual([]);
      expect(getCubeCells({ x: 0, y: 0 }, -5, 10, 10)).toEqual([]);
    });
  });

  describe("classifyAoeTargets", () => {
    const createMockCombatant = (overrides: Partial<Combatant>): Combatant =>
      ({
        id: "c1",
        name: "Mock Combatant",
        type: "enemy",
        color: "#ff0000",
        x: 0,
        y: 0,
        hpCurrent: 20,
        hpMax: 20,
        hpTemp: 0,
        ac: 12,
        speed: 30,
        initiative: 10,
        initiativeTiebreak: 0,
        dexMod: 1,
        conditions: [],
        isHidden: false,
        hasActed: false,
        className: "Fighter",
        level: 1,
        size: "medium",
        movementUsed: 0,
        actionUsed: false,
        bonusActionUsed: false,
        reactionUsed: false,
        attacksPerAction: 1,
        attacksMadeThisAction: 0,
        extraActions: 0,
        hotbar: [],
        attacks: [],
        spells: { slots: {}, known: [] },
        abilities: [],
        concentration: null,
        saves: {},
        abilityMods: {},
        profBonus: 2,
        isAIControlled: false,
        ...overrides,
      } as Combatant);

    it("detects friendly fire when an ally is inside the blast radius", () => {
      const ally = createMockCombatant({
        id: "ally-1",
        name: "Ally Fighter",
        type: "player",
        x: 5,
        y: 5,
      });
      const enemy = createMockCombatant({
        id: "enemy-1",
        name: "Goblin",
        type: "enemy",
        x: 5,
        y: 6,
      });
      const outsideEnemy = createMockCombatant({
        id: "enemy-2",
        name: "Goblin Archer",
        type: "enemy",
        x: 10,
        y: 10,
      });

      const blastCells = [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
        { x: 6, y: 5 },
      ];

      const result = classifyAoeTargets(
        blastCells,
        [ally, enemy, outsideEnemy],
        "player"
      );

      expect(result.enemiesHit).toHaveLength(1);
      expect(result.enemiesHit[0].id).toBe("enemy-1");

      expect(result.alliesHit).toHaveLength(1);
      expect(result.alliesHit[0].id).toBe("ally-1");

      expect(result.hasFriendlyFire).toBe(true);
    });

    it("returns hasFriendlyFire = false on clean enemy-only hit", () => {
      const ally = createMockCombatant({
        id: "ally-1",
        name: "Ally Cleric",
        type: "player",
        x: 1,
        y: 1,
      });
      const enemy1 = createMockCombatant({
        id: "enemy-1",
        name: "Orc 1",
        type: "enemy",
        x: 5,
        y: 5,
      });
      const enemy2 = createMockCombatant({
        id: "enemy-2",
        name: "Orc 2",
        type: "enemy",
        x: 6,
        y: 5,
      });

      const blastCells = [
        { x: 5, y: 5 },
        { x: 6, y: 5 },
      ];

      const result = classifyAoeTargets(
        blastCells,
        [ally, enemy1, enemy2],
        "player"
      );

      expect(result.enemiesHit).toHaveLength(2);
      expect(result.alliesHit).toHaveLength(0);
      expect(result.hasFriendlyFire).toBe(false);
    });

    it("correctly handles enemy caster perspective (allies are enemies)", () => {
      const enemyCasterAlly = createMockCombatant({
        id: "enemy-minion",
        name: "Goblin Minion",
        type: "enemy",
        x: 5,
        y: 5,
      });
      const playerTarget = createMockCombatant({
        id: "player-target",
        name: "Wizard",
        type: "player",
        x: 5,
        y: 6,
      });

      const blastCells = [
        { x: 5, y: 5 },
        { x: 5, y: 6 },
      ];

      const result = classifyAoeTargets(
        blastCells,
        [enemyCasterAlly, playerTarget],
        "enemy"
      );

      // From enemy caster's POV, the player is the enemy
      expect(result.enemiesHit.map((c) => c.id)).toEqual(["player-target"]);
      // And the minion is an ally
      expect(result.alliesHit.map((c) => c.id)).toEqual(["enemy-minion"]);
      expect(result.hasFriendlyFire).toBe(true);
    });

    it("matches multi-cell large creatures occupying blast cells", () => {
      // Large creature is 2x2 cells at (4, 4) -> (4,4), (5,4), (4,5), (5,5)
      const ogre = createMockCombatant({
        id: "ogre-1",
        name: "Ogre",
        type: "enemy",
        size: "large",
        x: 4,
        y: 4,
      });

      // Blast only touches (5, 5)
      const blastCells = [{ x: 5, y: 5 }];

      const result = classifyAoeTargets(blastCells, [ogre], "player");
      expect(result.enemiesHit).toHaveLength(1);
      expect(result.enemiesHit[0].id).toBe("ogre-1");
    });
  });
});
