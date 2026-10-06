// Скрытая атака и падение без сознания (разбор боя 6 октября 2026: плут нажал «Скрытая атака»
// из укрытия, раскрыл себя и ударил без преимущества и без бонусного урона; после спасброска
// с натуральной 20 очнулся и атаковал, не вставая).
import { afterEach, describe, expect, it, vi } from "vitest";
import { CombatState, dealDamage, performDeathSave, useAbility, EngineError } from "../engine";
import type { Combat, Combatant, MapElement } from "../types";

function mk(id: string, o: Partial<Combatant> = {}): Combatant {
  return {
    id,
    name: id,
    type: "player",
    color: "#fff",
    x: 0,
    y: 0,
    hpCurrent: 30,
    hpMax: 30,
    hpTemp: 0,
    ac: 12,
    speed: 30,
    initiative: 10,
    initiativeTiebreak: 0,
    dexMod: 2,
    conditions: [],
    isHidden: false,
    hasActed: false,
    className: "",
    level: 5,
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
        id: "sw",
        name: "Меч",
        attackBonus: 5,
        damage: [{ dice: "1d8", mod: 3, type: "slashing" }],
        kind: "melee",
        range: { normal: 5 },
        actionCost: "action",
      },
    ],
    spells: {
      slots: { 1: { max: 4, used: 0 }, 2: { max: 3, used: 0 } },
      known: [],
      spellSaveDC: 30,
      spellAttackBonus: 6,
      spellcastingAbility: "WIS",
    },
    abilities: [],
    concentration: null,
    saves: {},
    abilityMods: { STR: 3, DEX: 2, CON: 1, INT: 0, WIS: 3, CHA: 0 },
    profBonus: 3,
    isAIControlled: false,
    ...o,
  };
}

function st(cs: Combatant[], mapElements: MapElement[] = []): CombatState {
  const combat: Combat = {
    id: "c",
    name: "t",
    status: "active",
    round: 1,
    currentTurnIndex: 0,
    turnOrder: cs.map((c) => c.id),
    gridWidth: 20,
    gridHeight: 20,
    cellSize: 40,
    log: [],
    combatants: cs,
    mapElements,
    createdAt: "",
    updatedAt: "",
  };
  return new CombatState(combat);
}

afterEach(() => vi.restoreAllMocks());

const sneakAbility = {
  id: "sneak_attack",
  name: "Скрытая атака",
  usesMax: 0,
  usesUsed: 0,
  parameters: {
    name: "Скрытая атака",
    type: "ability",
    actionCost: "free",
    damage: [{ dice: "1d6", mod: 0, type: "piercing" }],
  },
} as any;

describe("Скрытая атака — пассивное умение", () => {
  it("её нельзя «применить»: скрытый плут остаётся скрытым", () => {
    const rogue = mk("rogue", { className: "Плут", level: 1, isHidden: true, abilities: [sneakAbility] });
    const s = st([rogue, mk("orc", { type: "enemy", x: 5 })]);

    expect(() => useAbility(s, "rogue", "sneak_attack")).toThrow(EngineError);
    expect(s.require("rogue").isHidden).toBe(true);
  });
});

describe("падение без сознания", () => {
  it("герой с 0 HP падает ничком и остаётся лежать, когда приходит в себя", () => {
    const s = st([mk("rogue", { hpCurrent: 5, hpMax: 8 }), mk("orc", { type: "enemy", x: 1 })]);

    dealDamage(s, "rogue", 8);
    expect(s.require("rogue").conditions.map((c) => c.type)).toEqual(
      expect.arrayContaining(["unconscious", "prone"])
    );

    // натуральная 20 на спасброске от смерти
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    performDeathSave(s, "rogue");

    const types = s.require("rogue").conditions.map((c) => c.type);
    expect(s.require("rogue").hpCurrent).toBe(1);
    expect(types).not.toContain("unconscious");
    expect(types).toContain("prone");
  });
});
