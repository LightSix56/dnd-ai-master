import { describe, it, expect } from "vitest";
import type {
  Combatant,
  MonsterMultiattack,
  LegendaryState,
  LegendaryActionOption,
  RechargeAbility,
  MonsterCombatTrait,
  TacticalRole,
} from "../types";

describe("Monster Combat Engine Types (Task 1)", () => {
  it("allows constructing a valid Combatant with monster mechanics", () => {
    const multiattack: MonsterMultiattack = {
      name: "Мультиатака",
      description: "Дракон совершает одну атаку укусом и две атаки когтями.",
      attacks: [
        { attackId: "bite", count: 1 },
        { attackId: "claw", count: 2 },
      ],
    };

    const legendaryOptions: LegendaryActionOption[] = [
      { id: "opt-detect", name: "Обнаружение", cost: 1, description: "Проверка мудрости" },
      { id: "opt-tail", name: "Атака хвостом", cost: 1, description: "Удар хвостом", attackId: "tail" },
      { id: "opt-wings", name: "Взмах крыльями", cost: 2, description: "Удар по площади 10 фт", abilityId: "wing-buffet" },
    ];

    const legendaryState: LegendaryState = {
      actionsPerRound: 3,
      remainingActions: 3,
      options: legendaryOptions,
      legendaryResistancesMax: 3,
      legendaryResistancesRemaining: 3,
    };

    const recharge: RechargeAbility = {
      id: "fire-breath",
      name: "Огненное дыхание",
      recharge: "5-6",
      isCharged: true,
      actionCost: "action",
      description: "60-футовый конус огня",
    };

    const trait: MonsterCombatTrait = {
      name: "Тактика стаи",
      description: "Преимущество на атаку, если союзник в 5 фт",
    };

    const role: TacticalRole = "boss";

    const dragonCombatant: Partial<Combatant> = {
      id: "boss-dragon",
      name: "Взрослый красный дракон",
      type: "enemy",
      multiattack,
      legendaryState,
      rechargeAbilities: [recharge],
      monsterTraits: [trait],
      tacticalRole: role,
      suppressRegenerationUntilRound: 0,
      damageResistances: ["холод"],
      damageImmunities: ["огонь"],
      conditionImmunities: ["испуг", "паралич"],
    };

    expect(dragonCombatant.multiattack?.attacks.length).toBe(2);
    expect(dragonCombatant.legendaryState?.actionsPerRound).toBe(3);
    expect(dragonCombatant.legendaryState?.legendaryResistancesRemaining).toBe(3);
    expect(dragonCombatant.rechargeAbilities?.[0].recharge).toBe("5-6");
    expect(dragonCombatant.monsterTraits?.[0].name).toBe("Тактика стаи");
    expect(dragonCombatant.tacticalRole).toBe("boss");
  });
});
