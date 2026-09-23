import { describe, it, expect } from "vitest";
import { performLegendaryAction, checkLegendaryResistance, triggerAILegendaryActions } from "../legendary";
import { CombatState } from "../engine";
import type { Combatant, Attack, LegendaryState } from "../types";

function createMockCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: overrides.id || "c-" + Math.random().toString(36).slice(2, 7),
    name: overrides.name || "Test Boss",
    type: overrides.type || "enemy",
    color: "#ef4444",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    hpCurrent: overrides.hpCurrent ?? 200,
    hpMax: overrides.hpMax ?? 200,
    hpTemp: 0,
    ac: overrides.ac ?? 18,
    speed: 40,
    initiative: 15,
    initiativeTiebreak: 15,
    dexMod: 2,
    conditions: overrides.conditions || [],
    isHidden: false,
    hasActed: false,
    className: "Dragon",
    level: 15,
    size: "huge",
    movementUsed: 0,
    actionUsed: false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: overrides.attacks || [],
    spells: { slots: {}, known: [], prepared: [], spellSaveDC: 18, spellAttackBonus: 10 },
    abilities: [],
    concentration: null,
    wildShape: null,
    saves: {
      STR: { prof: true, mod: 12 },
      DEX: { prof: true, mod: 7 },
      CON: { prof: true, mod: 12 },
      INT: { prof: false, mod: 3 },
      WIS: { prof: true, mod: 7 },
      CHA: { prof: true, mod: 9 },
    },
    abilityMods: { STR: 7, DEX: 2, CON: 7, INT: 3, WIS: 2, CHA: 4 },
    profBonus: 5,
    isAIControlled: overrides.isAIControlled !== undefined ? overrides.isAIControlled : true,
    damageResistances: [],
    damageImmunities: [],
    damageVulnerabilities: [],
    conditionImmunities: [],
    legendaryState: overrides.legendaryState || null,
  };
}

function createTestCombatState(combatants: Combatant[] = []): CombatState {
  return new CombatState({
    id: "test-combat",
    name: "Test Combat",
    status: "active",
    round: 1,
    currentTurnIndex: 0,
    turnOrder: combatants.map((c) => c.id),
    combatants,
    mapElements: [],
    log: [],
    gridWidth: 20,
    gridHeight: 20,
  } as any);
}

const mockTailAttack: Attack = {
  id: "atk-tail",
  name: "Атака хвостом",
  attackBonus: 12,
  damage: [{ dice: "2d8", mod: 7, type: "bludgeoning" }],
  kind: "melee",
  range: { normal: 15 },
  actionCost: "action",
};

describe("Legendary Actions & Resistances Engine (Task 4)", () => {
  it("deducts legendary action points correctly and records combat log", () => {
    const legendaryState: LegendaryState = {
      actionsPerRound: 3,
      remainingActions: 3,
      options: [
        { id: "opt-detect", name: "Обнаружение", cost: 1, description: "Проверка восприятия" },
        { id: "opt-tail", name: "Атака хвостом", cost: 1, description: "Удар хвостом", attackId: "atk-tail" },
        { id: "opt-wings", name: "Взмах крыльями", cost: 2, description: "Удар крыльями" },
      ],
      legendaryResistancesMax: 3,
      legendaryResistancesRemaining: 3,
    };

    const boss = createMockCombatant({
      id: "dragon-boss",
      name: "Дракон",
      attacks: [mockTailAttack],
      legendaryState,
    });

    const player = createMockCombatant({
      id: "hero",
      name: "Герой",
      type: "player",
      x: 2,
      y: 0, // 10 ft away
      hpCurrent: 50,
    });

    const state = createTestCombatState([boss, player]);
    const bossState = state.require("dragon-boss");

    // Spend 1 point for tail
    performLegendaryAction(state, "dragon-boss", "opt-tail", "hero");
    expect(bossState.legendaryState?.remainingActions).toBe(2);

    // Spend 2 points for wings
    performLegendaryAction(state, "dragon-boss", "opt-wings");
    expect(bossState.legendaryState?.remainingActions).toBe(0);

    // Attempting another action with 0 points throws error
    expect(() => performLegendaryAction(state, "dragon-boss", "opt-detect")).toThrow(
      /недостаточно очков/i
    );
  });

  it("checks and consumes Legendary Resistance charges", () => {
    const legendaryState: LegendaryState = {
      actionsPerRound: 3,
      remainingActions: 3,
      options: [],
      legendaryResistancesMax: 3,
      legendaryResistancesRemaining: 3,
    };

    const boss = createMockCombatant({ id: "lich", name: "Лич", legendaryState });
    const state = createTestCombatState([boss]);
    const bossState = state.require("lich");

    // Use charge 1
    const used1 = checkLegendaryResistance(bossState, state, "Hold Monster");
    expect(used1).toBe(true);
    expect(bossState.legendaryState?.legendaryResistancesRemaining).toBe(2);

    // Use charge 2 and 3
    checkLegendaryResistance(bossState, state, "Disintegrate");
    checkLegendaryResistance(bossState, state, "Banishment");
    expect(bossState.legendaryState?.legendaryResistancesRemaining).toBe(0);

    // 4th attempt fails
    const used4 = checkLegendaryResistance(bossState, state, "Feeblemind");
    expect(used4).toBe(false);
  });

  it("triggers AI legendary action after an enemy finishes turn", () => {
    const legendaryState: LegendaryState = {
      actionsPerRound: 3,
      remainingActions: 3,
      options: [
        { id: "opt-tail", name: "Атака хвостом", cost: 1, description: "Удар хвостом", attackId: "atk-tail" },
      ],
      legendaryResistancesMax: 3,
      legendaryResistancesRemaining: 3,
    };

    const boss = createMockCombatant({
      id: "dragon-boss",
      x: 0,
      y: 0,
      attacks: [mockTailAttack],
      legendaryState,
      isAIControlled: true,
    });

    const player = createMockCombatant({
      id: "hero",
      type: "player",
      x: 1,
      y: 0, // 5 ft away
      hpCurrent: 50,
    });

    const state = createTestCombatState([boss, player]);
    const bossState = state.require("dragon-boss");

    // Player finished turn -> AI boss uses 1 legendary action
    triggerAILegendaryActions(state, "hero");
    expect(bossState.legendaryState?.remainingActions).toBe(2);
  });
});
