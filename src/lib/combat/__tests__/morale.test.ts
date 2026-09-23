import { describe, it, expect } from "vitest";
import {
  checkMoraleTrigger,
  resolveMoraleCheck,
  applyMoraleFailure,
  getFleeingDestination,
} from "../morale";
import { runBotTurn } from "../bot";
import { CombatState } from "../engine";
import type { Combatant, Attack } from "../types";

function createMockCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: overrides.id || "c-" + Math.random().toString(36).slice(2, 7),
    name: overrides.name || "Test Enemy",
    type: overrides.type || "enemy",
    color: "#ef4444",
    x: overrides.x ?? 5,
    y: overrides.y ?? 5,
    hpCurrent: overrides.hpCurrent ?? 30,
    hpMax: overrides.hpMax ?? 30,
    hpTemp: 0,
    ac: overrides.ac ?? 13,
    speed: 30,
    initiative: 10,
    initiativeTiebreak: 10,
    dexMod: 1,
    conditions: overrides.conditions || [],
    isHidden: false,
    hasActed: false,
    className: "Goblin",
    level: 1,
    size: "small",
    movementUsed: 0,
    actionUsed: overrides.actionUsed ?? false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: overrides.attacks || [
      {
        id: "atk-scimitar",
        name: "Скимитар",
        attackBonus: 4,
        damage: [{ dice: "1d6", mod: 2, type: "slashing" }],
        kind: "melee",
        range: { normal: 5 },
        actionCost: "action",
      },
    ],
    spells: { slots: {}, known: [] },
    abilities: [],
    concentration: null,
    saves: overrides.saves || {
      WIS: { prof: false, mod: -1 },
    },
    abilityMods: overrides.abilityMods || { STR: 0, DEX: 2, CON: 0, INT: 0, WIS: -1, CHA: -1 },
    profBonus: 2,
    isAIControlled: true,
    conditionImmunities: overrides.conditionImmunities || [],
    monsterTraits: overrides.monsterTraits || [],
    tacticalRole: overrides.tacticalRole,
  };
}

function createTestCombatState(combatants: Combatant[], gridWidth = 20, gridHeight = 20): CombatState {
  return new CombatState({
    id: "test-morale-combat",
    name: "Test Morale Combat",
    status: "active",
    round: 1,
    currentTurnIndex: 0,
    turnOrder: combatants.map((c) => c.id),
    combatants,
    mapElements: [],
    log: [],
    gridWidth,
    gridHeight,
  } as any);
}

describe("Morale System (checkMoraleTrigger)", () => {
  it("ignores non-enemy, dead, or already fleeing combatants", () => {
    const player = createMockCombatant({ id: "p1", type: "player" });
    const deadEnemy = createMockCombatant({ id: "e-dead", type: "enemy", hpCurrent: 0 });
    const fleeingEnemy = createMockCombatant({
      id: "e-fleeing",
      type: "enemy",
      conditions: [{ type: "fleeing" }],
    });

    expect(checkMoraleTrigger(player, [player])).toEqual({ shouldCheck: false });
    expect(checkMoraleTrigger(deadEnemy, [deadEnemy])).toEqual({ shouldCheck: false });
    expect(checkMoraleTrigger(fleeingEnemy, [fleeingEnemy])).toEqual({ shouldCheck: false });
  });

  it("ignores bosses and creatures immune to fear/frightened", () => {
    const boss = createMockCombatant({ id: "b1", tacticalRole: "boss" });
    const fearlessTraitEnemy = createMockCombatant({
      id: "e-fearless",
      monsterTraits: [{ name: "Бесстрашный", description: "Существо невозможно испугать" }],
    });
    const immuneEnemy = createMockCombatant({
      id: "e-immune",
      conditionImmunities: ["frightened"],
    });

    const deadBoss = createMockCombatant({ id: "b-dead", tacticalRole: "boss", hpCurrent: 0 });
    const combatants = [boss, fearlessTraitEnemy, immuneEnemy, deadBoss];

    expect(checkMoraleTrigger(boss, combatants)).toEqual({ shouldCheck: false });
    expect(checkMoraleTrigger(fearlessTraitEnemy, combatants)).toEqual({ shouldCheck: false });
    expect(checkMoraleTrigger(immuneEnemy, combatants)).toEqual({ shouldCheck: false });
  });

  it("triggers 'boss_killed' when all enemy bosses are slain", () => {
    const minion = createMockCombatant({ id: "m1", tacticalRole: "vanguard" });
    const aliveBoss = createMockCombatant({ id: "b1", tacticalRole: "boss", hpCurrent: 50 });
    const deadBoss = createMockCombatant({ id: "b2", tacticalRole: "boss", hpCurrent: 0 });

    // With alive boss, minion does not check morale for boss killed
    expect(checkMoraleTrigger(minion, [minion, aliveBoss])).toEqual({ shouldCheck: false });

    // Once all bosses are dead, trigger fires!
    expect(checkMoraleTrigger(minion, [minion, deadBoss])).toEqual({
      shouldCheck: true,
      reason: "boss_killed",
    });
  });

  it("triggers 'squad_half_dead' when >= 50% of squad is dead and at least 2 dead", () => {
    const m1 = createMockCombatant({ id: "m1", hpCurrent: 10 });
    const m2 = createMockCombatant({ id: "m2", hpCurrent: 10 });
    const d1 = createMockCombatant({ id: "d1", hpCurrent: 0 });
    const d2 = createMockCombatant({ id: "d2", hpCurrent: 0 });

    // 2 enemies total, 1 dead: dead is 50%, but dead < 2 => shouldCheck: false
    expect(checkMoraleTrigger(m1, [m1, d1])).toEqual({ shouldCheck: false });

    // 4 enemies total, 2 dead: dead >= 2 and 2 >= 4/2 => triggers squad_half_dead
    expect(checkMoraleTrigger(m1, [m1, m2, d1, d2])).toEqual({
      shouldCheck: true,
      reason: "squad_half_dead",
    });

    // 5 enemies total, 2 dead: 2 < 2.5 => shouldCheck: false
    const m3 = createMockCombatant({ id: "m3", hpCurrent: 10 });
    expect(checkMoraleTrigger(m1, [m1, m2, m3, d1, d2])).toEqual({ shouldCheck: false });
  });
});

describe("resolveMoraleCheck", () => {
  it("resolves Wisdom save against DC 10", () => {
    const wiseCleric = createMockCombatant({
      saves: { WIS: { prof: true, mod: 4 } },
    });
    const lowWisGoblin = createMockCombatant({
      saves: { WIS: { prof: false, mod: -2 } },
    });

    // High roll passes
    const passResult = resolveMoraleCheck(wiseCleric, 10, 8); // 8 + 4 = 12 >= 10
    expect(passResult.passed).toBe(true);
    expect(passResult.roll).toBe(12);
    expect(passResult.dc).toBe(10);

    // Low roll fails
    const failResult = resolveMoraleCheck(lowWisGoblin, 10, 7); // 7 - 2 = 5 < 10
    expect(failResult.passed).toBe(false);
    expect(failResult.roll).toBe(5);
  });
});

describe("applyMoraleFailure", () => {
  it("adds fleeing condition with duration 10 rounds and logs panic message", () => {
    const goblin = createMockCombatant({ id: "gob-1", name: "Гоблин-разведчик" });
    const state = createTestCombatState([goblin]);

    applyMoraleFailure(state, goblin.id);

    const target = state.get(goblin.id);
    const fleeingCondition = target?.conditions.find((c) => c.type === "fleeing");
    expect(fleeingCondition).toBeDefined();
    expect(fleeingCondition?.durationRounds ?? fleeingCondition?.duration).toBe(10);

    const logEntry = state.log.find((l) => l.text.includes("сломлен паникой и обращается в бегство"));
    expect(logEntry).toBeDefined();
  });
});

describe("getFleeingDestination", () => {
  it("selects nearest map border away from threats", () => {
    const actor = createMockCombatant({ id: "actor", x: 2, y: 10 });
    const player = createMockCombatant({ id: "p1", type: "player", x: 10, y: 10 });

    const dest = getFleeingDestination(actor, 20, 20, [player]);

    // Closest border is left border (x=0) and player is to the right (x=10)
    expect(dest.x).toBe(0);
  });

  it("chooses alternative border if nearest border is blocked by player", () => {
    // Actor at (2, 10), player at (1, 10) blocking left border
    const actor = createMockCombatant({ id: "actor", x: 2, y: 10 });
    const blockingPlayer = createMockCombatant({ id: "p1", type: "player", x: 1, y: 10 });

    const dest = getFleeingDestination(actor, 20, 20, [blockingPlayer]);

    // Should NOT choose (0, 10) right behind blocking player
    expect(dest.x === 0 && dest.y === 10).toBe(false);
  });
});

describe("Fleeing Bot AI in runBotTurn", () => {
  it("panicked bot flees instead of attacking, and escapes at map border", () => {
    // Actor at (1, 10), already fleeing, player at (5, 10)
    const fleeingGoblin = createMockCombatant({
      id: "gob-flee",
      name: "Трусливый Гоблин",
      x: 1,
      y: 10,
      speed: 30,
      conditions: [{ type: "fleeing" }],
    });
    const player = createMockCombatant({
      id: "player-1",
      name: "Воин",
      type: "player",
      x: 5,
      y: 10,
    });

    const state = createTestCombatState([fleeingGoblin, player], 20, 20);

    const result = runBotTurn(state, fleeingGoblin);

    // Should log fleeing move
    const fleeingStep = result.steps.find((s) => s.text.includes("в панике бежит к краю карты"));
    expect(fleeingStep).toBeDefined();

    // Should NOT contain any attack steps by fleeing goblin
    const attackStep = result.steps.find((s) => s.kind === "attack");
    expect(attackStep).toBeUndefined();

    // Goblin reached border x=0 and escaped: hpCurrent set to 0 or removed from combat
    expect(fleeingGoblin.hpCurrent).toBe(0);
    const escapeLog = state.log.find((l) => l.text.includes("скрывается в чаще и покидает поле боя"));
    expect(escapeLog).toBeDefined();
  });
});
