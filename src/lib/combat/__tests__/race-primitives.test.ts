import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rollD20 } from "@/lib/dnd/dice";
import { applyEffect, rollEffectSave, useAbility } from "../engine";
import {
  featureMods,
  modRerollOnes,
  modSaveAdvantageForContext,
  modSleepImmune,
  unregisterFeatureMod,
} from "../feature-mods";
import { resolveAttack, rollSave } from "../rules";
import type { CombatAbility, Combatant } from "../types";
import { ally, enemy, hasLog, makeState } from "./helpers/fighter-harness";

function makeAbility(srdKey: string, name: string): CombatAbility {
  return {
    id: `ability_${srdKey}`,
    name,
    usesMax: 0,
    usesUsed: 0,
    refresh: "none",
    parameters: {
      name,
      type: "ability",
      actionCost: "none",
      passive: true,
      srdKey,
    },
  };
}

const TEST_MOD_KEYS = [
  "test/race/halfling/lucky",
  "test/race/elf/fey-ancestry",
  "test/race/gnome/cunning",
  "test/race/satyr/magic-resistance",
] as const;

function seqRandom(...values: number[]) {
  let idx = 0;
  return vi.spyOn(Math, "random").mockImplementation(() => {
    const v = values[idx] ?? values[values.length - 1] ?? 0.5;
    idx += 1;
    return v;
  });
}

beforeEach(() => {
  featureMods("test/race/halfling/lucky", { name: "Везучий", rerollOnes: true });
  featureMods("test/race/elf/fey-ancestry", {
    name: "Фейское наследие",
    saveAdvantageConditions: ["charmed"],
    sleepImmune: true,
  });
  featureMods("test/race/gnome/cunning", {
    name: "Гномья хитрость",
    magicMentalSaveAdvantage: true,
  });
  featureMods("test/race/satyr/magic-resistance", {
    name: "Сопротивление магии",
    spellSaveAdvantage: true,
  });
});

afterEach(() => {
  for (const key of TEST_MOD_KEYS) {
    unregisterFeatureMod(key);
  }
  vi.restoreAllMocks();
});

describe("Combatant racial fields", () => {
  it("supports optional racial metadata fields on Combatant", () => {
    const c: Combatant = ally("elf-1", 5, 5, {
      race: "Эльф",
      subrace: "Высший эльф",
      raceId: "elf",
      subraceId: "high-elf",
      darkvision: 60,
      speeds: { fly: 30, swim: 30, climb: 20, burrow: 10 },
      racialVariants: ["high-elf-cantrip"],
    });
    expect(c.raceId).toBe("elf");
    expect(c.subraceId).toBe("high-elf");
    expect(c.darkvision).toBe(60);
    expect(c.speeds?.fly).toBe(30);
    expect(c.racialVariants).toEqual(["high-elf-cantrip"]);
  });
});

describe("rollD20 with rerollOnes", () => {
  it("rerolls natural 1 once and uses the new value", () => {
    // 0.0 -> 1, 0.7 -> 15
    const spy = seqRandom(0.0, 0.7);
    const roll = rollD20(3, "normal", false, { rerollOnes: true });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(roll.d20).toBe(15);
    expect(roll.natural).toBe(15);
    expect(roll.total).toBe(18);
    expect(roll.isFumble).toBe(false);
    expect(roll.rolls).toEqual([15]);
  });

  it("rerolls natural 1 at most once per die (keeps 1 if second roll is also 1)", () => {
    // 0.0 -> 1, 0.0 -> 1, 0.9 -> 19 (must NOT be consumed)
    const spy = seqRandom(0.0, 0.0, 0.9);
    const roll = rollD20(0, "normal", false, { rerollOnes: true });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(roll.d20).toBe(1);
    expect(roll.natural).toBe(1);
    expect(roll.isFumble).toBe(true);
    expect(roll.rolls).toEqual([1]);
  });

  it("rerolls 1 once on each die when rolling with advantage", () => {
    // die1: 1 -> 9 (0.0, 0.4); die2: 1 -> 19 (0.0, 0.9)
    const spy = seqRandom(0.0, 0.4, 0.0, 0.9);
    const roll = rollD20(2, "advantage", false, { rerollOnes: true });
    expect(spy).toHaveBeenCalledTimes(4);
    expect(roll.d20).toBe(19);
    expect(roll.otherD20).toBe(9);
    expect(roll.rolls).toEqual([9, 19]);
  });
});

describe("feature-mods racial helpers & resolveAttack", () => {
  it("modRerollOnes detects race/halfling/lucky and resolveAttack hits after rerolling 1", () => {
    const halfling = ally("halfling", 5, 5, {
      abilities: [makeAbility("test/race/halfling/lucky", "Везучий")],
    });
    const foe = enemy("orc", 6, 5, { ac: 15 });
    expect(modRerollOnes(halfling)).toBe(true);
    expect(modRerollOnes(foe)).toBe(false);

    // attack d20: 1 (0.0) -> rerolled to 11 (0.5), 11 + 7 = 18 >= 15 -> HIT; damage 1d8+3 (0.5 -> 5+3=8)
    seqRandom(0.0, 0.5, 0.5);
    const res = resolveAttack(halfling, foe, halfling.attacks[0], { allCombatants: [halfling, foe] });
    expect(res.hit).toBe(true);
    expect(res.fumble).toBe(false);
    expect(res.roll.natural).toBe(11);
  });
});

describe("rollSave conditional racial advantages", () => {
  it("Fey Ancestry: advantage on saves against charmed, no advantage on DEX fireball save", () => {
    const elf = ally("elf", 5, 5, {
      abilities: [makeAbility("test/race/elf/fey-ancestry", "Фейское наследие")],
      saves: { WIS: { prof: false, mod: 0 }, DEX: { prof: false, mod: 0 } },
    });

    expect(modSaveAdvantageForContext(elf, "WIS", { condition: "charmed" })).toBe(true);
    expect(modSaveAdvantageForContext(elf, "DEX", {})).toBe(false);

    // 1 (0.0) and 19 (0.9) -> takes 19 with advantage
    seqRandom(0.0, 0.9);
    const charmedSave = rollSave(elf, "WIS", 15, { condition: "charmed", isSpell: true });
    expect(charmedSave.advantage).toBe(true);
    expect(charmedSave.success).toBe(true);
    expect(charmedSave.roll.natural).toBe(19);

    // 1 (0.0) -> no advantage on DEX fireball save, fails
    seqRandom(0.0, 0.9);
    const fireballSave = rollSave(elf, "DEX", 15, { isSpell: true });
    expect(fireballSave.advantage).toBe(false);
    expect(fireballSave.success).toBe(false);
    expect(fireballSave.roll.natural).toBe(1);
  });

  it("Gnome Cunning: advantage on INT/WIS/CHA vs spell or magical effect, not physical or non-magical", () => {
    const gnome = ally("gnome", 5, 5, {
      abilities: [makeAbility("test/race/gnome/cunning", "Гномья хитрость")],
    });

    for (const ab of ["INT", "WIS", "CHA"] as const) {
      seqRandom(0.5);
      expect(rollSave(gnome, ab, 15, { isSpell: true }).advantage).toBe(true);
      seqRandom(0.5);
      expect(rollSave(gnome, ab, 15, { isMagical: true }).advantage).toBe(true);
    }

    for (const ab of ["STR", "DEX", "CON"] as const) {
      seqRandom(0.5);
      expect(rollSave(gnome, ab, 15, { isSpell: true }).advantage).toBe(false);
    }

    seqRandom(0.5);
    expect(rollSave(gnome, "WIS", 15, { isSpell: false, isMagical: false }).advantage).toBe(false);
  });

  it("Satyr Magic Resistance: advantage on ANY ability save when isSpell is true", () => {
    const satyr = ally("satyr", 5, 5, {
      abilities: [makeAbility("test/race/satyr/magic-resistance", "Сопротивление магии")],
    });

    for (const ab of ["STR", "DEX", "CON", "INT", "WIS", "CHA"] as const) {
      seqRandom(0.5);
      expect(rollSave(satyr, ab, 15, { isSpell: true }).advantage).toBe(true);
    }

    seqRandom(0.5);
    expect(rollSave(satyr, "DEX", 15, { isSpell: false }).advantage).toBe(false);
  });
});

describe("engine integration: rollEffectSave, castSpellOrAbility, sleep immunity", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  it("rollEffectSave forwards condition and isMagical to rollSave", () => {
    const elf = ally("elf", 5, 5, {
      abilities: [makeAbility("test/race/elf/fey-ancestry", "Фейское наследие")],
    });
    const gnome = ally("gnome", 6, 5, {
      abilities: [makeAbility("test/race/gnome/cunning", "Гномья хитрость")],
    });
    const state = makeState([elf, gnome]);

    const elfSave = rollEffectSave(state as any, elf, "WIS", 15, false, "Очарование феи", false, {
      condition: "charmed",
    });
    expect(elfSave.advantage).toBe(true);

    const gnomeSave = rollEffectSave(state as any, gnome, "INT", 15, false, "Психический эффект", false, {
      isMagical: true,
    });
    expect(gnomeSave.advantage).toBe(true);
  });

  it("castSpellOrAbility forwards condition from params.effects into rollEffectSave", () => {
    const elf = ally("elf", 5, 5, {
      abilities: [makeAbility("test/race/elf/fey-ancestry", "Фейское наследие")],
      saves: { WIS: { prof: false, mod: 0 } },
    });
    const caster = enemy("mage", 6, 5, {
      abilities: [
        {
          id: "charm_person",
          name: "Очарование личности",
          usesMax: 0,
          usesUsed: 0,
          refresh: "none",
          parameters: {
            name: "Очарование личности",
            type: "spell",
            actionCost: "action",
            targeting: "creature",
            range: { type: "ranged", value: 30 },
            saveType: "WIS",
            saveDC: 15,
            effects: [{ condition: "charmed", durationRounds: 10 }],
          },
        },
      ],
    });
    const state = makeState([caster, elf]);
    // Caster turn; elf rolls 1 (0.0) and 19 (0.9) -> succeeds via advantage!
    seqRandom(0.0, 0.9);
    const out = useAbility(state as any, "mage", "charm_person", { targetIds: ["elf"] });
    expect(out.targets[0]?.saved).toBe(true);
    expect(elf.conditions.some((c) => c.type === "charmed")).toBe(false);
  });

  it("modSleepImmune & featureConditionImmunity block magical sleep while allowing normal unconscious", () => {
    const elf = ally("elf", 5, 5, {
      abilities: [makeAbility("test/race/elf/fey-ancestry", "Фейское наследие")],
    });
    const caster = enemy("mage", 6, 5, {
      abilities: [
        {
          id: "sleep_spell",
          name: "Усыпление",
          usesMax: 0,
          usesUsed: 0,
          refresh: "none",
          parameters: {
            name: "Усыпление",
            type: "spell",
            actionCost: "action",
            targeting: "creature",
            range: { type: "ranged", value: 90 },
            effects: [{ condition: "unconscious", durationRounds: 10 }],
          },
        },
      ],
    });
    const state = makeState([caster, elf]);

    expect(modSleepImmune(elf)).toBe("Фейское наследие");

    // Direct "sleep" condition is blocked
    applyEffect(state as any, "elf", { condition: "sleep", durationRounds: 10 }, "mage");
    expect(elf.conditions.some((c) => c.type === "sleep")).toBe(false);
    expect(hasLog(state as any, "Фейское наследие")).toBe(true);

    // Magical sleep tagged via isMagicalSleep is blocked
    applyEffect(state as any, "elf", { condition: "unconscious", durationRounds: 10, isMagicalSleep: true }, "mage");
    expect(elf.conditions.some((c) => c.type === "unconscious")).toBe(false);

    // Spell named "Усыпление" applying unconscious is blocked
    useAbility(state as any, "mage", "sleep_spell", { targetIds: ["elf"] });
    expect(elf.conditions.some((c) => c.type === "unconscious")).toBe(false);

    // Normal non-magical unconscious is still applied
    applyEffect(state as any, "elf", { condition: "unconscious", durationRounds: 1 }, "mage");
    expect(elf.conditions.some((c) => c.type === "unconscious")).toBe(true);
  });
});
