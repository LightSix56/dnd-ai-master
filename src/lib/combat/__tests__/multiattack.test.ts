import { describe, it, expect } from "vitest";
import { performMultiattack, CombatState } from "../engine";
import type { Combatant, Attack, MonsterMultiattack } from "../types";

function createMockCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: overrides.id || "c-" + Math.random().toString(36).slice(2, 7),
    name: overrides.name || "Test Combatant",
    type: overrides.type || "enemy",
    color: "#ef4444",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    hpCurrent: overrides.hpCurrent ?? 100,
    hpMax: overrides.hpMax ?? 100,
    hpTemp: 0,
    ac: overrides.ac ?? 15,
    speed: 30,
    initiative: 10,
    initiativeTiebreak: 10,
    dexMod: 2,
    conditions: overrides.conditions || [],
    isHidden: false,
    hasActed: false,
    className: "Monster",
    level: 5,
    size: "large",
    movementUsed: 0,
    actionUsed: overrides.actionUsed ?? false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: 3,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: overrides.attacks || [],
    spells: { slots: {}, known: [], prepared: [], spellSaveDC: 13, spellAttackBonus: 5 },
    abilities: [],
    concentration: null,
    wildShape: null,
    saves: {
      STR: { prof: true, mod: 7 },
      DEX: { prof: false, mod: 2 },
      CON: { prof: true, mod: 6 },
      INT: { prof: false, mod: 0 },
      WIS: { prof: false, mod: 1 },
      CHA: { prof: false, mod: 1 },
    },
    abilityMods: { STR: 4, DEX: 2, CON: 3, INT: 0, WIS: 1, CHA: 1 },
    profBonus: 3,
    isAIControlled: true,
    damageResistances: [],
    damageImmunities: [],
    damageVulnerabilities: [],
    conditionImmunities: [],
    multiattack: overrides.multiattack || null,
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

const mockBite: Attack = {
  id: "atk-bite",
  name: "Укус",
  attackBonus: 10,
  damage: [{ dice: "2d6", mod: 4, type: "piercing" }],
  kind: "melee",
  range: { normal: 5 },
  actionCost: "action",
};

const mockClaw: Attack = {
  id: "atk-claw",
  name: "Коготь",
  attackBonus: 10,
  damage: [{ dice: "1d8", mod: 4, type: "slashing" }],
  kind: "melee",
  range: { normal: 5 },
  actionCost: "action",
};

describe("Multiattack Engine (Task 5)", () => {
  it("resolves a sequence of attacks (1 bite + 2 claws) and consumes the main action", () => {
    const multiattack: MonsterMultiattack = {
      name: "Мультиатака",
      description: "Совершает одну атаку укусом и две атаки когтями.",
      attacks: [
        { attackId: "atk-bite", count: 1 },
        { attackId: "atk-claw", count: 2 },
      ],
    };

    const attacker = createMockCombatant({
      id: "bear",
      name: "Медвежатник",
      attacks: [mockBite, mockClaw],
      multiattack,
      x: 0,
      y: 0,
    });

    const target = createMockCombatant({
      id: "target-dummy",
      name: "Манекен",
      type: "player",
      hpCurrent: 100,
      ac: 10,
      x: 1,
      y: 0,
    });

    const state = createTestCombatState([attacker, target]);
    const res = performMultiattack(state, "bear", "target-dummy");

    expect(res.attacks.length).toBe(3);
    expect(res.attacks[0].attackName).toBe("Укус");
    expect(res.attacks[1].attackName).toBe("Коготь");
    expect(res.attacks[2].attackName).toBe("Коготь");

    const bearState = state.require("bear");
    expect(bearState.actionUsed).toBe(true);

    const dummyState = state.require("target-dummy");
    expect(dummyState.hpCurrent).toBeLessThan(100);
  });

  it("throws an error if the attacker has already used their action", () => {
    const multiattack: MonsterMultiattack = {
      name: "Мультиатака",
      description: "Две атаки",
      attacks: [{ attackId: "atk-claw", count: 2 }],
    };

    const attacker = createMockCombatant({
      id: "bear",
      attacks: [mockClaw],
      multiattack,
      actionUsed: true,
    });

    const target = createMockCombatant({ id: "dummy", type: "player" });
    const state = createTestCombatState([attacker, target]);

    expect(() => performMultiattack(state, "bear", "dummy")).toThrow(/действие уже использовано/i);
  });
});
