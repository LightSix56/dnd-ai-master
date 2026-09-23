import { describe, it, expect } from "vitest";
import { decideBotTurn } from "../bot";
import { CombatState } from "../engine";
import type { Combatant, Attack, MonsterMultiattack, RechargeAbility } from "../types";

function createMockCombatant(overrides: Partial<Combatant> = {}): Combatant {
  return {
    id: overrides.id || "c-" + Math.random().toString(36).slice(2, 7),
    name: overrides.name || "Test Bot",
    type: overrides.type || "enemy",
    color: "#ef4444",
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    hpCurrent: overrides.hpCurrent ?? 50,
    hpMax: overrides.hpMax ?? 50,
    hpTemp: 0,
    ac: overrides.ac ?? 14,
    speed: 30,
    initiative: 12,
    initiativeTiebreak: 12,
    dexMod: 2,
    conditions: overrides.conditions || [],
    isHidden: false,
    hasActed: false,
    className: "Monster",
    level: 3,
    size: "medium",
    movementUsed: 0,
    actionUsed: overrides.actionUsed ?? false,
    bonusActionUsed: false,
    reactionUsed: false,
    attacksPerAction: overrides.attacksPerAction || 1,
    attacksMadeThisAction: 0,
    extraActions: 0,
    hotbar: [],
    attacks: overrides.attacks || [],
    spells: { slots: {}, known: [], prepared: [], spellSaveDC: 12, spellAttackBonus: 4 },
    abilities: [],
    concentration: null,
    wildShape: null,
    saves: {
      STR: { prof: true, mod: 4 },
      DEX: { prof: false, mod: 2 },
      CON: { prof: true, mod: 4 },
      INT: { prof: false, mod: 0 },
      WIS: { prof: false, mod: 1 },
      CHA: { prof: false, mod: 0 },
    },
    abilityMods: { STR: 2, DEX: 2, CON: 2, INT: 0, WIS: 1, CHA: 0 },
    profBonus: 2,
    isAIControlled: true,
    damageResistances: [],
    damageImmunities: [],
    damageVulnerabilities: [],
    conditionImmunities: [],
    monsterTraits: overrides.monsterTraits || [],
    multiattack: overrides.multiattack || null,
    rechargeAbilities: overrides.rechargeAbilities || [],
    tacticalRole: overrides.tacticalRole,
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
  attackBonus: 5,
  damage: [{ dice: "1d6", mod: 2, type: "piercing" }],
  kind: "melee",
  range: { normal: 5 },
  actionCost: "action",
};

const mockClaw: Attack = {
  id: "atk-claw",
  name: "Коготь",
  attackBonus: 5,
  damage: [{ dice: "1d4", mod: 2, type: "slashing" }],
  kind: "melee",
  range: { normal: 5 },
  actionCost: "action",
};

describe("Monster Tactical Bot AI (Task 6)", () => {
  it("prioritizes Multiattack when in reach of an enemy", () => {
    const multiattack: MonsterMultiattack = {
      name: "Мультиатака",
      description: "Совершает 1 укус и 1 коготь",
      attacks: [
        { attackId: "atk-bite", count: 1 },
        { attackId: "atk-claw", count: 1 },
      ],
    };

    const bear = createMockCombatant({
      id: "bear-bot",
      name: "Медведь",
      x: 0,
      y: 0,
      attacks: [mockBite, mockClaw],
      multiattack,
      attacksPerAction: 2,
    });

    const player = createMockCombatant({
      id: "player",
      name: "Воин",
      type: "player",
      x: 1,
      y: 0,
      hpCurrent: 50,
      ac: 10,
    });

    const state = createTestCombatState([bear, player]);
    const result = decideBotTurn(state, "bear-bot");

    expect(result.ended).toBe(true);
    // Must contain multiattack step
    const hasMultiattack = result.steps.some(
      (s) => s.kind === "attack" && s.text.toLowerCase().includes("мультиатак")
    );
    expect(hasMultiattack).toBe(true);

    const bearAfter = state.require("bear-bot");
    expect(bearAfter.actionUsed).toBe(true);
  });

  it("prioritizes Pack Tactics target when multiple targets exist", () => {
    const wolf = createMockCombatant({
      id: "wolf-bot",
      name: "Волк",
      x: 0,
      y: 0,
      attacks: [mockBite],
      monsterTraits: [{ name: "Тактика стаи", description: "Преимущество если союзник в 5 фт" }],
    });

    const allyWolf = createMockCombatant({
      id: "wolf-ally",
      name: "Союзный Волк",
      type: "enemy",
      x: 2,
      y: 1, // adjacent to target 1 at (2, 0)
    });

    const targetWithAlly = createMockCombatant({
      id: "target-1",
      name: "Цель со стаей",
      type: "player",
      x: 2,
      y: 0,
    });

    const isolatedTarget = createMockCombatant({
      id: "target-2",
      name: "Одиночная цель",
      type: "player",
      x: 0,
      y: 2,
    });

    const state = createTestCombatState([wolf, allyWolf, targetWithAlly, isolatedTarget]);
    const result = decideBotTurn(state, "wolf-bot");

    // Wolf should engage target-1 because ally is already adjacent
    const attacksTarget1 = result.steps.some(
      (s) => s.kind === "attack" && s.text.includes("Цель со стаей")
    );
    expect(attacksTarget1).toBe(true);
  });
});
