import { describe, it, expect } from "vitest";
import {
  transformWildShape,
  revertWildShape,
  dealDamage,
  castSpell,
} from "../engine";
import { BEAST_FORMS, getBeastFormById } from "../beast-forms";
import type { Combatant } from "../types";

function createMockDruid(): Combatant {
  return {
    id: "druid_1",
    name: "Силас",
    type: "player",
    color: "#10b981",
    x: 2,
    y: 2,
    facing: "E",
    hpCurrent: 28,
    hpMax: 28,
    hpTemp: 0,
    ac: 14,
    speed: 30,
    initiative: 15,
    initiativeTiebreak: 15.1,
    dexMod: 2,
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: "Друид (Круг Луны)",
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
        id: "staff",
        name: "Боевой посох",
        kind: "melee",
        attackBonus: 4,
        damage: [{ dice: "1d6", mod: 2, type: "bludgeoning" }],
        range: { normal: 5 },
        actionCost: "action",
      },
    ],
    spells: {
      slots: { "1": { max: 4, used: 1 }, "2": { max: 2, used: 0 } },
      known: ["heat_metal", "entangle", "shillelagh"],
      prepared: ["heat_metal", "entangle", "shillelagh"],
      spellcastingAbility: "WIS",
      spellSaveDC: 13,
      spellAttackBonus: 5,
    },
    abilities: [
      {
        id: "combat_wild_shape",
        name: "Боевой дикий облик",
        usesMax: 2,
        usesUsed: 0,
        refresh: "short",
        parameters: {
          name: "Боевой дикий облик",
          type: "ability",
          actionCost: "bonus",
          range: { type: "self" },
          damage: [],
          targeting: "self",
          description: "Бонусное действие",
        },
      },
    ],
    concentration: null,
    saves: {
      STR: { prof: false, mod: 0 },
      DEX: { prof: false, mod: 2 },
      CON: { prof: false, mod: 2 },
      INT: { prof: true, mod: 3 },
      WIS: { prof: true, mod: 5 },
      CHA: { prof: false, mod: -1 },
    },
    abilityMods: {
      STR: 0,
      DEX: 2,
      CON: 2,
      INT: 1,
      WIS: 3,
      CHA: -1,
    },
    profBonus: 2,
    isAIControlled: false,
  };
}

function createCombatState(druid: Combatant) {
  return {
    combatants: [druid],
    mapElements: [],
    round: 1,
    currentTurnIndex: 0,
    turnOrder: [druid.id],
    log: [] as any[],
    dirtyIds: new Set<string>(),
    isCombatDirty: false,
    require(id: string) {
      const c = this.combatants.find((x: any) => x.id === id);
      if (!c) throw new Error("Not found: " + id);
      return c;
    },
    get(id: string) {
      return this.combatants.find((x: any) => x.id === id);
    },
    mark(id: string) {
      this.dirtyIds.add(id);
    },
    markCombat() {
      this.isCombatDirty = true;
    },
    addLog(text: string, kind: string, actor: string) {
      this.log.push({ round: this.round, text, kind, actor });
    },
    current() {
      return this.combatants[0];
    },
  };
}

describe("Wild Shape (Дикий облик друида D&D 5e)", () => {
  it("Transforms into Brown Bear: acquires bear HP, AC, speed, size and attacks", () => {
    const druid = createMockDruid();
    const state: any = createCombatState(druid);

    transformWildShape(state, druid.id, "brown_bear", { skipTurnCheck: true });

    expect(druid.wildShape).toBeDefined();
    expect(druid.wildShape?.formId).toBe("brown_bear");
    expect(druid.wildShape?.originalHpCurrent).toBe(28);
    expect(druid.wildShape?.originalAc).toBe(14);

    // Характеристики медведя (CR 1, HP 34, AC 11, Large, STR +4, DEX 0, CON +3)
    expect(druid.hpMax).toBe(34);
    expect(druid.hpCurrent).toBe(34);
    expect(druid.ac).toBe(11);
    expect(druid.speed).toBe(40);
    expect(druid.size).toBe("large");
    expect(druid.abilityMods.STR).toBe(4);
    expect(druid.abilityMods.DEX).toBe(0);
    expect(druid.abilityMods.CON).toBe(3);
    // Ментальные характеристики друида сохраняются!
    expect(druid.abilityMods.WIS).toBe(3);
    expect(druid.abilityMods.INT).toBe(1);

    // Атаки медведя присутствуют
    expect(druid.attacks.length).toBeGreaterThanOrEqual(1);
    expect(druid.attacks.some((a) => a.name.includes("Клыки") || a.name.includes("Когти") || a.name.includes("Мультиатака"))).toBe(true);

    // Способность revert_wild_shape добавлена
    expect(druid.abilities.some((a) => a.id === "revert_wild_shape")).toBe(true);

    // Заряд потрачен
    const ability = druid.abilities.find((a) => a.id === "combat_wild_shape");
    expect(ability?.usesUsed).toBe(1);
  });

  it("Blocks spellcasting while in Wild Shape", () => {
    const druid = createMockDruid();
    const state: any = createCombatState(druid);

    transformWildShape(state, druid.id, "wolf", { skipTurnCheck: true });

    expect(() => {
      castSpell(
        state,
        druid.id,
        {
          id: "heat_metal",
          name: "Раскалённый металл",
          level: 2,
          parameters: {
            name: "Раскалённый металл",
            type: "spell",
            actionCost: "action",
            range: { type: "ranged", value: 60 },
            damage: [{ dice: "2d8", mod: 0, type: "fire" }],
            targeting: "creature",
            description: "Тестовое заклинание",
          },
        },
        { skipTurnCheck: true }
      );
    }).toThrow(/облике зверя/i);
  });

  it("Maintains concentration on active spell through transformation", () => {
    const druid = createMockDruid();
    druid.concentration = {
      spellId: "heat_metal",
      spellName: "Раскалённый металл",
      targetId: "enemy_1",
      durationRounds: 10,
    };
    const state: any = createCombatState(druid);

    transformWildShape(state, druid.id, "dire_wolf", { skipTurnCheck: true });

    // Концентрация не должна сбрасываться!
    expect(druid.concentration).not.toBeNull();
    expect(druid.concentration?.spellName).toBe("Раскалённый металл");
  });

  it("Absorbs damage within beast HP without harming druid", () => {
    const druid = createMockDruid();
    const state: any = createCombatState(druid);

    transformWildShape(state, druid.id, "brown_bear", { skipTurnCheck: true });
    expect(druid.hpCurrent).toBe(34);

    // Наносим 15 урона медведю
    dealDamage(state, druid.id, 15);

    expect(druid.wildShape).not.toBeNull();
    expect(druid.hpCurrent).toBe(19); // 34 - 15 = 19
    expect(druid.wildShape?.originalHpCurrent).toBe(28); // Друид всё ещё 28 HP
  });

  it("Excess damage breaks form and overflows to original druid HP", () => {
    const druid = createMockDruid();
    const state: any = createCombatState(druid);

    // Волк: 11 HP. Исходный друид: 28 HP
    transformWildShape(state, druid.id, "wolf", { skipTurnCheck: true });
    expect(druid.hpCurrent).toBe(11);

    // Наносим 16 урона (11 HP зверя + 5 остаточного урона)
    dealDamage(state, druid.id, 16);

    // Форма должна разрушиться, друид возвращается в истинный облик
    expect(druid.wildShape).toBeNull();
    expect(druid.hpMax).toBe(28);
    expect(druid.hpCurrent).toBe(23); // 28 - 5 = 23
    expect(druid.ac).toBe(14);
    expect(druid.attacks[0].name).toBe("Боевой посох");
  });

  it("Manually reverts to true form cleanly", () => {
    const druid = createMockDruid();
    const state: any = createCombatState(druid);

    transformWildShape(state, druid.id, "giant_spider", { skipTurnCheck: true });
    expect(druid.wildShape).toBeDefined();

    revertWildShape(state, druid.id);

    expect(druid.wildShape).toBeNull();
    expect(druid.hpCurrent).toBe(28);
    expect(druid.ac).toBe(14);
    expect(druid.attacks[0].name).toBe("Боевой посох");
    expect(druid.abilities.some((a) => a.id === "revert_wild_shape")).toBe(false);
  });
});
