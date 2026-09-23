import { describe, it, expect } from "vitest";
import { scoreTargetForBot } from "../bot";
import type { Combatant } from "../types";

function createMockCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: overrides.id || "c-" + Math.random().toString(36).slice(2, 7),
    name: overrides.name || "Test Combatant",
    type: overrides.type || "player",
    color: "#10b981",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    hpCurrent: overrides.hpCurrent ?? 30,
    hpMax: overrides.hpMax ?? 30,
    hpTemp: 0,
    ac: overrides.ac ?? 14,
    speed: 30,
    initiative: 10,
    initiativeTiebreak: 10,
    dexMod: 2,
    conditions: overrides.conditions || [],
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
    attacks: overrides.attacks || [],
    spells: { slots: {}, known: [] },
    abilities: [],
    concentration: overrides.concentration ?? null,
    saves: {},
    abilityMods: { STR: 2, DEX: 2, CON: 2, INT: 0, WIS: 0, CHA: 0 },
    profBonus: 2,
    isAIControlled: false,
    tacticalRole: overrides.tacticalRole,
  };
}

describe("scoreTargetForBot (Target Priority 2.0)", () => {
  const actor = createMockCombatant({ id: "bot-1", type: "enemy", x: 0, y: 0 });

  it("prioritizes concentrating target (boosted from -20 to -40)", () => {
    const normalTarget = createMockCombatant({
      id: "t-normal",
      x: 2,
      y: 0,
      hpCurrent: 30,
      hpMax: 30,
      concentration: null,
    });
    const concentratingTarget = createMockCombatant({
      id: "t-conc",
      x: 2,
      y: 0,
      hpCurrent: 30,
      hpMax: 30,
      concentration: {
        spellId: "bless",
        spellName: "Благословение",
        durationRounds: 10,
      },
    });

    const scoreNormal = scoreTargetForBot(actor, normalTarget, [], "melee");
    const scoreConc = scoreTargetForBot(actor, concentratingTarget, [], "melee");

    // Difference must be exactly 40 points in favor of concentrating target (lower is higher priority)
    expect(scoreNormal - scoreConc).toBe(40);
  });

  it("prioritizes low HP target (finisher: hpCurrent <= 10 score -= 30)", () => {
    const healthyTarget = createMockCombatant({
      id: "t-healthy",
      x: 2,
      y: 0,
      hpCurrent: 20,
      hpMax: 30,
    });
    const lowHpTarget = createMockCombatant({
      id: "t-low",
      x: 2,
      y: 0,
      hpCurrent: 10,
      hpMax: 30,
    });

    const scoreHealthy = scoreTargetForBot(actor, healthyTarget, [], "melee");
    const scoreLow = scoreTargetForBot(actor, lowHpTarget, [], "melee");

    // Low HP target gets finisher bonus (-30) plus lower HP fraction
    expect(scoreLow).toBeLessThan(scoreHealthy);
    // Baseline difference without finisher: (20/30 - 10/30) * 35 = 11.666...
    // With finisher -30, score difference should be around 41.67
    expect(scoreHealthy - scoreLow).toBeGreaterThanOrEqual(40);
  });

  it("prioritizes prone target within 5ft (melee advantage bonus: score -= 25)", () => {
    const standingTarget = createMockCombatant({
      id: "t-standing",
      x: 1, // 5 ft away
      y: 0,
      hpCurrent: 30,
      hpMax: 30,
    });
    const proneTarget = createMockCombatant({
      id: "t-prone",
      x: 1, // 5 ft away
      y: 0,
      hpCurrent: 30,
      hpMax: 30,
      conditions: [{ type: "prone" }],
    });

    const scoreStanding = scoreTargetForBot(actor, standingTarget, [], "melee");
    const scoreProne = scoreTargetForBot(actor, proneTarget, [], "melee");

    // Prone within 5ft gives -25 score reduction
    expect(scoreStanding - scoreProne).toBe(25);
  });

  it("does not apply prone melee advantage bonus if target is farther than 5ft", () => {
    const standingFarTarget = createMockCombatant({
      id: "t-standing-far",
      x: 4, // 20 ft away
      y: 0,
      hpCurrent: 30,
      hpMax: 30,
    });
    const proneFarTarget = createMockCombatant({
      id: "t-prone-far",
      x: 4, // 20 ft away
      y: 0,
      hpCurrent: 30,
      hpMax: 30,
      conditions: [{ type: "prone" }],
    });

    const scoreStanding = scoreTargetForBot(actor, standingFarTarget, [], "melee");
    const scoreProne = scoreTargetForBot(actor, proneFarTarget, [], "melee");

    // At 20 ft, prone does not give melee advantage bonus
    expect(scoreStanding).toBe(scoreProne);
  });
});
