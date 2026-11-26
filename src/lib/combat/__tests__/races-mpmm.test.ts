import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyEffect,
  dealDamage,
  endTurn,
  moveCombatant,
  performAttack,
  startTurn,
  useAbility,
} from "../engine";
import { kitHandles } from "../class-kit";
import { modResistance } from "../feature-mods";
import { rollInitiativeFor } from "../initiative";
import { DECLINE, ReactionPrompt } from "../reactions";
import { runWithReactions } from "../reaction-runtime";
import { RACES_2014, raceRuleKeys, raceRules } from "../races/race-defs";
import {
  computeAttackAdvantage,
  effectiveAC,
  effectiveSpeed,
  hasCondition,
  rollSave,
} from "../rules";
import { ally, bySrd, cond, enemy, makeState, raceHero } from "./helpers/race-harness";

import type { Combatant } from "../types";

const MPMM_RACE_IDS = [
  "aarakocra-mpmm",
  "aasimar-mpmm",
  "bugbear-mpmm",
  "githzerai-mpmm",
  "githyanki-mpmm",
  "deep-gnome-mpmm",
  "goblin-mpmm",
  "goliath-mpmm",
  "genasi-mpmm",
  "duergar-mpmm",
  "harengon-mpmm",
  "kenku-mpmm",
  "centaur-mpmm",
  "kobold-mpmm",
  "lizardfolk-mpmm",
  "minotaur-mpmm",
  "sea-elf-mpmm",
  "orc-mpmm",
  "satyr-mpmm",
  "tabaxi-mpmm",
  "tortle-mpmm",
  "triton-mpmm",
  "firbolg-mpmm",
  "fairy-mpmm",
  "hobgoblin-mpmm",
  "changeling-mpmm",
  "shadar-kai-mpmm",
  "shifter-mpmm",
  "eladrin-mpmm",
  "yuan-ti-mpmm",
] as const;

const SURE_SWORD: Combatant["attacks"] = [
  {
    id: "sword",
    name: "Меч",
    kind: "melee",
    range: { normal: 5 },
    attackBonus: 20,
    damage: [{ dice: "1d8", mod: 3, type: "slashing" }],
    actionCost: "action",
  },
];

const SURE_SPELL_ATTACK: Combatant["attacks"] = [
  {
    id: "spell_bolt",
    name: "Чародейская стрела",
    kind: "spell",
    usesSpellAttack: true,
    range: { normal: 60 },
    attackBonus: 20,
    damage: [{ dice: "1d8", mod: 3, type: "bludgeoning" }],
    actionCost: "action",
  },
];

function seqRandom(...values: number[]) {
  let idx = 0;
  return vi.spyOn(Math, "random").mockImplementation(() => {
    const v = values[idx] ?? values[values.length - 1] ?? 0.5;
    idx += 1;
    return v;
  });
}

describe("Batch 4: 30 MPMM Races (*-mpmm)", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. aarakocra-mpmm (Ааракокра MPMM)", () => {
    it("walk 30, fly 30, claws 1d6+STR slashing, Gust of Wind L3 with INT/WIS/CHA", () => {
      const a1 = raceHero("aarakocra-mpmm", null, "aar-1", 1, { mods: { STR: 2, WIS: 3 } });
      expect(a1.raceId).toBe("aarakocra-mpmm");
      expect(a1.speed).toBe(30);
      expect(a1.speeds?.fly).toBe(30);
      const claws = a1.attacks.find((x) => x.id === "aarakocra_claws");
      expect(claws?.damage).toEqual([{ dice: "1d6", mod: 2, type: "slashing" }]);
      expect(a1.abilities.some((a) => a.parameters?.srdKey === "race/aarakocra-mpmm/innate/gust-of-wind")).toBe(false);

      const a3 = raceHero("aarakocra-mpmm", null, "aar-3", 3, {
        racialVariants: ["int"],
        mods: { INT: 4, WIS: 1 },
      });
      const gust = bySrd(a3, "race/aarakocra-mpmm/innate/gust-of-wind");
      expect(gust.usesMax).toBe(1);
      expect(gust.refresh).toBe("long");
      expect(gust.parameters?.saveDC).toBe(8 + 2 + 4);
    });
  });

  describe("2. aasimar-mpmm (Аасимар MPMM)", () => {
    it("dv 60, radiant/necrotic resist, Light cantrip, Healing Hands (profBonus)d4, and 3 Celestial Revelation forms sharing 1/long at L3 with +profBonus damage", () => {
      const a1 = raceHero("aasimar-mpmm", null, "aas-1", 1, { x: 5, y: 5, mods: { CHA: 3 } });
      expect(a1.raceId).toBe("aasimar-mpmm");
      expect(a1.darkvision).toBe(60);
      expect(modResistance(a1, "radiant")).not.toBeNull();
      expect(modResistance(a1, "necrotic")).not.toBeNull();
      expect(bySrd(a1, "race/aasimar-mpmm/innate/light").usesMax).toBe(0);
      // Celestial Revelation is level 3+ only (even though JSON omits minLevel)
      expect(a1.abilities.some((a) => a.parameters?.srdKey === "race/aasimar-mpmm/nebesnoe-otkrovenie")).toBe(false);

      const allyT = ally("pal", 6, 5, { hpMax: 30, hpCurrent: 5 });
      const st1 = makeState([a1, allyT]);
      const hh = bySrd(a1, "race/aasimar-mpmm/istselyayushchie-ruki");
      // Level 5 profBonus = 3 -> 3d4
      const a5 = raceHero("aasimar-mpmm", null, "aas-5", 5, {
        x: 5,
        y: 5,
        mods: { CHA: 3 },
        attacks: SURE_SWORD,
      });
      const ally5 = ally("pal5", 6, 5, { hpMax: 40, hpCurrent: 5 });
      const st5 = makeState([a5, ally5]);
      // 3d4 with Math.random = 0.5 -> 3 * 3 = 9
      useAbility(st5, "aas-5", bySrd(a5, "race/aasimar-mpmm/istselyayushchie-ruki").id, { targetIds: ["pal5"] });
      expect(ally5.hpCurrent).toBe(14);
      expect(hh.usesMax).toBe(1);

      // Necrotic Shroud (Саван смерти): bonus action, AoE 10 ft CHA save, +profBonus (3) necrotic once/turn, shares pool 1/long
      a5.actionUsed = false;
      const foe5 = enemy("orc5", 6, 6, { hpMax: 60, hpCurrent: 60, ac: 10, saves: { CHA: { prof: false, mod: 0 } } });
      const stShroud = makeState([a5, foe5]);
      const shroud = bySrd(a5, "race/aasimar-mpmm/savan-smerti");
      expect(shroud.parameters?.actionCost).toBe("bonus");
      seqRandom(0.1);
      useAbility(stShroud, "aas-5", shroud.id);
      expect(hasCondition(a5, "aasimar_necrotic_shroud")).toBe(true);
      expect(hasCondition(foe5, "frightened")).toBe(true);
      expect(bySrd(a5, "race/aasimar-mpmm/nebesnoe-otkrovenie").usesUsed).toBe(1);
      // Cannot activate a second revelation form in the same day
      expect(() => useAbility(stShroud, "aas-5", bySrd(a5, "race/aasimar-mpmm/siyayushchaya-dusha").id)).toThrow();

      // Extra damage = profBonus (3) once/turn
      seqRandom(0.5);
      const hit1 = performAttack(stShroud, "aas-5", "orc5", "sword");
      expect(hit1.damage).toBe(8 + 3);
      a5.actionUsed = false;
      a5.attacksMadeThisAction = 0;
      const hit2 = performAttack(stShroud, "aas-5", "orc5", "sword");
      expect(hit2.damage).toBe(8);

      // Radiant Consumption (Испускание сияния): endTurn deals profBonus (3) radiant to self and enemies in 10 ft
      const aRad = raceHero("aasimar-mpmm", null, "aas-rad", 5, {
        x: 5,
        y: 5,
        hpMax: 30,
        hpCurrent: 30,
        mods: { CHA: 3 },
      });
      const foeRad = enemy("orcRad", 6, 5, { hpMax: 30, hpCurrent: 30 });
      const stRad = makeState([aRad, foeRad]);
      useAbility(stRad, "aas-rad", bySrd(aRad, "race/aasimar-mpmm/ispuskanie-siyaniya").id);
      endTurn(stRad);
      // Aasimar resists radiant (3 -> 1), enemy takes full 3
      expect(aRad.hpCurrent).toBe(29);
      expect(foeRad.hpCurrent).toBe(27);

      // Radiant Soul (Сияющая душа): grants fly speed = walk (30) and restores on end
      const aSoul = raceHero("aasimar-mpmm", null, "aas-soul", 5, { x: 5, y: 5 });
      const stSoul = makeState([aSoul]);
      useAbility(stSoul, "aas-soul", bySrd(aSoul, "race/aasimar-mpmm/siyayushchaya-dusha").id);
      expect(aSoul.speeds?.fly).toBe(30);
      aSoul.conditions = aSoul.conditions.filter((c) => c.type !== "aasimar_radiant_soul");
      endTurn(stSoul);
      expect(aSoul.speeds?.fly).toBeUndefined();
    });
  });

  describe("3. bugbear-mpmm (Багбир MPMM)", () => {
    it("Fey Ancestry (charmed adv only), Long-Limbed +5 reach, Surprise Attack +2d6 on EVERY hit in round 1 vs unacted", () => {
      const b = raceHero("bugbear-mpmm", null, "bug-1", 5, { x: 5, y: 5, attacks: SURE_SWORD });
      expect(b.darkvision).toBe(60);
      expect(rollSave(b, "WIS", 15, { condition: "charmed" }).advantage).toBe(true);
      const st = makeState([b]);
      applyEffect(st, "bug-1", { condition: "unconscious", durationRounds: 5, isMagicalSleep: true });
      expect(hasCondition(b, "unconscious")).toBe(true);
      b.conditions = [];

      const foe1 = enemy("f1", 7, 5, { hpMax: 50, hpCurrent: 50, ac: 10 }); // 10 ft reach via Long-Limbed
      const foe2 = enemy("f2", 6, 5, { hpMax: 50, hpCurrent: 50, ac: 10 });
      const stAtk = makeState([b, foe1, foe2]);

      // Hit 1: 1d8(5)+3 + 2d6(4+4=8) = 16
      const r1 = performAttack(stAtk, "bug-1", "f1", "sword");
      expect(r1.damage).toBe(16);
      // Hit 2 in same round on another unacted target (no 1/combat limit in MPMM!): also +2d6!
      b.actionUsed = false;
      b.attacksMadeThisAction = 0;
      const r2 = performAttack(stAtk, "bug-1", "f2", "sword");
      expect(r2.damage).toBe(16);
    });
  });

  describe("4. githzerai-mpmm (Гитцерай MPMM)", () => {
    it("Mental Discipline (charmed/frightened adv), psychic resist, Psionics L1 Mage Hand (minLevel override) / L3 Shield / L5 Detect Thoughts with chosen ability", () => {
      const gz1 = raceHero("githzerai-mpmm", null, "gz-1", 1, {
        racialVariants: ["cha"],
        mods: { WIS: 1, CHA: 4 },
      });
      expect(modResistance(gz1, "psychic")).not.toBeNull();
      expect(rollSave(gz1, "WIS", 15, { condition: "charmed" }).advantage).toBe(true);
      expect(rollSave(gz1, "WIS", 15, { condition: "frightened" }).advantage).toBe(true);
      expect(bySrd(gz1, "race/githzerai-mpmm/innate/mage-hand").usesMax).toBe(0);

      const gz5 = raceHero("githzerai-mpmm", null, "gz-5", 5, {
        racialVariants: ["cha"],
        mods: { WIS: 1, CHA: 4 },
      });
      expect(bySrd(gz5, "race/githzerai-mpmm/innate/shield").usesMax).toBe(1);
      const dt = bySrd(gz5, "race/githzerai-mpmm/innate/detect-thoughts");
      expect(dt.usesMax).toBe(1);
      expect(dt.parameters?.saveDC).toBe(8 + 3 + 4);
    });
  });

  describe("5. githyanki-mpmm (Гитъянки MPMM)", () => {
    it("psychic resist, Psionics L1 Mage Hand (minLevel override) / L3 Jump / L5 Misty Step with chosen ability", () => {
      const gy1 = raceHero("githyanki-mpmm", null, "gy-1", 1);
      expect(modResistance(gy1, "psychic")).not.toBeNull();
      expect(bySrd(gy1, "race/githyanki-mpmm/innate/mage-hand").usesMax).toBe(0);

      const gy5 = raceHero("githyanki-mpmm", null, "gy-5", 5, { racialVariants: ["wis"], mods: { INT: 0, WIS: 4 } });
      expect(bySrd(gy5, "race/githyanki-mpmm/innate/jump").usesMax).toBe(1);
      const ms = bySrd(gy5, "race/githyanki-mpmm/innate/misty-step");
      expect(ms.usesMax).toBe(1);
      expect(ms.parameters?.saveDC).toBe(8 + 3 + 4);
    });
  });

  describe("6. deep-gnome-mpmm (Глубинный гном MPMM)", () => {
    it("Small, dv 120, Gnome Magic Resistance (INT/WIS/CHA vs magic), Svirfneblin Camouflage profBonus/long, Gift of Svirfneblin L3/L5", () => {
      const dg = raceHero("deep-gnome-mpmm", null, "dg-5", 5, {
        racialVariants: ["wis"],
        mods: { INT: 1, WIS: 4 },
      });
      expect(dg.size).toBe("small");
      expect(dg.darkvision).toBe(120);
      expect(rollSave(dg, "INT", 15, { isSpell: true }).advantage).toBe(true);
      expect(rollSave(dg, "WIS", 15, { isMagical: true }).advantage).toBe(true);
      expect(rollSave(dg, "DEX", 15, { isSpell: true }).advantage).toBe(false);

      const cam = bySrd(dg, "race/deep-gnome-mpmm/kamuflyazh-svirfneblina");
      expect(cam.usesMax).toBe(3);
      expect(cam.refresh).toBe("long");
      expect(cam.parameters?.manual).toBe(true);

      const ds = bySrd(dg, "race/deep-gnome-mpmm/innate/disguise-self");
      expect(ds.usesMax).toBe(1);
      expect(ds.parameters?.saveDC).toBe(8 + 3 + 4);
      expect(bySrd(dg, "race/deep-gnome-mpmm/innate/nondetection").usesMax).toBe(1);
    });
  });

  describe("7. goblin-mpmm (Гоблин MPMM)", () => {
    it("Small, Fey Ancestry, Fury of the Small (+profBonus, profBonus/long, 1/turn), Nimble Escape Disengage & Hide", () => {
      const g = raceHero("goblin-mpmm", null, "gob-1", 5, { x: 5, y: 5, attacks: SURE_SWORD });
      expect(g.size).toBe("small");
      expect(rollSave(g, "WIS", 15, { condition: "charmed" }).advantage).toBe(true);

      const fury = bySrd(g, "race/goblin-mpmm/yarost-melkogo");
      expect(fury.usesMax).toBe(3);
      expect(fury.refresh).toBe("long");

      const ogre = enemy("ogre", 6, 5, { size: "medium", hpMax: 50, hpCurrent: 50, ac: 10 });
      const st = makeState([g, ogre]);
      useAbility(st, "gob-1", fury.id);
      const hit = performAttack(st, "gob-1", "ogre", "sword");
      // 1d8(5)+3 + profBonus(3) = 11
      expect(hit.damage).toBe(11);
      expect(fury.usesUsed).toBe(1);

      const dis = bySrd(g, "race/goblin-mpmm/nimble-disengage");
      useAbility(st, "gob-1", dis.id);
      expect(hasCondition(g, "disengaging")).toBe(true);
    });
  });

  describe("8. goliath-mpmm (Голиаф MPMM)", () => {
    it("cold resist, Stone's Endurance reduces damage by 1d12+CON with profBonus/long & ReactionPrompt", () => {
      const gol = raceHero("goliath-mpmm", null, "gol-1", 5, {
        hpMax: 50,
        hpCurrent: 50,
        mods: { CON: 3 },
      });
      expect(modResistance(gol, "cold")).not.toBeNull();
      const se = bySrd(gol, "race/goliath-mpmm/vynoslivost-kamnya");
      expect(se.usesMax).toBe(3);
      expect(se.refresh).toBe("long");
      expect(se.parameters?.offTurn).toBe(true);

      const st = makeState([gol]);
      // 1d12 (0.5 -> 7) + 3 = 10 reduction -> 15 - 10 = 5 damage
      dealDamage(st, "gol-1", 15, { damageType: "slashing" });
      expect(gol.hpCurrent).toBe(45);
      expect(gol.reactionUsed).toBe(true);
      expect(se.usesUsed).toBe(1);

      // ReactionPrompt path (accept & decline)
      const gol2 = raceHero("goliath-mpmm", null, "gol-2", 5, { hpMax: 50, hpCurrent: 50, mods: { CON: 3 } });
      const st2 = makeState([gol2]);
      let caught: ReactionPrompt | null = null;
      try {
        runWithReactions({ decisions: {}, seq: 0 }, 1, () => {
          dealDamage(st2, "gol-2", 15, { damageType: "slashing" });
        });
      } catch (e) {
        if (e instanceof ReactionPrompt) caught = e;
        else throw e;
      }
      expect(caught).not.toBeNull();
      expect(caught!.prompt.reactorId).toBe("gol-2");

      const golDec = raceHero("goliath-mpmm", null, "gol-2", 5, { hpMax: 50, hpCurrent: 50, mods: { CON: 3 } });
      const stDec = makeState([golDec]);
      runWithReactions({ decisions: { [caught!.prompt.key]: DECLINE }, seq: 0 }, 1, () => {
        dealDamage(stDec, "gol-2", 15, { damageType: "slashing" });
      });
      expect(golDec.hpCurrent).toBe(35);
      expect(golDec.reactionUsed).toBe(false);
    });
  });

  describe("9. genasi-mpmm (Дженази MPMM: all 4 subraces)", () => {
    it("air-genasi: walk 35, lightning resist, Shocking Grasp L1 / Feather Fall L3 / Levitate L5 with INT/WIS/CHA", () => {
      const air1 = raceHero("genasi-mpmm", "Дженази воздуха", "air-1", 1, {
        racialVariants: ["int"],
        mods: { INT: 4, CHA: 0 },
      });
      expect(air1.speed).toBe(35);
      expect(modResistance(air1, "lightning")).not.toBeNull();
      const sg = bySrd(air1, "race/genasi-mpmm/innate/shocking-grasp");
      expect(sg.usesMax).toBe(0);
      expect(sg.parameters?.saveDC).toBe(8 + 2 + 4);

      const air5 = raceHero("genasi-mpmm", "Дженази воздуха", "air-5", 5);
      expect(bySrd(air5, "race/genasi-mpmm/innate/feather-fall").usesMax).toBe(1);
      expect(bySrd(air5, "race/genasi-mpmm/innate/levitate").usesMax).toBe(1);
    });

    it("earth-genasi: Merge with Stone at L1 (minLevel override), Blade Ward bonus profBonus/long grants B/P/S weapon resistance until end of next turn, Pass Without Trace L5", () => {
      const eg1 = raceHero("genasi-mpmm", "Дженази земли", "eg-1", 1, { hpMax: 40, hpCurrent: 40 });
      expect(bySrd(eg1, "race/genasi-mpmm/innate/blade-ward").usesMax).toBe(0);
      const merge1 = bySrd(eg1, "race/earth-genasi/sliyanie-s-kamnem");
      expect(merge1.usesMax).toBe(2);
      expect(merge1.parameters?.actionCost).toBe("bonus");

      const eg5 = raceHero("genasi-mpmm", "Дженази земли", "eg-5", 5, {
        x: 5,
        y: 5,
        ac: 10,
        hpMax: 50,
        hpCurrent: 50,
      });
      expect(bySrd(eg5, "race/genasi-mpmm/innate/pass-without-trace").usesMax).toBe(1);
      const merge5 = bySrd(eg5, "race/earth-genasi/sliyanie-s-kamnem");
      expect(merge5.usesMax).toBe(3);

      const fighter = enemy("fig", 6, 5, { attacks: SURE_SWORD });
      const mage = enemy("mag", 7, 5, { attacks: SURE_SPELL_ATTACK });
      const st = makeState([eg5, fighter, mage]);

      useAbility(st, "eg-5", merge5.id);
      expect(hasCondition(eg5, "blade_ward")).toBe(true);
      expect(merge5.usesUsed).toBe(1);

      // End earth genasi's current turn: blade_ward persists through enemy turns until end of next turn
      endTurn(st);
      expect(hasCondition(eg5, "blade_ward")).toBe(true);

      // Weapon attack B/P/S is halved (1d8(5)+3 = 8 -> 4)
      performAttack(st, "fig", "eg-5", "sword");
      expect(eg5.hpCurrent).toBe(46);

      // Spell attack bludgeoning is NOT halved by Blade Ward (1d8(5)+3 = 8 -> full 8)
      endTurn(st);
      performAttack(st, "mag", "eg-5", "spell_bolt");
      expect(eg5.hpCurrent).toBe(38);

      // Fire damage is NOT halved by Blade Ward
      dealDamage(st, "eg-5", 10, { damageType: "fire", isAttack: true });
      expect(eg5.hpCurrent).toBe(28);

      // End of earth genasi's NEXT turn clears blade_ward
      endTurn(st); // mage -> eg5
      endTurn(st); // eg5 ends next turn
      expect(hasCondition(eg5, "blade_ward")).toBe(false);
    });

    it("fire-genasi: fire resist, Produce Flame L1 / Burning Hands L3 / Flame Blade L5", () => {
      const fg1 = raceHero("genasi-mpmm", "Дженази огня", "fg-1", 1);
      expect(modResistance(fg1, "fire")).not.toBeNull();
      expect(bySrd(fg1, "race/genasi-mpmm/innate/produce-flame").usesMax).toBe(0);

      const fg5 = raceHero("genasi-mpmm", "Дженази огня", "fg-5", 5);
      expect(bySrd(fg5, "race/genasi-mpmm/innate/burning-hands").usesMax).toBe(1);
      expect(bySrd(fg5, "race/genasi-mpmm/innate/flame-blade").usesMax).toBe(1);
    });

    it("water-genasi: swim 30, acid resist, Acid Splash L1 / Create or Destroy Water L3 / Water Walk L5", () => {
      const wg1 = raceHero("genasi-mpmm", "Дженази воды", "wg-1", 1);
      expect(wg1.speeds?.swim).toBe(30);
      expect(modResistance(wg1, "acid")).not.toBeNull();
      expect(bySrd(wg1, "race/genasi-mpmm/innate/acid-splash").usesMax).toBe(0);

      const wg5 = raceHero("genasi-mpmm", "Дженази воды", "wg-5", 5);
      expect(bySrd(wg5, "race/genasi-mpmm/innate/create-or-destroy-water").usesMax).toBe(1);
      expect(bySrd(wg5, "race/genasi-mpmm/innate/water-walk").usesMax).toBe(1);
    });
  });

  describe("10. duergar-mpmm (Дуэргар MPMM)", () => {
    it("dv 120, poison resist & poisoned adv, charmed/stunned adv, L3/L5 magic, no Sunlight Sensitivity", () => {
      const d = raceHero("duergar-mpmm", null, "du-5", 5, { racialVariants: ["cha"], mods: { CHA: 3 } });
      expect(d.darkvision).toBe(120);
      expect(modResistance(d, "poison")).not.toBeNull();
      expect(rollSave(d, "CON", 15, { condition: "poisoned" }).advantage).toBe(true);
      expect(rollSave(d, "WIS", 15, { condition: "charmed" }).advantage).toBe(true);
      expect(rollSave(d, "CON", 15, { condition: "stunned" }).advantage).toBe(true);
      const er = bySrd(d, "race/duergar-mpmm/innate/enlarge-reduce");
      expect(er.usesMax).toBe(1);
      expect(er.parameters?.saveDC).toBe(8 + 3 + 3);
      expect(bySrd(d, "race/duergar-mpmm/innate/invisibility").usesMax).toBe(1);
    });
  });

  describe("11. harengon-mpmm (Зайцегон MPMM)", () => {
    it("Hare-Trigger initiative +profBonus, Lucky Footwork DEX save +1d4 reaction (ReactionPrompt), Rabbit Hop 5*profBonus", () => {
      const h = raceHero("harengon-mpmm", null, "har-1", 5, {
        x: 5,
        y: 5,
        mods: { DEX: 2 },
        saves: { DEX: { prof: false, mod: 1 } },
      });
      h.dexMod = 2;
      seqRandom(0.5);
      // d20(11) + DEX(2) + profBonus(3) = 16
      expect(rollInitiativeFor(h)).toBe(16);

      const mage = enemy("mage", 6, 5, {
        abilities: [
          {
            id: "blast",
            name: "Взрыв",
            usesMax: 0,
            usesUsed: 0,
            refresh: "none",
            parameters: {
              name: "Взрыв",
              type: "spell",
              actionCost: "action",
              targeting: "creature",
              range: { type: "ranged", value: 60 },
              saveType: "DEX",
              saveDC: 15,
              damage: [{ dice: "1d6", mod: 0, type: "fire", save: "half" }],
            },
          },
        ],
      });
      const st = makeState([mage, h]);
      // With seed=1, d20=13 + 1 = 14 < 15 -> Lucky Footwork (+1d4) can rescue
      let caught: ReactionPrompt | null = null;
      try {
        runWithReactions({ decisions: {}, seq: 0 }, 1, () => {
          useAbility(st, "mage", "blast", { targetIds: ["har-1"] });
        });
      } catch (e) {
        if (e instanceof ReactionPrompt) caught = e;
        else throw e;
      }
      expect(caught).not.toBeNull();
      expect(caught!.prompt.reactorId).toBe("har-1");

      const hAcc = raceHero("harengon-mpmm", null, "har-1", 5, {
        x: 5,
        y: 5,
        saves: { DEX: { prof: false, mod: 1 } },
      });
      const stAcc = makeState([mage, hAcc]);
      mage.actionUsed = false;
      const outAcc = runWithReactions({ decisions: { [caught!.prompt.key]: caught!.prompt.options[0].id }, seq: 0 }, 1, () =>
        useAbility(stAcc, "mage", "blast", { targetIds: ["har-1"] })
      );
      expect(outAcc.targets[0]?.saved).toBe(true);
      expect(hAcc.reactionUsed).toBe(true);

      const hDec = raceHero("harengon-mpmm", null, "har-1", 5, {
        x: 5,
        y: 5,
        saves: { DEX: { prof: false, mod: 1 } },
      });
      const stDec = makeState([mage, hDec]);
      mage.actionUsed = false;
      const outDec = runWithReactions({ decisions: { [caught!.prompt.key]: DECLINE }, seq: 0 }, 1, () =>
        useAbility(stDec, "mage", "blast", { targetIds: ["har-1"] })
      );
      expect(outDec.targets[0]?.saved).toBe(false);
      expect(hDec.reactionUsed).toBe(false);

      // Rabbit Hop 5 * profBonus(3) = 15 ft without OA
      const guard = enemy("guard", 5, 6, { attacks: SURE_SWORD });
      const stHop = makeState([h, guard]);
      const hop = bySrd(h, "race/harengon-mpmm/krolichiy-pryzhok");
      expect(hop.usesMax).toBe(3);
      useAbility(stHop, "har-1", hop.id, { center: { x: 8, y: 5 } });
      expect(h.x).toBe(8);
      expect(guard.reactionUsed).toBe(false);
    });
  });

  describe("12. kenku-mpmm (Кенку MPMM)", () => {
    it("Kenku Recall manual free ability profBonus/long", () => {
      const k = raceHero("kenku-mpmm", null, "ken-1", 5);
      const rec = bySrd(k, "race/kenku-mpmm/vospominaniya-kenku");
      expect(rec.usesMax).toBe(3);
      expect(rec.refresh).toBe("long");
      expect(rec.parameters?.manual).toBe(true);
      const st = makeState([k]);
      useAbility(st, "ken-1", rec.id);
      expect(rec.usesUsed).toBe(1);
    });
  });

  describe("13. centaur-mpmm (Кентавр MPMM)", () => {
    it("walk 40, Hooves 1d6+STR bludgeoning, Charge bonus hooves strike after 30+ ft move and melee hit", () => {
      const cen = raceHero("centaur-mpmm", null, "cen-1", 3, {
        x: 0,
        y: 5,
        mods: { STR: 3 },
        attacks: SURE_SWORD,
      });
      expect(cen.speed).toBe(40);
      const hooves = cen.attacks.find((a) => a.id === "centaur_hooves");
      expect(hooves?.damage).toEqual([{ dice: "1d6", mod: 3, type: "bludgeoning" }]);

      const foe = enemy("orc", 7, 5, { hpMax: 40, hpCurrent: 40, ac: 10 });
      const st = makeState([cen, foe]);
      moveCombatant(st, "cen-1", { x: 6, y: 5 });
      performAttack(st, "cen-1", "orc", "sword");
      const charge = bySrd(cen, "race/centaur-mpmm/razbeg");
      useAbility(st, "cen-1", charge.id, { targetIds: ["orc"] });
      expect(foe.hpCurrent).toBeLessThan(32);
    });
  });

  describe("14. kobold-mpmm (Кобольд MPMM)", () => {
    it("Small, dv 60, Draconic Cry grants adv to BOTH allies and kobold itself (ignores deafened), Legacy options (Defiance / Draconic Sorcery)", () => {
      const kob = raceHero("kobold-mpmm", null, "kob-1", 5, {
        x: 5,
        y: 5,
        racialVariants: ["kobold-defiance"],
        attacks: SURE_SWORD,
      });
      expect(kob.size).toBe("small");
      expect(kob.darkvision).toBe(60);
      expect(rollSave(kob, "WIS", 15, { condition: "frightened" }).advantage).toBe(true);

      const ally1 = ally("ally1", 6, 6, { attacks: SURE_SWORD });
      const foeHear = enemy("orc1", 6, 5, { ac: 10 });
      const foeDeaf = enemy("orc2", 5, 6, { ac: 10, conditions: [{ type: "deafened" }] });
      const st = makeState([kob, ally1, foeHear, foeDeaf]);

      const cry = bySrd(kob, "race/kobold-mpmm/rev-drakona");
      expect(cry.usesMax).toBe(3);
      expect(cry.refresh).toBe("long");
      useAbility(st, "kob-1", cry.id);

      expect(hasCondition(foeHear, "kobold_draconic_cry")).toBe(true);
      expect(hasCondition(foeDeaf, "kobold_draconic_cry")).toBe(false);
      // Both kobold AND ally get advantage
      expect(computeAttackAdvantage(kob, foeHear, SURE_SWORD[0], {}, { allCombatants: st.combatants }).advantage).toBe(true);
      expect(computeAttackAdvantage(ally1, foeHear, SURE_SWORD[0], {}, { allCombatants: st.combatants }).advantage).toBe(true);

      // Expires at end of kobold's NEXT turn
      endTurn(st);
      expect(hasCondition(foeHear, "kobold_draconic_cry")).toBe(true);
      endTurn(st);
      endTurn(st);
      endTurn(st);
      endTurn(st);
      expect(hasCondition(foeHear, "kobold_draconic_cry")).toBe(false);

      // Kobold Draconic Sorcery option grants cantrip with chosen mental ability
      const kobSorc = raceHero("kobold-mpmm", null, "kob-sorc", 3, {
        racialVariants: ["kobold-draconic-sorcery", "wis"],
        mods: { WIS: 4, CHA: 0 },
      });
      const fb = bySrd(kobSorc, "race/kobold-mpmm/innate/fire-bolt");
      expect(fb.usesMax).toBe(0);
      expect(fb.parameters?.attackBonus).toBe(2 + 4);
    });
  });

  describe("15. lizardfolk-mpmm (Людоящер MPMM)", () => {
    it("swim 30, Natural Armor 13+DEX, Bite 1d6+STR slashing, Hungry Jaws profBonus/long grants profBonus temp HP", () => {
      const liz = raceHero("lizardfolk-mpmm", null, "liz-1", 5, {
        x: 5,
        y: 5,
        ac: 10,
        mods: { STR: 3, DEX: 2 },
      });
      expect(liz.speeds?.swim).toBe(30);
      expect(effectiveAC(liz)).toBe(15);
      const bite = liz.attacks.find((a) => a.id === "lizardfolk_bite");
      expect(bite?.damage).toEqual([{ dice: "1d6", mod: 3, type: "slashing" }]);

      const jaws = bySrd(liz, "race/lizardfolk-mpmm/golodnaya-past");
      expect(jaws.usesMax).toBe(3);
      expect(jaws.refresh).toBe("long");

      const foe = enemy("orc", 6, 5, { ac: 10, hpMax: 40, hpCurrent: 40 });
      const st = makeState([liz, foe]);
      useAbility(st, "liz-1", jaws.id, { targetIds: ["orc"] });
      expect(liz.hpTemp).toBe(3);
      expect(jaws.usesUsed).toBe(1);
    });
  });

  describe("16. minotaur-mpmm (Минотавр MPMM)", () => {
    it("Horns 1d6+STR piercing, Goring Rush after Dash+20ft, Hammering Horns 10ft push on melee hit", () => {
      const min = raceHero("minotaur-mpmm", null, "min-1", 3, {
        x: 0,
        y: 5,
        mods: { STR: 3 },
        attacks: SURE_SWORD,
      });
      const horns = min.attacks.find((a) => a.id === "minotaur_horns");
      expect(horns?.damage).toEqual([{ dice: "1d6", mod: 3, type: "piercing" }]);

      const foe = enemy("orc", 5, 5, { ac: 10, hpMax: 40, hpCurrent: 40, saves: { STR: { prof: false, mod: -1 } } });
      const st = makeState([min, foe]);
      applyEffect(st, "min-1", { condition: "dashing", durationRounds: 1 });
      moveCombatant(st, "min-1", { x: 4, y: 5 });
      useAbility(st, "min-1", bySrd(min, "race/minotaur-mpmm/pronzayushchiy-natisk").id, { targetIds: ["orc"] });
      expect(foe.hpCurrent).toBeLessThan(40);

      min.bonusActionUsed = false;
      performAttack(st, "min-1", "orc", "sword");
      seqRandom(0.1);
      useAbility(st, "min-1", bySrd(min, "race/minotaur-mpmm/sokrushitelnye-roga").id, { targetIds: ["orc"] });
      expect(foe.x).toBe(7);
    });
  });

  describe("17. sea-elf-mpmm (Морской эльф MPMM)", () => {
    it("swim 30, dv 60, Fey Ancestry (charmed adv), Trance (sleepImmune), Child of the Sea (cold resist)", () => {
      const se = raceHero("sea-elf-mpmm", null, "se-1", 1);
      expect(se.speeds?.swim).toBe(30);
      expect(se.darkvision).toBe(60);
      expect(modResistance(se, "cold")).not.toBeNull();
      expect(rollSave(se, "WIS", 15, { condition: "charmed" }).advantage).toBe(true);
      const st = makeState([se]);
      applyEffect(st, "se-1", { condition: "unconscious", durationRounds: 5, isMagicalSleep: true });
      expect(hasCondition(se, "unconscious")).toBe(false);
    });
  });

  describe("18. orc-mpmm (Орк MPMM)", () => {
    it("dv 60, Adrenaline Rush grants dashing + profBonus temp HP (profBonus/long), Relentless Endurance 1/long onDrop", () => {
      const orc = raceHero("orc-mpmm", null, "orc-1", 5, { hpMax: 20, hpCurrent: 10 });
      expect(orc.darkvision).toBe(60);
      const rush = bySrd(orc, "race/orc-mpmm/vybros-adrenalina");
      expect(rush.usesMax).toBe(3);
      expect(rush.refresh).toBe("long");

      const st = makeState([orc]);
      useAbility(st, "orc-1", rush.id);
      expect(hasCondition(orc, "dashing")).toBe(true);
      expect(orc.hpTemp).toBe(3);
      expect(rush.usesUsed).toBe(1);

      // Relentless Endurance drops to 1 HP instead of 0
      dealDamage(st, "orc-1", 15, { damageType: "slashing" });
      expect(orc.hpCurrent).toBe(1);
      expect(bySrd(orc, "race/orc-mpmm/nepokolebimaya-stoykost").usesUsed).toBe(1);
    });
  });

  describe("19. satyr-mpmm (Сатир MPMM)", () => {
    it("walk 35, Ram 1d6+STR bludgeoning, Magic Resistance (spellSaveAdvantage)", () => {
      const sat = raceHero("satyr-mpmm", null, "sat-1", 1, { mods: { STR: 2 } });
      expect(sat.speed).toBe(35);
      expect(sat.attacks.find((a) => a.id === "satyr_ram")?.damage).toEqual([
        { dice: "1d6", mod: 2, type: "bludgeoning" },
      ]);
      expect(rollSave(sat, "DEX", 15, { isSpell: true }).advantage).toBe(true);
      expect(rollSave(sat, "DEX", 15, { isSpell: false }).advantage).toBe(false);
    });
  });

  describe("20. tabaxi-mpmm (Табакси MPMM)", () => {
    it("walk 30, climb 30, dv 60, Claws 1d6+STR slashing, Feline Agility doubles speed & recharges on 0 ft move", () => {
      const tab = raceHero("tabaxi-mpmm", null, "tab-1", 3, { mods: { STR: 2 } });
      expect(tab.speeds?.climb).toBe(30);
      expect(tab.darkvision).toBe(60);
      expect(tab.attacks.find((a) => a.id === "tabaxi_claws")?.damage).toEqual([
        { dice: "1d6", mod: 2, type: "slashing" },
      ]);

      const st = makeState([tab]);
      const fa = bySrd(tab, "race/tabaxi-mpmm/koshache-provorstvo");
      useAbility(st, "tab-1", fa.id);
      expect(effectiveSpeed(tab)).toBe(60);
      endTurn(st);
      expect(fa.usesUsed).toBe(1);
      startTurn(st);
      endTurn(st);
      expect(fa.usesUsed).toBe(0);
    });
  });

  describe("21. tortle-mpmm (Тортл MPMM)", () => {
    it("Claws 1d6+STR slashing, Natural Armor 17, Shell Defense +4 AC & bonus exit", () => {
      const tor = raceHero("tortle-mpmm", null, "tor-1", 1, { ac: 10, mods: { STR: 3 } });
      expect(tor.attacks.find((a) => a.id === "tortle_claws")?.damage).toEqual([
        { dice: "1d6", mod: 3, type: "slashing" },
      ]);
      expect(effectiveAC(tor)).toBe(17);

      const st = makeState([tor]);
      const shell = bySrd(tor, "race/tortle-mpmm/pantsirnaya-zashchita");
      useAbility(st, "tor-1", shell.id);
      expect(effectiveAC(tor)).toBe(21);
      expect(effectiveSpeed(tor)).toBe(0);
      useAbility(st, "tor-1", shell.id);
      expect(effectiveAC(tor)).toBe(17);
    });
  });

  describe("22. triton-mpmm (Тритон MPMM)", () => {
    it("swim 30, dv 60, cold resist, Fog Cloud L1 (minLevel override) / Gust of Wind L3 / Water Walk L5 with chosen ability", () => {
      const t1 = raceHero("triton-mpmm", null, "tri-1", 1, { racialVariants: ["wis"], mods: { WIS: 4, CHA: 0 } });
      expect(t1.speeds?.swim).toBe(30);
      expect(t1.darkvision).toBe(60);
      expect(modResistance(t1, "cold")).not.toBeNull();
      const fog = bySrd(t1, "race/triton-mpmm/innate/fog-cloud");
      expect(fog.usesMax).toBe(1);
      expect(fog.parameters?.saveDC).toBe(8 + 2 + 4);

      const t5 = raceHero("triton-mpmm", null, "tri-5", 5);
      expect(bySrd(t5, "race/triton-mpmm/innate/gust-of-wind").usesMax).toBe(1);
      expect(bySrd(t5, "race/triton-mpmm/innate/water-walk").usesMax).toBe(1);
    });
  });

  describe("23. firbolg-mpmm (Фирболг MPMM)", () => {
    it("Firbolg Magic with chosen ability, Hidden Step profBonus/long & clears on attack", () => {
      const f = raceHero("firbolg-mpmm", null, "fir-1", 5, {
        x: 5,
        y: 5,
        racialVariants: ["int"],
        mods: { INT: 4, WIS: 1 },
        attacks: SURE_SWORD,
      });
      expect(bySrd(f, "race/firbolg-mpmm/innate/detect-magic").parameters?.saveDC).toBe(8 + 3 + 4);
      expect(bySrd(f, "race/firbolg-mpmm/innate/disguise-self").usesMax).toBe(1);

      const hs = bySrd(f, "race/firbolg-mpmm/nezrimaya-postup");
      expect(hs.usesMax).toBe(3);
      expect(hs.refresh).toBe("long");

      const foe = enemy("orc", 6, 5, { ac: 10 });
      const st = makeState([f, foe]);
      useAbility(st, "fir-1", hs.id);
      expect(hasCondition(f, "invisible")).toBe(true);
      performAttack(st, "fir-1", "orc", "sword");
      expect(hasCondition(f, "invisible")).toBe(false);
    });
  });

  describe("24. fairy-mpmm (Фэйри MPMM)", () => {
    it("Small, fly 30, Fairy Magic L1 Druidcraft (minLevel override) / L3 Faerie Fire / L5 Enlarge/Reduce with chosen ability", () => {
      const f1 = raceHero("fairy-mpmm", null, "fai-1", 1);
      expect(f1.size).toBe("small");
      expect(f1.speeds?.fly).toBe(30);
      expect(bySrd(f1, "race/fairy-mpmm/innate/druidcraft").usesMax).toBe(0);

      const f5 = raceHero("fairy-mpmm", null, "fai-5", 5, { racialVariants: ["wis"], mods: { WIS: 4, CHA: 0 } });
      const ff = bySrd(f5, "race/fairy-mpmm/innate/faerie-fire");
      expect(ff.usesMax).toBe(1);
      expect(ff.parameters?.saveDC).toBe(8 + 3 + 4);
      expect(bySrd(f5, "race/fairy-mpmm/innate/enlarge-reduce").usesMax).toBe(1);
    });
  });

  describe("25. hobgoblin-mpmm (Хобгоблин MPMM)", () => {
    it("Fey Ancestry, Fey Gift L1 Help & L3 Hospitality/Passage/Spite sharing profBonus/long pool, Fortune from the Many +min(3, allies) profBonus/long", () => {
      // L1 has dar-fey Help (minLevel override), no L3 gift variants
      const h1 = raceHero("hobgoblin-mpmm", null, "hob-1", 1, { x: 5, y: 5 });
      const dar1 = bySrd(h1, "race/hobgoblin-mpmm/dar-fey");
      expect(dar1.usesMax).toBe(2);
      expect(h1.abilities.some((a) => a.parameters?.srdKey === "race/hobgoblin-mpmm/fey-gift-hospitality")).toBe(false);

      // L5 has all 3 Fey Gift options sharing dar-fey pool (usesMax = 3)
      const h5 = raceHero("hobgoblin-mpmm", null, "hob-5", 5, { x: 5, y: 5 });
      const ally1 = ally("a1", 6, 5, { attacks: SURE_SWORD });
      const ally2 = ally("a2", 7, 5);
      const ally3 = ally("a3", 8, 5);
      const ally4 = ally("a4", 9, 5);
      const foe = enemy("orc", 7, 6, { ac: 10, hpMax: 50, hpCurrent: 50, attacks: SURE_SWORD });
      const st = makeState([h5, ally1, ally2, ally3, ally4, foe]);

      const dar5 = bySrd(h5, "race/hobgoblin-mpmm/dar-fey");
      const hosp = bySrd(h5, "race/hobgoblin-mpmm/fey-gift-hospitality");
      const pass = bySrd(h5, "race/hobgoblin-mpmm/fey-gift-passage");
      const spite = bySrd(h5, "race/hobgoblin-mpmm/fey-gift-spite");

      // 1) Hospitality: helped + 1d6+3 temp HP to both
      // 1d6 (0.5 -> 4) + 3 = 7
      useAbility(st, "hob-5", hosp.id, { targetIds: ["a1"] });
      expect(hasCondition(ally1, "helped")).toBe(true);
      expect(h5.hpTemp).toBe(7);
      expect(ally1.hpTemp).toBe(7);
      expect(dar5.usesUsed).toBe(1);

      // 2) Passage: +10 ft speed to both until start of hobgoblin's next turn
      h5.bonusActionUsed = false;
      useAbility(st, "hob-5", pass.id, { targetIds: ["a1"] });
      expect(effectiveSpeed(h5)).toBe(40);
      expect(effectiveSpeed(ally1)).toBe(40);
      expect(dar5.usesUsed).toBe(2);

      // 3) Spite: ally's next hit inflicts spite_disadvantage (consumed on enemy's next attack)
      h5.bonusActionUsed = false;
      useAbility(st, "hob-5", spite.id, { targetIds: ["a1"] });
      expect(dar5.usesUsed).toBe(3);
      // Pool exhausted -> cannot use dar-fey again
      h5.bonusActionUsed = false;
      expect(() => useAbility(st, "hob-5", dar5.id, { targetIds: ["a2"] })).toThrow();

      performAttack(st, "a1", "orc", "sword", { skipTurnCheck: true });
      expect(hasCondition(foe, "spite_disadvantage")).toBe(true);
      expect(computeAttackAdvantage(foe, ally1, SURE_SWORD[0], {}, { allCombatants: st.combatants }).disadvantage).toBe(true);
      performAttack(st, "orc", "a1", "sword", { skipTurnCheck: true });
      expect(hasCondition(foe, "spite_disadvantage")).toBe(false);

      // Passage clears on hobgoblin's next startTurn
      startTurn(st);
      expect(effectiveSpeed(h5)).toBe(30);
      expect(effectiveSpeed(ally1)).toBe(30);

      // Fortune from the Many: max +3 (even with 4 allies in 30 ft), profBonus/long
      const hFort = raceHero("hobgoblin-mpmm", null, "hob-f", 5, {
        x: 5,
        y: 5,
        saves: { WIS: { prof: false, mod: 1 } },
      });
      const fort = bySrd(hFort, "race/hobgoblin-mpmm/udacha-mnozhestva");
      expect(fort.usesMax).toBe(3);
      expect(fort.refresh).toBe("long");

      const mage = enemy("mage", 6, 6, {
        abilities: [
          {
            id: "hold",
            name: "Паралич",
            usesMax: 0,
            usesUsed: 0,
            refresh: "none",
            parameters: {
              name: "Паралич",
              type: "spell",
              actionCost: "action",
              targeting: "creature",
              range: { type: "ranged", value: 60 },
              saveType: "WIS",
              saveDC: 16,
              effects: [{ condition: "paralyzed", durationRounds: 1 }],
            },
          },
        ],
      });
      const stFort = makeState([mage, hFort, ally1, ally2, ally3, ally4]);
      // d20(11)+1 = 12 < 16; max bonus +3 -> 15 < 16 (still fails because capped at +3, not +4!)
      seqRandom(0.5);
      const outFail = useAbility(stFort, "mage", "hold", { targetIds: ["hob-f"] });
      expect(outFail.targets[0]?.saved).toBe(false);
      expect(fort.usesUsed).toBe(0);

      // With DC 15: 12 + 3 = 15 >= 15 -> rescues!
      mage.actionUsed = false;
      mage.abilities[0].parameters!.saveDC = 15;
      hFort.conditions = [];
      seqRandom(0.5);
      const outOk = useAbility(stFort, "mage", "hold", { targetIds: ["hob-f"] });
      expect(outOk.targets[0]?.saved).toBe(true);
      expect(fort.usesUsed).toBe(1);
    });
  });

  describe("26. changeling-mpmm (Чейнджлинг MPMM)", () => {
    it("supports flexible Small/Medium size and builds cleanly", () => {
      const chM = raceHero("changeling-mpmm", null, "ch-m", 1);
      const chS = raceHero("changeling-mpmm", null, "ch-s", 1, { sheet: { size: "Маленький" } });
      expect(chM.size).toBe("medium");
      expect(chS.size).toBe("small");
    });
  });

  describe("27. shadar-kai-mpmm (Шадар-кай MPMM)", () => {
    it("Fey Ancestry, Trance, necrotic resist, Blessing of the Raven Queen L1 teleport profBonus/long & L3 all-damage resist", () => {
      const sk1 = raceHero("shadar-kai-mpmm", null, "sk-1", 1, { x: 2, y: 5 });
      expect(modResistance(sk1, "necrotic")).not.toBeNull();
      const b1 = bySrd(sk1, "race/shadar-kai-mpmm/blagoslovenie-korolevy-voronov");
      expect(b1.usesMax).toBe(2);
      const st1 = makeState([sk1]);
      useAbility(st1, "sk-1", b1.id, { center: { x: 5, y: 5 } });
      expect(sk1.x).toBe(5);
      expect(hasCondition(sk1, "raven_queen_blessing")).toBe(false);

      const sk3 = raceHero("shadar-kai-mpmm", null, "sk-3", 3, { x: 2, y: 5, hpMax: 40, hpCurrent: 40 });
      const b3 = bySrd(sk3, "race/shadar-kai-mpmm/blagoslovenie-korolevy-voronov");
      const st3 = makeState([sk3]);
      useAbility(st3, "sk-3", b3.id, { center: { x: 5, y: 5 } });
      expect(hasCondition(sk3, "raven_queen_blessing")).toBe(true);
      dealDamage(st3, "sk-3", 10, { damageType: "fire" });
      expect(sk3.hpCurrent).toBe(35);
      startTurn(st3);
      expect(hasCondition(sk3, "raven_queen_blessing")).toBe(false);
    });
  });

  describe("28. shifter-mpmm (Шифтер MPMM: all 4 option variants)", () => {
    it("Beasthide: +2*profBonus + 1d6 temp HP and +1 AC while shifted (profBonus/long)", () => {
      const sh = raceHero("shifter-mpmm", null, "sh-bh", 5, { ac: 14, racialVariants: ["beasthide"] });
      const sm = bySrd(sh, "race/shifter-mpmm/smena-formy");
      expect(sm.usesMax).toBe(3);
      expect(sm.refresh).toBe("long");
      const st = makeState([sh]);
      // 2*3 + 1d6(0.5 -> 4) = 10 temp HP
      useAbility(st, "sh-bh", sm.id);
      expect(hasCondition(sh, "shifter_shifted")).toBe(true);
      expect(sh.hpTemp).toBe(10);
      expect(effectiveAC(sh)).toBe(15);
    });

    it("Longtooth: +2*profBonus temp HP and bonus-action 1d6+STR piercing bite while shifted", () => {
      const sh = raceHero("shifter-mpmm", null, "sh-lt", 5, { x: 5, y: 5, mods: { STR: 3 }, racialVariants: ["longtooth"] });
      const foe = enemy("orc", 6, 5, { ac: 10, hpMax: 30, hpCurrent: 30 });
      const st = makeState([sh, foe]);
      const bite = bySrd(sh, "race/shifter-mpmm/longtooth");
      expect(() => useAbility(st, "sh-lt", bite.id, { targetIds: ["orc"] })).toThrow();

      useAbility(st, "sh-lt", bySrd(sh, "race/shifter-mpmm/smena-formy").id);
      expect(sh.hpTemp).toBe(6);
      sh.bonusActionUsed = false;
      useAbility(st, "sh-lt", bite.id, { targetIds: ["orc"] });
      // 1d6(4)+3 = 7
      expect(foe.hpCurrent).toBe(23);
    });

    it("Swiftstride: +10 speed & reaction retreat 10 ft without OA (incl. ReactionPrompt)", () => {
      const sh = raceHero("shifter-mpmm", null, "sh-sw", 5, { x: 5, y: 5, racialVariants: ["swiftstride"] });
      const foe = enemy("orc", 6, 5, { attacks: SURE_SWORD });
      const watcher = ally("watcher", 0, 0);
      const st = makeState([sh, foe, watcher]);
      useAbility(st, "sh-sw", bySrd(sh, "race/shifter-mpmm/smena-formy").id);
      expect(effectiveSpeed(sh)).toBe(40);
      endTurn(st);
      endTurn(st);
      expect(sh.reactionUsed).toBe(true);
      expect(Math.abs(sh.x - foe.x)).toBeGreaterThanOrEqual(2);
      expect(foe.reactionUsed).toBe(false);

      // ReactionPrompt path in runWithReactions
      const sh2 = raceHero("shifter-mpmm", null, "sh-sw2", 5, { x: 5, y: 5, racialVariants: ["swiftstride"] });
      const foe2 = enemy("orc2", 6, 5, { attacks: SURE_SWORD });
      const watcher2 = ally("watcher2", 0, 0);
      const st2 = makeState([foe2, watcher2, sh2]);
      applyEffect(st2, "sh-sw2", { condition: "shifter_shifted", durationRounds: 10 }, "sh-sw2");
      let caught: ReactionPrompt | null = null;
      try {
        runWithReactions({ decisions: {}, seq: 0 }, 1, () => {
          endTurn(st2);
        });
      } catch (e) {
        if (e instanceof ReactionPrompt) caught = e;
        else throw e;
      }
      expect(caught).not.toBeNull();
      expect(caught!.prompt.reactorId).toBe("sh-sw2");
    });

    it("Wildhunt: prevents attackers within 30 ft from having advantage while shifted & conscious", () => {
      const sh = raceHero("shifter-mpmm", null, "sh-wh", 5, { x: 5, y: 5, racialVariants: ["wildhunt"] });
      const nearFoe = enemy("orc-near", 7, 5, { conditions: [{ type: "vow_of_enmity" }] });
      const st = makeState([sh, nearFoe]);
      useAbility(st, "sh-wh", bySrd(sh, "race/shifter-mpmm/smena-formy").id);
      expect(
        computeAttackAdvantage(nearFoe, sh, SURE_SWORD[0], { advantage: true }, { distanceFt: 10, allCombatants: st.combatants }).advantage
      ).toBe(false);
    });
  });

  describe("29. eladrin-mpmm (Эладрин MPMM)", () => {
    it("Fey Step profBonus/long, L3 seasonal effects with Leto dealing profBonus fire & chosen mental ability DC", () => {
      const el = raceHero("eladrin-mpmm", null, "el-5", 5, {
        x: 2,
        y: 5,
        racialVariants: ["leto", "int"],
        mods: { INT: 4, CHA: 0 },
      });
      const step = bySrd(el, "race/eladrin-mpmm/feyskiy-shag");
      expect(step.usesMax).toBe(3);
      expect(step.refresh).toBe("long");

      const foe = enemy("orc", 6, 5, { hpMax: 30, hpCurrent: 30 });
      const st = makeState([el, foe]);
      useAbility(st, "el-5", step.id, { center: { x: 5, y: 5 } });
      // Summer (leto) deals profBonus (3) fire damage
      expect(foe.hpCurrent).toBe(27);
    });
  });

  describe("30. yuan-ti-mpmm (Юань-ти MPMM)", () => {
    it("Magic Resistance, Poison Resistance (NOT immunity) + poisoned adv, Serpentine Spellcasting L1 Poison Spray & Animal Friendship / L3 Suggestion", () => {
      const yt1 = raceHero("yuan-ti-mpmm", null, "yt-1", 1, { hpMax: 30, hpCurrent: 30 });
      expect(rollSave(yt1, "DEX", 15, { isSpell: true }).advantage).toBe(true);
      expect(rollSave(yt1, "CON", 15, { condition: "poisoned" }).advantage).toBe(true);
      expect(modResistance(yt1, "poison")).not.toBeNull();

      const st = makeState([yt1]);
      dealDamage(st, "yt-1", 20, { damageType: "poison" });
      // Poison resistance halves 20 -> 10 (NOT immune!)
      expect(yt1.hpCurrent).toBe(20);

      expect(bySrd(yt1, "race/yuan-ti-mpmm/innate/poison-spray").usesMax).toBe(0);
      expect(bySrd(yt1, "race/yuan-ti-mpmm/innate/animal-friendship").usesMax).toBe(0);

      const yt3 = raceHero("yuan-ti-mpmm", null, "yt-3", 3, { racialVariants: ["wis"], mods: { WIS: 4, CHA: 0 } });
      const sug = bySrd(yt3, "race/yuan-ti-mpmm/innate/suggestion");
      expect(sug.usesMax).toBe(1);
      expect(sug.parameters?.saveDC).toBe(8 + 2 + 4);
    });
  });

  describe("Batch 4 MPMM Completeness", () => {
    it("covers all 30 MPMM races & subraces in races-2014.json and handlers in class-kit", () => {
      expect(MPMM_RACE_IDS.length).toBe(30);
      for (const raceId of MPMM_RACE_IDS) {
        const data = RACES_2014.find((r) => r.id === raceId)!;
        const rules = raceRules(raceId);
        expect(rules, `Missing defineRace("${raceId}")`).toBeDefined();
        for (const t of data.traits) {
          expect(rules!.traits[t.id], `${raceId} missing trait rule: ${t.id}`).toBeDefined();
        }
        for (const sub of data.subraces) {
          const subRules = rules!.subraces?.[sub.id];
          expect(subRules, `${raceId} missing subrace rules: ${sub.id}`).toBeDefined();
          for (const t of sub.traits) {
            expect(subRules!.traits[t.id], `${raceId}/${sub.id} missing trait rule: ${t.id}`).toBeDefined();
          }
        }
        for (const { key, rule } of raceRuleKeys(raceId)) {
          if (rule.kind !== "active" || rule.manual) continue;
          expect(kitHandles(key), `Missing kit handler for ${key}`).toBe(true);
        }
      }
    });
  });
});
